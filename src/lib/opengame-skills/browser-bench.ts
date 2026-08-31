import type { GameSpec } from "@/lib/game-spec";
import type { AgenticGameModule } from "@/lib/agentic/game-module";
import type { DebugCheckResult } from "@/lib/opengame-skills/types";

/** Playwright 从 /qa/agentic-bench 页面读取的探测结果 */
export type AgenticBrowserBenchProbe = {
  status: "pending" | "done" | "error";
  moduleFailed?: boolean;
  consoleErrors?: string[];
  canvasVisible?: boolean;
  canvasNonEmpty?: boolean;
  phaserReady?: boolean;
  sceneKey?: string | null;
  errorMessage?: string;
  /** Real synthetic touch/keyboard inputs sent after the scene has booted. */
  syntheticActions?: number;
  visualChangedAfterInput?: boolean;
  beforeFrameFingerprint?: string;
  afterFrameFingerprint?: string;
};

declare global {
  interface Window {
    __OPERONE_AGENTIC_BENCH__?: AgenticBrowserBenchProbe;
  }
}

function base64UrlToBytes(payload: string): Uint8Array {
  const pad = payload.length % 4 === 0 ? "" : "=".repeat(4 - (payload.length % 4));
  const b64 = payload.replace(/-/g, "+").replace(/_/g, "/") + pad;
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(b64, "base64"));
  }
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64url");
  }
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function utf8Encode(text: string): Uint8Array {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(text);
  return new Uint8Array(Buffer.from(text, "utf8"));
}

function utf8Decode(bytes: Uint8Array): string {
  if (typeof TextDecoder !== "undefined") return new TextDecoder().decode(bytes);
  return Buffer.from(bytes).toString("utf8");
}

export function encodeAgenticBenchPayload(spec: GameSpec): string {
  return bytesToBase64Url(utf8Encode(JSON.stringify({ spec })));
}

export function decodeAgenticBenchPayload(payload: string): { spec: GameSpec } | null {
  try {
    const json = utf8Decode(base64UrlToBytes(payload));
    const parsed = JSON.parse(json) as { spec?: GameSpec };
    if (!parsed?.spec || typeof parsed.spec !== "object") return null;
    return { spec: parsed.spec };
  } catch {
    return null;
  }
}

export function buildSpecForAgenticBench(
  spec: GameSpec,
  module: AgenticGameModule,
): GameSpec {
  return {
    ...spec,
    agenticModule: module,
  };
}

/** OpenGame-Bench 风格：浏览器探测失败 → Debug Skill 修复提示 */
export function browserBenchToDebugChecks(probe: AgenticBrowserBenchProbe): DebugCheckResult[] {
  const checks: DebugCheckResult[] = [];
  if (probe.moduleFailed) {
    checks.push({
      entryId: "bench-module-failed",
      errorCode: "MODULE_LOAD_FAILED",
      message: "Agentic module failed to load in real Phaser runtime",
      rootCause: "runAgenticModule returned null or create() threw in browser",
      fix: {
        type: "edit",
        description: "Fix createGame to return valid instance; avoid hard-coded texture keys; use ctx.colors rectangles.",
        patch: "Follow Template Skill scaffold; test with scene.add.rectangle + physics.add.existing only.",
      },
    });
  }
  if (probe.canvasVisible === false) {
    checks.push({
      entryId: "bench-no-canvas",
      errorCode: "CANVAS_NOT_VISIBLE",
      message: "Canvas not visible",
      rootCause: "Phaser game failed to boot or container has zero size",
      fix: {
        type: "edit",
        description: "Ensure create() adds visible objects and does not throw before first frame.",
        patch: "Add background rectangle first; verify createGame create() completes.",
      },
    });
  }
  if (probe.canvasNonEmpty === false) {
    checks.push({
      entryId: "bench-empty-canvas",
      errorCode: "CANVAS_EMPTY",
      message: "Canvas renders blank / uniform pixels",
      rootCause: "Visual Usability failure — no drawable content (OpenGame-Bench)",
      fix: {
        type: "edit",
        description: "Draw background + player + at least one interactive element with theme colors.",
        patch: "scene.add.rectangle for bg and player; avoid relying on missing texture keys.",
      },
    });
  }
  for (const err of probe.consoleErrors ?? []) {
    if (/Texture.*not found|Cannot read propert/i.test(err)) {
      checks.push({
        entryId: "bench-console",
        errorCode: "BROWSER_CONSOLE_ERROR",
        message: err,
        rootCause: "Runtime error in real browser",
        fix: {
          type: "edit",
          description: "Fix the runtime error shown in browser console",
          patch: err.includes("Texture") ? "Use ctx.assets keys or rectangles only." : "Fix initialization order in create().",
        },
      });
    }
  }
  if (probe.syntheticActions && probe.visualChangedAfterInput === false) {
    checks.push({
      entryId: "bench-no-action-response",
      errorCode: "NO_ACTION_RESPONSE",
      message: "Synthetic tap and keyboard inputs did not change the rendered frame",
      rootCause: "The first action has no observable feedback in the real runtime",
      fix: {
        type: "edit",
        description: "Bind the primary input and make its first action visibly change game state.",
        patch: "Handle scene.input pointerdown and/or keyboard input; update actor position, score, animation, or particle feedback.",
      },
    });
  }
  return checks;
}

