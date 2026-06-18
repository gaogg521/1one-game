/**
 * Phase B：OpenGame CLI 实机 + bridge（无真实 opengame 时用 QA stub）
 * npm run qa:opengame-cli-live
 *
 * 输出：qa-output/opengame-cli-live/summary.json
 */
import fs from "node:fs";
import path from "node:path";
import { runDebugSkillPipeline } from "@/lib/opengame-skills/debug-skill";
import { bridgeOpenGameCliWorkDir } from "@/lib/opengame-skills/opengame-cli-bridge";
import {
  probeOpenGameCli,
  resetOpenGameCliResolutionCache,
  runOpenGameCliHeadless,
} from "@/lib/opengame-skills/opengame-cli";

const fixtureRoot = path.join(process.cwd(), "scripts/fixtures/opengame-cli-bridge");
const OUT = path.join(process.cwd(), "qa-output", "opengame-cli-live");

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const failures: string[] = [];
  let mode: "live-cli" | "qa-stub" | "fixture-only" = "fixture-only";
  let cliLabel = "—";

  resetOpenGameCliResolutionCache();
  let probe = await probeOpenGameCli();

  if (!probe.available && process.env.OPENGAME_CLI_ALLOW_STUB !== "0") {
    process.env.OPENGAME_CLI_STUB = "1";
    resetOpenGameCliResolutionCache();
    probe = await probeOpenGameCli();
  }

  console.log(`[info] CLI probe available=${probe.available} label=${probe.label ?? "—"} error=${probe.error ?? "—"}`);

  if (probe.available) {
    mode = probe.label === "qa-stub" ? "qa-stub" : "live-cli";
    cliLabel = probe.label ?? "unknown";
    process.env.OPENGAME_CLI = "1";
    process.env.OPENGAME_CLI_DRY_RUN = "0";
    const prompt = "simple physics dummy tap game";
    const run = await runOpenGameCliHeadless(prompt, { runId: "qa-cli-live", force: true });
    if (run.skipped || !run.ok) {
      failures.push(`headless run failed: ${run.skipped ? run.reason : run.error ?? "exit"}`);
    } else if ("workDir" in run && run.workDir) {
      const bridge = bridgeOpenGameCliWorkDir(run.workDir);
      if (!bridge.ok) failures.push(`bridge failed: ${bridge.reason}`);
      else {
        const lint = runDebugSkillPipeline(bridge.module);
        if (!lint.ok) failures.push(`debug skill: ${lint.stage}:${lint.reason}`);
        else console.log(`[OK] ${mode} → bridge (${bridge.strategy})`);
      }
    }
  } else {
    console.log("[skip] opengame CLI not installed — fixture bridge fallback");
    const native = path.join(fixtureRoot, "native-create-game");
    const bridge = bridgeOpenGameCliWorkDir(native);
    if (!bridge.ok) failures.push(`fixture bridge: ${bridge.reason}`);
    else console.log("[OK] fixture bridge fallback");
  }

  const summary = {
    at: new Date().toISOString(),
    mode,
    cliLabel,
    probeAvailable: probe.available,
    pass: failures.length === 0,
    failures,
  };
  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2), "utf8");

  if (failures.length) {
    console.error("[FAIL] qa-opengame-cli-live");
    failures.forEach((f) => console.error(" -", f));
    process.exit(1);
  }
  console.log(`[OK] qa-opengame-cli-live (${mode})`);
}

void main();
