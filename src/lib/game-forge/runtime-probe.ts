import type { GameBuild, GameDesignDoc, QaFinding } from "@/lib/game-forge/types";
import { GAME_FORGE_SDK_SOURCE } from "@/lib/game-forge/runtime-sdk";
import { playerEvidenceFindings } from "./player-evidence";

/**
 * Headless runtime probe.
 *
 * Until now `QaReport.observed` was permanently false and every real-execution
 * check in this project was performed by hand. That is exactly how the two
 * worst defects survived their audits: a module whose braces balanced but
 * which did not parse took down the whole script block, and two core systems
 * that read an unprovided `G.player` returned on every frame — the build drew
 * a frame, threw nothing, and the deterministic audit was green while the game
 * did nothing at all.
 *
 * Booting the assembled page and watching what it emits turns those into
 * findings the pipeline can act on: whether it mounted, whether it rendered,
 * whether input changes anything, whether it can end.
 */

export type RuntimeProbeResult = {
  /** True only when a browser actually executed the build. */
  observed: boolean;
  /** Why the probe could not run, when it could not. */
  unavailable?: string;
  booted: boolean;
  firstFrameMs: number | null;
  frames: number;
  maxEntities: number;
  /** Score after the scripted input burst; proves input reaches gameplay. */
  scoreAfterInput: number | null;
  /** Set when the run reached a win or lose. */
  ended: { won: boolean; score: number } | null;
  errors: string[];
  findings: QaFinding[];
  durationMs: number;
};

