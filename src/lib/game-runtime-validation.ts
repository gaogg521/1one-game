import { createHash } from "node:crypto";
import type { GameSpec } from "@/lib/game-spec";
import { GameDesignDocSchema, type GameModule, type QaReport } from "@/lib/game-forge/types";
import { buildIndependentRuntimePage, independentRuntimeContext } from "@/lib/independent-runtime-page";
import { playerEvidenceFindings } from "@/lib/game-forge/player-evidence";
import { assembleGame } from "@/lib/game-forge/assemble";

export type GameRuntimeValidation = {
  version: 1;
  status: "passed" | "failed" | "unverified";
  sourceHash: string;
  observed: boolean;
  blockers: string[];
  evidence: string[];
};

export function runtimeSourceHash(spec: GameSpec, projectId?: string): string {
  return createHash("sha256").update(buildIndependentRuntimePage(spec, projectId)).digest("hex");
}

/**
 * Only findings that prove an objective execution failure may cross from the
 * earlier Forge probe into the delivery gate. Its inert/stalled findings are
 * short-window heuristics: generated games may draw their own entities instead
 * of populating SDK counters, so the exact player iframe probe below owns those
 * decisions using frame progression and screenshots.
 */
export const HARD_RUNTIME_FINDINGS = new Set(["did_not_boot", "no_first_frame", "runtime_error"]);
export const HARD_PLAYER_FINDINGS = new Set(["player_not_visible", "player_input_no_visible_response"]);

export function runtimeValidationBlockers(spec: GameSpec, validation?: GameRuntimeValidation | null, projectId?: string): string[] {
  if (!spec.agenticModule?.source?.trim()) return ["independent_runtime_missing"];
  if (!validation || !Array.isArray(validation.blockers) || validation.sourceHash !== runtimeSourceHash(spec, projectId)) return ["runtime_verification_missing_or_stale"];
  if (!validation.observed || validation.status === "unverified") return ["runtime_verification_unavailable"];
  if (validation.status !== "passed" || validation.blockers.length) return validation.blockers.length ? validation.blockers : ["runtime_execution_failed"];
  return [];
}

/** Exercises the exact sandboxed iframe sent to players, for Forge and legacy builds. */
/**
 * `onFrame` receives the post-interaction frame of the real delivery iframe.
 * It is handed out rather than returned because this report is persisted as an
 * artifact, and a screenshot has no business being stored inside it.
 */
