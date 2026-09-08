import fs from "node:fs";
import path from "node:path";
import { generateImageDetailed } from "@/lib/image-generation";
import { repoPublicPath } from "@/lib/public-path";
import { PRODUCT } from "@/lib/product-config";
import type { AssetSlot, GameDesignDoc } from "@/lib/game-forge/types";
import { currentGenerationJobId } from "@/lib/generation-job-context";

export function safeAssetError(error: string): string {
  return error.replace(/https?:\/\/[^\s]+/gi, "[url]").replace(/(?:bearer\s+|sk-)[\w.\-]+/gi, "[redacted]").replace(/((?:api[_-]?key|token|authorization|secret)\s*[=:]\s*)[^\s,;]+/gi, "$1[redacted]").slice(0, 400);
}

/**
 * Art agent.
 *
 * The design agent already writes a per-slot image prompt for exactly the
 * actors this game draws — and until now every one of those prompts was
 * thrown away, because the sprite pipeline only ever generated a fixed five
 * kinds (player/hazard/gem/power/boss) built for the pre-forge runtime. A game
 * about bamboo shoots and hunter traps got a generic "hazard" sprite and no
 * trap at all.
 *
 * This generates one image per declared slot, writing it where the runtime
 * host already looks for it: `/game-sprites/<projectId>/<slot.key>.png`, with
 * the background at `/game-bg/<projectId>.png`.
 */

export type ForgeAssetResult = {
  key: string;
  kind: AssetSlot["kind"];
  url: string | null;
  error?: string;
  durationMs: number;
};

export type ForgeAssetRun = {
  results: ForgeAssetResult[];
  generated: number;
  failed: number;
  durationMs: number;
};

/** Slot art must read as one game, so every prompt carries the same direction. */
function buildSlotPrompt(design: GameDesignDoc, slot: AssetSlot): string {
  const isBackground = slot.kind === "background";
  const shared = `art direction: cohesive with "${design.title}" — ${design.pitch}; genre ${design.genre}`;
  const framing = isBackground
    ? "wide establishing background plate, no characters in focus, no UI, no text"
    // A flat, uniform backdrop is what makes the automatic cutout reliable:
    // the fill starts at the border and stops at the subject's silhouette.
    : "single subject centered, full body, front-facing, clean readable silhouette, generous empty margin around the subject, placed on a completely flat uniform solid-colour backdrop with no gradient, no shadow on the backdrop, no scenery, no ground plane, no text, no UI, no watermark";
  return [slot.prompt, shared, framing, "game art, crisp edges, readable at small size"].join(", ");
}

/**
 * Image models return 2K plates — a sprite came back at 3-6 MB, and a game
 * with five of those spends its whole opening on downloads while the SDK
 * renders placeholders. Downscale to what the canvas actually samples: a
 * sprite is drawn at ~56 px, a background covers a 960x540 stage.
 */
const SPRITE_MAX_EDGE = 512;
const BACKGROUND_MAX_EDGE = 1280;

/**
 * Removes a flat backdrop from a sprite by flood-filling inward from the
 * edges.
 *
 * Image models return opaque PNGs however firmly the prompt asks for
 * transparency, so a character arrives sitting in a white or grey rectangle
 * and renders on the canvas as a box with a panda in it. A global colour key
 * would also punch holes in matching pixels INSIDE the subject (white eyes,
 * grey fur), so the fill starts only from the border and stops at the
 * silhouette.
 */
