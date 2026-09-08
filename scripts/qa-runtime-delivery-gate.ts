import assert from "node:assert/strict";
import { mockSpecFromPrompt } from "@/lib/mock-spec";
import { validateGameRuntime, runtimeValidationBlockers, runtimeSourceHash } from "@/lib/game-runtime-validation";
import { buildGameProductionRun } from "@/lib/game-production-orchestrator";
import { safeAssetError } from "@/lib/game-forge/asset-agent";

async function main() {
  const base = mockSpecFromPrompt("收集星星", { templateId: "survivor" });
  const spec = (source: string) => ({ ...base, agenticPlayRoute: "independent" as const, agenticModule: { version: 2 as const, entry: "mountGame" as const, source } });
  const good = spec("function mountGame(root,ctx){root.innerHTML='<button style=\"width:100%;height:600px\">收集星星</button>';root.firstChild.onpointerdown=()=>{root.firstChild.textContent='已收集';ctx.finish(true,1)}} // trailing comment");
  const report = await validateGameRuntime(good);
  assert.equal(report.status, "passed", JSON.stringify(report));
  const heuristicInertReport = await validateGameRuntime(good, undefined, {
    ok: true,
    observed: true,
    findings: [{ severity: "major", moduleId: "assembled", code: "inert_build", message: "SDK counters did not change in the short probe" }],
    evidence: ["probe:booted=true", "probe:frames=480", "probe:entities=0"],
  });
  assert.equal(heuristicInertReport.status, "passed", JSON.stringify(heuristicInertReport));
  const run = buildGameProductionRun({ spec: good, assetManifest: null, runtimeValidation: report });
  assert.equal(run.candidate.decision, "ready_for_playtest");
  assert.ok(run.candidate.advisories?.includes("visual_review_rejected"));
  assert.equal(buildGameProductionRun({ spec: good, assetManifest: null }).candidate.decision, "rejected");
  for (const [name, source] of [
    ["syntax", "function mountGame(root,ctx){ broken !!! }"],
    ["throw", "function mountGame(root,ctx){throw new Error('boot_failed')}"],
    ["inert", "function mountGame(root,ctx){root.textContent='nothing happens'}"],
  ]) {
    const bad = spec(source!);
    const failed = await validateGameRuntime(bad);
    assert.equal(failed.status, "failed", `${name}: ${JSON.stringify(failed)}`);
    assert.equal(buildGameProductionRun({ spec: bad, assetManifest: null, runtimeValidation: failed }).candidate.decision, "rejected");
    console.log(`[OK] ${name}: ${failed.blockers}`);
  }
  assert.ok(runtimeValidationBlockers(spec(good.agenticModule.source + "\n// changed"), report).length);
  assert.ok(runtimeValidationBlockers(good, { ...report, observed: false, status: "unverified" }).length);
  assert.notEqual(runtimeSourceHash(good, "a"), runtimeSourceHash(good, "b"));
  assert.doesNotMatch(safeAssetError("HTTP 401 api_key=abc123 https://example.com/?token=123 Bearer token123"), /abc123|token123|example/);
  console.log("[OK] real iframe delivery: good/bad/stale/unavailable; advisory quality stays advisory; asset errors redacted");
}
void main();
