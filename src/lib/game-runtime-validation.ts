import { createHash } from "node:crypto";
import type { GameSpec } from "@/lib/game-spec";
import type { QaReport } from "@/lib/game-forge/types";
import { buildIndependentRuntimePage } from "@/lib/independent-runtime-page";

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

/** Only objective execution findings qualify; model and aesthetic reviews stay advisory. */
export const HARD_RUNTIME_FINDINGS = new Set(["did_not_boot", "no_first_frame", "runtime_error", "inert_build", "loop_stalled"]);

export function runtimeValidationBlockers(spec: GameSpec, validation?: GameRuntimeValidation | null, projectId?: string): string[] {
  if (!spec.agenticModule?.source?.trim()) return ["independent_runtime_missing"];
  if (!validation || !Array.isArray(validation.blockers) || validation.sourceHash !== runtimeSourceHash(spec, projectId)) return ["runtime_verification_missing_or_stale"];
  if (!validation.observed || validation.status === "unverified") return ["runtime_verification_unavailable"];
  if (validation.status !== "passed" || validation.blockers.length) return validation.blockers.length ? validation.blockers : ["runtime_execution_failed"];
  return [];
}

/** Exercises the exact sandboxed iframe sent to players, for Forge and legacy builds. */
export async function validateGameRuntime(spec: GameSpec, projectId?: string, forgeQa?: QaReport | null): Promise<GameRuntimeValidation> {
  const sourceHash = runtimeSourceHash(spec, projectId);
  const result: GameRuntimeValidation = { version: 1, status: "unverified", sourceHash, observed: false, blockers: [], evidence: [] };
  let browser: import("playwright").Browser | undefined;
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: true, timeout: 15_000 });
    const page = await browser.newPage({ viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true });
    page.setDefaultTimeout(10_000);
    // Parent listener precedes iframe navigation. Messages from other frames are ignored.
    const probeUrl = `http://127.0.0.1:${process.env.PORT || 8888}/__runtime_validation`;
    await page.route(probeUrl, route => route.fulfill({ contentType: "text/html", body: '<html><body style="margin:0"><script>window.events=[];window.addEventListener("message",e=>{if(e.source===document.querySelector("iframe")?.contentWindow)window.events.push(e.data)})</script><iframe sandbox="allow-scripts" style="width:393px;height:700px;border:0"></iframe></body></html>' }));
    await page.goto(probeUrl);
    await page.locator("iframe").evaluate((element, src) => { (element as HTMLIFrameElement).srcdoc = src; }, buildIndependentRuntimePage(spec, projectId));
    await page.waitForFunction("window.events.some(e=>e.type==='forge-heartbeat'||e.type==='operone-game-error'||e.type==='operone-game-mounted')", undefined, { timeout: 10_000 }).catch(() => undefined);
    const frame = page.frames().find((item) => item !== page.mainFrame());
    const before = await page.locator("iframe").screenshot({ timeout: 10_000 });
    await page.locator("iframe").tap({ position: { x: 180, y: 280 } });
    for (const key of ["Space", "ArrowRight", "ArrowUp", "Space"]) await page.keyboard.press(key);
    await page.waitForTimeout(2500);
    const after = await page.locator("iframe").screenshot({ timeout: 10_000 });
    const events = await page.evaluate<Array<{ type: string; frames?: number; entities?: number; message?: string }>>("window.events");
    const errors = events.filter(e => e.type === "operone-game-error" || e.type === "forge-error");
    result.observed = true;
    if (errors.length) result.blockers.push("runtime_error");
    const booted = events.some(e => e.type === "operone-game-mounted");
    if (!booted) result.blockers.push("runtime_did_not_boot");
    const beats = events.filter(e => e.type === "forge-heartbeat");
    const ended = events.some(e => e.type === "forge-end" || e.type === "operone-game-end");
    if (spec.forgeBuild) {
      if (!events.some(e => e.type === "forge-first-frame")) result.blockers.push("runtime_no_first_frame");
      if (!ended && (!beats.length || (beats.at(-1)?.frames ?? 0) <= (beats[0]?.frames ?? 0))) result.blockers.push("runtime_loop_stalled");
    }
    // Static DOM/puzzle games need no continuous loop, but must respond to interaction.
    if (booted && !ended && before.equals(after) && !beats.some(e => (e.entities ?? 0) > 0)) result.blockers.push("runtime_inert_build");
    if (forgeQa?.observed) {
      for (const finding of forgeQa.findings) {
        if (HARD_RUNTIME_FINDINGS.has(finding.code)) result.blockers.push(`runtime_${finding.code}`);
      }
    }
    result.blockers = [...new Set(result.blockers)];
    result.evidence = [`sandbox:allow-scripts`, `viewport:393x852`, `mounted:${booted}`, `frames:${beats.at(-1)?.frames ?? 0}`, `visualChanged:${!before.equals(after)}`, `ended:${ended}`, `frameAttached:${Boolean(frame)}`, ...errors.slice(0, 4).map(e => `error:${String(e.message).slice(0, 240)}`)];
    result.status = result.blockers.length ? "failed" : "passed";
  } catch (error) {
    result.evidence.push(`probe_unavailable:${error instanceof Error ? error.message.split("\n")[0]?.slice(0, 200) : "unknown"}`);
  } finally {
    await browser?.close().catch(() => undefined);
  }
  return result;
}