async function cutOutBackdrop(input: Buffer): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (channels < 4) return input;

  const at = (x: number, y: number) => (y * width + x) * channels;
  // The backdrop colour is whatever occupies the corners.
  const corners = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]] as const;
  let r = 0, g = 0, b = 0;
  for (const [x, y] of corners) { const i = at(x, y); r += data[i]!; g += data[i + 1]!; b += data[i + 2]!; }
  r /= corners.length; g /= corners.length; b /= corners.length;

  // Bail out when the corners disagree: that is a scene, not a cutout plate.
  for (const [x, y] of corners) {
    const i = at(x, y);
    if (Math.abs(data[i]! - r) + Math.abs(data[i + 1]! - g) + Math.abs(data[i + 2]! - b) > 90) return input;
  }

  const TOLERANCE = 42;
  const matches = (i: number) =>
    Math.abs(data[i]! - r) <= TOLERANCE && Math.abs(data[i + 1]! - g) <= TOLERANCE && Math.abs(data[i + 2]! - b) <= TOLERANCE;

  const seen = new Uint8Array(width * height);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (seen[p]) return;
    seen[p] = 1;
    if (matches(p * channels)) stack.push(p);
  };
  for (let x = 0; x < width; x += 1) { push(x, 0); push(x, height - 1); }
  for (let y = 0; y < height; y += 1) { push(0, y); push(width - 1, y); }

  let cleared = 0;
  while (stack.length) {
    const p = stack.pop()!;
    data[p * channels + 3] = 0;
    cleared += 1;
    const x = p % width;
    const y = (p / width) | 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }

  // Clearing nearly everything means the "backdrop" was the subject.
  if (cleared > width * height * 0.92) return input;
  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

