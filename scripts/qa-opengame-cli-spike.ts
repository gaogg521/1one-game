/**
 * Phase B：OpenGame CLI 子进程 spike 离线 QA
 * npm run qa:opengame-cli-spike
 */
import {
  isOpenGameCliEnabled,
  probeOpenGameCli,
  readOpenGameCliConfig,
  runOpenGameCliHeadless,
} from "@/lib/opengame-skills/opengame-cli";

async function main() {
  const failures: string[] = [];

  const cfg = readOpenGameCliConfig();
  if (cfg.command !== "opengame") {
    failures.push("default command should be opengame");
  }
  if (!cfg.workDir.includes(".tmp-opengame")) {
    failures.push("default workDir should use .tmp-opengame");
  }

  const prevCli = process.env.OPENGAME_CLI;
  const prevDry = process.env.OPENGAME_CLI_DRY_RUN;
  delete process.env.OPENGAME_CLI;
  const skipped = await runOpenGameCliHeadless("probe skip");
  if (!skipped.skipped) {
    failures.push("should skip when OPENGAME_CLI unset");
  }

  process.env.OPENGAME_CLI = "1";
  process.env.OPENGAME_CLI_DRY_RUN = "1";
  const dry = await runOpenGameCliHeadless("Build a tiny platformer.", { force: true });
  if (dry.skipped || !dry.ok || !("dryRun" in dry) || !dry.dryRun) {
    failures.push("dry-run should succeed without spawn");
  }

  const fakeProbe = await probeOpenGameCli("nonexistent-opengame-operone-qa-cmd");
  if (fakeProbe.available) {
    failures.push("fake command should not probe available");
  }

  if (isOpenGameCliEnabled() !== true) {
    failures.push("isOpenGameCliEnabled should be true when OPENGAME_CLI=1");
  }

  if (prevCli === undefined) delete process.env.OPENGAME_CLI;
  else process.env.OPENGAME_CLI = prevCli;
  if (prevDry === undefined) delete process.env.OPENGAME_CLI_DRY_RUN;
  else process.env.OPENGAME_CLI_DRY_RUN = prevDry;

  if (failures.length) {
    console.error("[FAIL] qa-opengame-cli-spike");
    for (const f of failures) console.error(" -", f);
    process.exit(1);
  }

  console.log("[OK] qa-opengame-cli-spike: config, skip, dry-run, probe");
}

void main();