export function agenticBenchPath(baseUrl: string, payload: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/qa/agentic-bench?payload=${encodeURIComponent(payload)}`;
}

/** Node 侧 Playwright 探测（需 dev server；见 scripts/qa-opengame-browser-bench.ts） */
export async function runAgenticBrowserBench(
  page: {
    goto(url: string, opts?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
    waitForFunction(fn: () => boolean, arg?: unknown, opts?: { timeout?: number }): Promise<unknown>;
    evaluate<T>(fn: () => T): Promise<T>;
    locator(sel: string): { waitFor(opts?: { timeout?: number }): Promise<unknown>; click(opts?: { position?: { x: number; y: number } }): Promise<void> };
    mouse?: { click(x: number, y: number): Promise<void> };
    keyboard?: { press(key: string): Promise<void>; down(key: string): Promise<void>; up(key: string): Promise<void> };
    waitForTimeout?: (timeout: number) => Promise<void>;
  },
  spec: GameSpec,
  module: AgenticGameModule,
  baseUrl: string,
): Promise<{ ok: true; probe: AgenticBrowserBenchProbe } | { ok: false; probe: AgenticBrowserBenchProbe; checks: DebugCheckResult[] }> {
  const payload = encodeAgenticBenchPayload(buildSpecForAgenticBench(spec, module));
  const url = agenticBenchPath(baseUrl, payload);

  await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 }).catch(async () => {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  });
  await page.locator('[data-testid="agentic-bench-host"]').waitFor({ timeout: 45_000 });
  await page.waitForFunction(
    () => {
      const p = window.__OPERONE_AGENTIC_BENCH__;
      return p?.status === "done" || p?.status === "error";
    },
    undefined,
    { timeout: 90_000 },
  );

  const probe = await page.evaluate(() => window.__OPERONE_AGENTIC_BENCH__ ?? { status: "error" as const });

  // This is intentionally generic: every runtime receives the same primary
  // pointer and keyboard sequence. It proves that the generated module reacts
  // to real browser input rather than merely drawing a non-empty first frame.
  if (probe.status === "done") {
    const before = await page.evaluate(() => {
      const canvas = document.querySelector('[data-testid="agentic-bench-host"] canvas') as HTMLCanvasElement | null;
      if (!canvas) return null;
      const pixels = canvas.toDataURL("image/png");
      let hash = 2166136261;
      const stride = Math.max(1, Math.floor(pixels.length / 2048));
      for (let index = 0; index < pixels.length; index += stride) hash = Math.imul(hash ^ pixels.charCodeAt(index), 16777619);
      const rect = canvas.getBoundingClientRect();
      return { fingerprint: (hash >>> 0).toString(16), x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });
    if (before && page.mouse && page.keyboard) {
      await page.locator('[data-testid="agentic-bench-host"]').click();
      await page.mouse.click(before.x, before.y);
      await page.mouse.click(before.x, before.y);
      await page.keyboard.press("ArrowRight");
      await page.keyboard.down("Space");
      if (page.waitForTimeout) await page.waitForTimeout(160);
      const after = await page.evaluate(() => {
        const canvas = document.querySelector('[data-testid="agentic-bench-host"] canvas') as HTMLCanvasElement | null;
        if (!canvas) return null;
        const pixels = canvas.toDataURL("image/png");
        let hash = 2166136261;
        const stride = Math.max(1, Math.floor(pixels.length / 2048));
        for (let index = 0; index < pixels.length; index += stride) hash = Math.imul(hash ^ pixels.charCodeAt(index), 16777619);
        return (hash >>> 0).toString(16);
      });
      await page.keyboard.up("Space");
      probe.syntheticActions = 6;
      probe.beforeFrameFingerprint = before.fingerprint;
      probe.afterFrameFingerprint = after ?? undefined;
      probe.visualChangedAfterInput = Boolean(after && after !== before.fingerprint);
      await page.evaluate(() => {
        const current = window.__OPERONE_AGENTIC_BENCH__;
        if (current) Object.assign(current, { status: current.status });
      });
    }
  }

  const checks = browserBenchToDebugChecks(probe);
  if (checks.length || probe.status === "error") {
    return { ok: false, probe, checks };
  }
  return { ok: true, probe };
}