async function compressImage(input: Buffer, isBackground: boolean): Promise<Buffer> {
  try {
    const { default: sharp } = await import("sharp");
    // Backgrounds are meant to be opaque; only actors get cut out.
    const prepared = isBackground ? input : await cutOutBackdrop(input).catch(() => input);
    return await sharp(prepared)
      .resize({
        width: isBackground ? BACKGROUND_MAX_EDGE : SPRITE_MAX_EDGE,
        height: isBackground ? BACKGROUND_MAX_EDGE : SPRITE_MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      // A palette PNG keeps 1-bit alpha, which leaves a hard fringe on a
      // cut-out sprite, so actors stay full-colour with an 8-bit alpha.
      .png({ compressionLevel: 9, effort: 7 })
      .toBuffer();
  } catch {
    // Compression is an optimisation, never a reason to lose the artwork.
    return input;
  }
}

async function writeImage(targetPath: string, url: string, localPath?: string, isBackground = false): Promise<void> {
  await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
  const raw = localPath && fs.existsSync(localPath)
    ? await fs.promises.readFile(localPath)
    : await (async () => {
        const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
        if (!res.ok) throw new Error(`download failed HTTP ${res.status}`);
        return Buffer.from(await res.arrayBuffer());
      })();
  await fs.promises.writeFile(targetPath, await compressImage(raw, isBackground));
}

/**
 * Runs a slot against a hard wall-clock ceiling.
 *
 * The timeout passed into the image layer bounds one provider call, but a
 * failed call falls back to a second provider and the download after it has a
 * ceiling of its own, so the only way to bound what a creator waits is to
 * bound the whole slot. Losing the race abandons the image, not the build: the
 * runtime draws a generated placeholder for a missing asset.
 */
async function withDeadline(slot: AssetSlot, ms: number, work: Promise<ForgeAssetResult>): Promise<ForgeAssetResult> {
  let timer: NodeJS.Timeout | undefined;
  const started = Date.now();
  const expired = new Promise<ForgeAssetResult>((resolve) => {
    timer = setTimeout(
      () => resolve({ key: slot.key, kind: slot.kind, url: null, error: `art slot exceeded ${Math.round(ms / 1000)}s budget`, durationMs: Date.now() - started }),
      ms,
    );
  });
  try {
    return await Promise.race([work, expired]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function generateSlot(projectId: string, design: GameDesignDoc, slot: AssetSlot, rootDir: string): Promise<ForgeAssetResult> {
  const t0 = Date.now();
  const isBackground = slot.kind === "background";
  const target = isBackground
    ? path.join(rootDir, "game-bg", `${projectId}.png`)
    : path.join(rootDir, "game-sprites", projectId, `${slot.key}.png`);
  const url = isBackground ? `/game-bg/${projectId}.png` : `/game-sprites/${projectId}/${slot.key}.png`;

  // Regenerating a slot that already exists would burn a minute per image on
  // every retry of a durable job for no visible gain.
  if (fs.existsSync(target)) return { key: slot.key, kind: slot.kind, url, durationMs: Date.now() - t0 };

  try {
    const result = await generateImageDetailed(buildSlotPrompt(design, slot), {
      size: isBackground ? "1536x1024" : "1024x1024",
      quality: "standard",
      // Without this the call inherits a twelve-minute default meant for
      // background comic jobs, not for someone watching a build.
      timeoutMs: PRODUCT.gameForge.artSlotTimeoutMs,
    });
    if (!result.ok || !result.url) {
      return { key: slot.key, kind: slot.kind, url: null, error: result.error ?? "image model returned nothing", durationMs: Date.now() - t0 };
    }
    await writeImage(target, result.url, result.localPath, isBackground);
    return { key: slot.key, kind: slot.kind, url, durationMs: Date.now() - t0 };
  } catch (e) {
    return { key: slot.key, kind: slot.kind, url: null, error: (e as Error).message, durationMs: Date.now() - t0 };
  }
}

/** Bounded concurrency: image calls take 15-60s each and the gateway rate-limits. */
async function pooled<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(
    new Array(Math.max(1, Math.min(limit, items.length))).fill(0).map(async () => {
      for (;;) {
        const index = cursor;
        cursor += 1;
        if (index >= items.length) return;
        out[index] = await fn(items[index]!);
      }
    }),
  );
  return out;
}

export async function runForgeAssetAgent(
  projectId: string,
  design: GameDesignDoc,
  opts: {
    concurrency?: number;
    rootDir?: string;
    /** Wall-clock ceiling for the whole stage; defaults to PRODUCT.gameForge.artBudgetMs. */
    budgetMs?: number;
    /** Fires per slot as its image lands, with the url so a UI can show it immediately. */
    onSlotDone?: (slot: ForgeAssetResult & { done: number; total: number }) => void;
    onProgress?: (done: number, total: number, key: string) => void;
  } = {},
): Promise<ForgeAssetRun> {
  const t0 = Date.now();
  const rootDir = opts.rootDir ?? repoPublicPath();
  const slots = design.assets;
  let done = 0;

  // One stage-wide deadline on top of the per-slot ceiling. Slots run in a
  // pool, so a queued slot must not start a fresh 75s attempt when the stage
  // has already spent its budget.
  const deadline = t0 + (opts.budgetMs ?? PRODUCT.gameForge.artBudgetMs);
  const results = await pooled(slots, opts.concurrency ?? PRODUCT.gameForge.artConcurrency, async (slot) => {
    const left = deadline - Date.now();
    const result =
      left <= 0
        ? { key: slot.key, kind: slot.kind, url: null, error: "art budget exhausted before this slot started", durationMs: 0 }
        : await withDeadline(slot, Math.min(PRODUCT.gameForge.artSlotTimeoutMs * 2, left), generateSlot(projectId, design, slot, rootDir));
    done += 1;
    if (!result.url) console.error("[forge_asset_failed]", JSON.stringify({ jobId: currentGenerationJobId(), projectId, slot: slot.key, kind: slot.kind, durationMs: result.durationMs, error: safeAssetError(result.error ?? "image_generation_failed") }));
    opts.onProgress?.(done, slots.length, slot.key);
    opts.onSlotDone?.({ ...result, done, total: slots.length });
    return result;
  });

  return {
    results,
    generated: results.filter((r) => r.url).length,
    failed: results.filter((r) => !r.url).length,
    durationMs: Date.now() - t0,
  };
}

/** Slots the design marked required that still have no image. */
export function missingRequiredSlots(design: GameDesignDoc, run: ForgeAssetRun): string[] {
  const failedKeys = new Set(run.results.filter((r) => !r.url).map((r) => r.key));
  return design.assets.filter((a) => a.required && failedKeys.has(a.key)).map((a) => a.key);
}