export async function validateGameRuntime(spec: GameSpec, projectId?: string, forgeQa?: QaReport | null, onFrame?: (png: Buffer) => void): Promise<GameRuntimeValidation> {
  const sourceHash = runtimeSourceHash(spec, projectId);
  const result: GameRuntimeValidation = { version: 1, status: "unverified", sourceHash, observed: false, blockers: [], evidence: [] };
  if (spec.forgeBuild) {
    const parsedDesign = GameDesignDocSchema.safeParse(spec.forgeBuild.design);
    const storedModules = Array.isArray(spec.forgeBuild.modules) ? spec.forgeBuild.modules as GameModule[] : [];
    if (parsedDesign.success && storedModules.length) {
      const currentStaticFindings = assembleGame(parsedDesign.data, storedModules).findings.filter((finding) => finding.severity === "blocker");
      // Forge still uses these findings to repair the build. Final delivery is
      // decided by the exact player iframe below, so static quality heuristics
      // remain visible evidence instead of becoming a second hard gate.
      result.evidence.push(`staticAdvisories:${currentStaticFindings.length}`);
      result.evidence.push(...currentStaticFindings.map((finding) => `advisory:${finding.code}`));
    }
  }
  let browser: import("playwright").Browser | undefined;
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: true, timeout: 15_000 });
    const page = await browser.newPage({ viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true });
    page.setDefaultTimeout(10_000);
    // Parent listener precedes iframe navigation. Messages from other frames are ignored.
    const probeUrl = `http://127.0.0.1:${process.env.PORT || 8888}/__runtime_validation`;
    await page.route(probeUrl, route => route.fulfill({ contentType: "text/html", body: '<html><body style="margin:0"><script>window.events=[];window.addEventListener("message",e=>{if(e.source===document.querySelector("iframe")?.contentWindow)window.events.push(e.data)})</script><iframe sandbox="allow-scripts" style="width:393px;height:852px;border:0"></iframe></body></html>' }));
    await page.goto(probeUrl);
    await page.locator("iframe").evaluate((element, src) => { (element as HTMLIFrameElement).srcdoc = src; }, buildIndependentRuntimePage(spec, projectId));
    await page.waitForFunction("window.events.some(e=>e.type==='forge-heartbeat'||e.type==='operone-game-error'||e.type==='operone-game-mounted')", undefined, { timeout: 10_000 }).catch(() => undefined);
    const frame = page.frames().find((item) => item !== page.mainFrame());
    const before = await page.locator("iframe").screenshot({ timeout: 10_000 });
    await page.locator("iframe").tap({ position: { x: 180, y: 280 } });
    for (const key of ["ArrowRight", "ArrowLeft", "ArrowUp"]) {
      await page.keyboard.down(key);
      await page.waitForTimeout(700);
      await page.keyboard.up(key);
    }
    await page.keyboard.press("Space");
    await page.waitForTimeout(2500);
    /*
     * Everything above proves the game MOVES. None of it proves the game can be
     * PLAYED. A build was shipped that ran at 60fps with correct art, spawned
     * entities, played sound, and let the player steer -- and whose score never
     * changed, whose hazards never hurt, and whose clock reached zero without
     * resolving. Every existing check passed it. So drive the ship across the
     * play area and watch whether the core loop ever resolves.
     */
    const sweepUntil = Date.now() + 12_000;
    const iframeBox = await page.locator("iframe").boundingBox();
    if (iframeBox) {
      const y = iframeBox.y + iframeBox.height * 0.82;
      let phase = 0;
      await page.mouse.move(iframeBox.x + iframeBox.width / 2, y);
      await page.mouse.down();
      while (Date.now() < sweepUntil) {
        phase += 0.22;
        const x = iframeBox.x + iframeBox.width * (0.5 + Math.sin(phase) * 0.42);
        await page.mouse.move(x, y);
        await page.waitForTimeout(70);
      }
      await page.mouse.up();
      // A drag across a DOM-based build selects its text, and that highlight is
      // a pixel change -- which would let a completely inert build pass the
      // before/after comparison below on the strength of the probe's own input.
      await frame?.evaluate(() => window.getSelection()?.removeAllRanges()).catch(() => undefined);
    }
    const after = await page.locator("iframe").screenshot({ timeout: 10_000 });
    if (onFrame) {
      try { onFrame(after); } catch { /* a reviewer failing must not fail delivery */ }
    }
    const events = await page.evaluate<Array<{ type: string; frames?: number; entities?: number; message?: string; score?: number }>>("window.events");
    /*
     * "It moved" is not "it played". A game whose design declares a score to
     * reach and a way to lose must, under driven input, either move its score or
     * reach an ending. Neither happening means the core loop never resolves --
     * the player steers a pretty screensaver. Advisory, because the build is
     * still worth shipping while the platform repairs it.
     */
    if (spec.forgeBuild) {
      const parsedDesign = GameDesignDocSchema.safeParse(spec.forgeBuild.design);
      const progression = parsedDesign.success ? parsedDesign.data.progression : null;
      const scoreDriven = Boolean(progression && /\d/.test(`${progression.winCondition}${progression.loseCondition}`));
      const beats = events.filter((e) => e.type === "forge-heartbeat");
      const scores = beats.map((e) => Number(e.score ?? 0)).filter((n) => Number.isFinite(n));
      const scoreMoved = scores.length > 1 && Math.max(...scores) > Math.min(...scores);
      const resolved = events.some((e) => e.type === "forge-end" || e.type === "operone-game-end");
      result.evidence.push(`scoreObserved:${scores.length ? Math.max(...scores) : "none"}`);
      if (scoreDriven && beats.length >= 4 && !scoreMoved && !resolved) {
        result.evidence.push("advisory:core_loop_unresolved");
      }
    }
    /*
     * A landscape stage scaled into this portrait iframe leaves empty bands top
     * and bottom, which is what makes a generated game look unfinished on a
     * phone and shrinks the actor the player must track. Measure the drawn
     * surface against the screen it was delivered on. Advisory: a letterboxed
     * game is still playable, so this is repair evidence, not a publish gate.
     */
    const fill = await frame
      ?.evaluate(() => {
        const canvas = document.querySelector("canvas");
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const area = window.innerWidth * window.innerHeight;
        if (!area || !rect.width || !rect.height) return null;
        return Math.round(((rect.width * rect.height) / area) * 100);
      })
      .catch(() => null);
    if (typeof fill === "number") {
      result.evidence.push(`screenFillPct:${fill}`);
      if (fill < 70) result.evidence.push("advisory:runtime_letterboxed");
    }
    const errors = events.filter(e => e.type === "operone-game-error" || e.type === "forge-error");
    result.observed = true;
    if (projectId && spec.forgeBuild) {
      const assetContext = independentRuntimeContext(spec, projectId).assets;
      const parsedAssetDesign = GameDesignDocSchema.safeParse(spec.forgeBuild.design);
      const requiredSlots = parsedAssetDesign.success ? parsedAssetDesign.data.assets.filter((slot) => slot.required) : [];
      for (const slot of requiredSlots) {
        const assetPath = assetContext[slot.key];
        if (!assetPath) {
          result.evidence.push(`asset:${slot.key}:unmapped`);
          result.evidence.push(`advisory:required_asset_missing:${slot.key}`);
          continue;
        }
        const response = await page.request.get(new URL(assetPath, probeUrl).toString(), { timeout: 10_000 }).catch(() => null);
        const contentType = response?.headers()["content-type"] ?? "";
        const fallback = response?.headers()["x-operone-asset-fallback"] === "1";
        const ready = Boolean(response?.ok() && contentType.startsWith("image/") && !fallback);
        result.evidence.push(`asset:${slot.key}:${response?.status() ?? "error"}:${fallback ? "fallback" : contentType.split(";")[0] || "unknown"}`);
        if (!ready) result.evidence.push(`advisory:required_asset_missing:${slot.key}`);
      }
    }
    if (errors.length) result.blockers.push("runtime_error");
    const booted = events.some(e => e.type === "operone-game-mounted");
    if (!booted) result.blockers.push("runtime_did_not_boot");
    const beats = events.filter(e => e.type === "forge-heartbeat");
    const ended = events.some(e => e.type === "forge-end" || e.type === "operone-game-end");
    if (spec.forgeBuild) {
      if (!events.some(e => e.type === "forge-first-frame")) result.blockers.push("runtime_no_first_frame");
      if (!ended && (!beats.length || (beats.at(-1)?.frames ?? 0) <= (beats[0]?.frames ?? 0))) result.blockers.push("runtime_loop_stalled");
      for (const finding of playerEvidenceFindings(spec.forgeBuild.design, events)) {
        if (HARD_PLAYER_FINDINGS.has(finding.code)) result.blockers.push(`runtime_${finding.code}`);
        else result.evidence.push(`advisory:${finding.code}`);
      }
    }
    // Static DOM/puzzle games need no continuous loop, but must respond to interaction.
    if (booted && !ended && before.equals(after) && !beats.some(e => (e.entities ?? 0) > 0)) result.blockers.push("runtime_inert_build");
    if (forgeQa?.observed) {
      for (const finding of forgeQa.findings) {
        if (HARD_RUNTIME_FINDINGS.has(finding.code)) result.blockers.push(`runtime_${finding.code}`);
      }
    }
    result.blockers = [...new Set(result.blockers)];
    result.evidence = [...result.evidence, `sandbox:allow-scripts`, `viewport:393x852`, `mounted:${booted}`, `frames:${beats.at(-1)?.frames ?? 0}`, `visualChanged:${!before.equals(after)}`, `ended:${ended}`, `frameAttached:${Boolean(frame)}`, ...errors.slice(0, 4).map(e => `error:${String(e.message).slice(0, 240)}`)];
    result.status = result.blockers.length ? "failed" : "passed";
  } catch (error) {
    result.evidence.push(`probe_unavailable:${error instanceof Error ? error.message.split("\n")[0]?.slice(0, 200) : "unknown"}`);
  } finally {
    await browser?.close().catch(() => undefined);
  }
  return result;
}