/** Page shape matching the production iframe srcDoc, plus a capture harness. */
export function buildProbePage(build: GameBuild, assets: Record<string, string>): string {
  const ctx = { title: build.design.title, prompt: build.design.pitch, winScore: 20, assets };
  const safeSource = build.source.replace(/<\/script/gi, "<\\/script");
  const safeSdk = GAME_FORGE_SDK_SOURCE.replace(/<\/script/gi, "<\\/script");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body,#game{margin:0;width:100%;height:100%;overflow:hidden;background:#06130e}*{box-sizing:border-box}</style></head>
<body><main id="game"></main>
<script>${safeSdk}</script>
<script>
/* The capture harness lives in its OWN script block on purpose. A parse error
   anywhere in a block kills that entire block, so putting the collector beside
   the generated source would mean an unparseable build produced no evidence at
   all — the probe would report "nothing happened" instead of "it cannot
   parse", which is the difference between a finding and a blind spot. */
window.__probe = { events: [], errors: [] };
window.addEventListener('error', function (e) { window.__probe.errors.push(String(e.message)); });
window.addEventListener('unhandledrejection', function (e) { window.__probe.errors.push('unhandled rejection: ' + String(e.reason)); });
window.addEventListener('message', function (e) { if (e.data && e.data.type) window.__probe.events.push(e.data); });
</script>
<script>
var ctx = ${JSON.stringify(ctx).replace(/</g, "\\u003c")};
ctx.finish = function (won, score) { window.__probe.events.push({ type: 'operone-game-end', won: !!won, score: Number(score) || 0 }); };
ctx.reportError = function (e) { window.__probe.errors.push(String(e && e.message ? e.message : e)); };
try {
${safeSource}
;if (typeof mountGame !== 'function') throw new Error('mountGame missing');
mountGame(document.getElementById('game'), ctx);
} catch (error) { ctx.reportError(error); }
</script></body></html>`;
}

type ProbeSnapshot = {
  events: Array<{ type: string; [k: string]: unknown }>;
  errors: string[];
};

/**
 * The probe waits for evidence, not for a clock.
 *
 * A fixed sleep either wastes seconds on a healthy build or reads the game
 * before its next heartbeat and mistakes "no data yet" for "nothing happened".
 * Both bounds below are ceilings that a responsive build never reaches.
 */
const SETTLE_MS = 2_500;
/**
 * How long the probe keeps watching a build that has shown no sign of life.
 *
 * Only a build with nothing to report waits this long: the watch resolves the
 * moment an entity, a score change or an outcome appears. That asymmetry is
 * deliberate. Cutting the window to a flat two seconds made the probe fast and
 * wrong -- a game whose first wave spawns on a timer had zero entities at
 * frame 120 and was reported inert, which would have sent a working build into
 * a repair round that can only make it worse.
 */
const LIFE_MS = 6_000;

export async function runRuntimeProbe(
  build: GameBuild,
  opts: { assets?: Record<string, string>; headless?: boolean } = {},
): Promise<RuntimeProbeResult> {
  const t0 = Date.now();
  const empty = (unavailable: string): RuntimeProbeResult => ({
    observed: false,
    unavailable,
    booted: false,
    firstFrameMs: null,
    frames: 0,
    maxEntities: 0,
    scoreAfterInput: null,
    ended: null,
    errors: [],
    findings: [],
    durationMs: Date.now() - t0,
  });

  let chromium: typeof import("playwright").chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch (e) {
    // Playwright is a dev dependency; a deployment without it degrades to the
    // deterministic audit rather than failing the build.
    return empty(`playwright unavailable: ${(e as Error).message.slice(0, 120)}`);
  }

  let browser: import("playwright").Browser | null = null;
  try {
    browser = await chromium.launch({ headless: opts.headless !== false });
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    await page.setContent(buildProbePage(build, opts.assets ?? {}), { waitUntil: "load" });

    // Never assume the harness is there: if the generated block failed to
    // parse the browser may still be mid-teardown.
    const readProbe = () => page.evaluate<ProbeSnapshot>("window.__probe || { events: [], errors: [] }");
    const beats = () =>
      page
        .waitForFunction(
          "(window.__probe ? window.__probe.events.filter(function (e) { return e.type === 'forge-heartbeat'; }).length : 0) > 0",
          undefined,
          { timeout: SETTLE_MS },
        )
        .catch(() => undefined);

    // A build that never beats is a finding, not an error: fall through with
    // whatever it did emit and let summarise() name what is missing.
    await beats();
    const beforeInput = await readProbe();
    const beatsBefore = beforeInput.events.filter((e) => e.type === "forge-heartbeat").length;

    // A scripted burst across the control surface the SDK exposes. The point
    // is not to play well, it is to prove input reaches gameplay at all.
    if (await page.locator("canvas").count()) await page.locator("canvas").first().click();
    for (const key of ["ArrowRight", "ArrowLeft", "ArrowUp"]) {
      await page.keyboard.down(key);
      await page.waitForTimeout(700);
      await page.keyboard.up(key);
    }
    for (const key of ["Space", "ArrowUp", "ArrowLeft", "Space"]) {
      await page.keyboard.press(key);
      await page.waitForTimeout(180);
    }
    await page.mouse.move(300, 300);
    await page.mouse.down();
    await page.mouse.move(500, 260, { steps: 8 });
    await page.mouse.up();

    // Watch for the game to do something -- anything. Resolves immediately on
    // the first sign of life, so a healthy build costs a heartbeat and a
    // genuinely inert one costs the full ceiling before it is called inert.
    const scoreBefore = lastHeartbeat(beforeInput.events)?.score ?? 0;
    await page
      .waitForFunction(
        `(function () {
           var p = window.__probe; if (!p) return false;
           if (p.events.some(function (e) { return e.type === 'forge-end' || e.type === 'operone-game-end'; })) return true;
           var beats = p.events.filter(function (e) { return e.type === 'forge-heartbeat'; });
           if (beats.length <= ${beatsBefore}) return false;
           var last = beats[beats.length - 1];
           return (last.entities || 0) > 0 || (last.score || 0) > ${scoreBefore};
         })()`,
        undefined,
        { timeout: LIFE_MS },
      )
      .catch(() => undefined);

    const after = await readProbe();
    await browser.close();
    browser = null;

    return summarise(build.design, before(beforeInput), after, Date.now() - t0);
  } catch (e) {
    if (browser) await browser.close().catch(() => undefined);
    return empty(`probe failed: ${(e as Error).message.slice(0, 160)}`);
  }
}

function before(snapshot: ProbeSnapshot): ProbeSnapshot {
  return snapshot;
}

function lastHeartbeat(events: ProbeSnapshot["events"]): { frames?: number; entities?: number; score?: number } | null {
  const beats = events.filter((e) => e.type === "forge-heartbeat");
  return (beats[beats.length - 1] as { frames?: number; entities?: number; score?: number } | undefined) ?? null;
}

function summarise(
  design: GameDesignDoc,
  beforeInput: ProbeSnapshot,
  after: ProbeSnapshot,
  durationMs: number,
): RuntimeProbeResult {
  const events = after.events;
  const booted = events.some((e) => e.type === "forge-boot");
  const firstFrame = events.find((e) => e.type === "forge-first-frame") as { atMs?: number } | undefined;
  const beat = lastHeartbeat(events);
  const endEvent = events.find((e) => e.type === "forge-end" || e.type === "operone-game-end") as
    | { won?: unknown; score?: unknown }
    | undefined;
  const errors = [
    ...after.errors,
    ...events.filter((e) => e.type === "forge-error" || e.type === "operone-game-error").map((e) => String(e.message ?? "runtime error")),
  ];
  const uniqueErrors = Array.from(new Set(errors));

  const scoreBefore = lastHeartbeat(beforeInput.events)?.score ?? 0;
  const scoreAfter = beat?.score ?? null;
  const findings: QaFinding[] = playerEvidenceFindings(design, events);

  if (uniqueErrors.length) {
    for (const message of uniqueErrors.slice(0, 4)) {
      findings.push({ severity: "blocker", moduleId: "assembled", code: "runtime_error", message: `the running build threw: ${message}` });
    }
  }
  if (!booted) {
    findings.push({
      severity: "blocker",
      moduleId: "assembled",
      code: "did_not_boot",
      message: "the build never reached g.start() in a real browser — nothing mounted, so the player sees a blank frame",
    });
  } else if (!firstFrame) {
    findings.push({
      severity: "blocker",
      moduleId: "assembled",
      code: "no_first_frame",
      message: "the build mounted but never rendered a frame",
    });
  }

  const frames = beat?.frames ?? 0;
  if (booted && firstFrame && frames < 60) {
    findings.push({
      severity: "major",
      moduleId: "assembled",
      code: "loop_stalled",
      message: `only ${frames} frames rendered in ${Math.round(durationMs / 1000)}s — the loop is stalling or throwing inside update`,
    });
  }

  // A build can boot, render and still be inert: the exact shape of the
  // `G.player` defect, where every system returned on the first line.
  const inputDidSomething = scoreAfter !== null && scoreAfter > scoreBefore;
  const spawnedSomething = (beat?.entities ?? 0) > 0;
  if (booted && firstFrame && !uniqueErrors.length && !inputDidSomething && !spawnedSomething && !endEvent) {
    findings.push({
      severity: "major",
      moduleId: "assembled",
      code: "inert_build",
      message: `after a scripted input burst nothing changed: no entities, no score, no outcome. "${design.progression.winCondition}" is unlikely to be reachable by a player`,
    });
  }

  return {
    observed: true,
    booted,
    firstFrameMs: typeof firstFrame?.atMs === "number" ? Math.round(firstFrame.atMs) : null,
    frames,
    maxEntities: beat?.entities ?? 0,
    scoreAfterInput: scoreAfter,
    ended: endEvent ? { won: Boolean(endEvent.won), score: Number(endEvent.score) || 0 } : null,
    errors: uniqueErrors,
    findings,
    durationMs,
  };
}
