/**
 * 14 款竞品样品 clone 可玩度断言（离线，无需 dev）
 * npm run qa:competitor-clone-checks-offline
 */
import assert from "node:assert/strict";
import { buildCanonicalAstrocadeSpec } from "@/lib/astrocade-canonical-spec";
import { expectedPhaserSceneName } from "@/lib/game-templates/runtime";
import {
  buildCompetitorClonePlayabilityChecks,
  EXPECTED_SCENE_BY_SAMPLE,
  playabilityChecksPass,
} from "@/lib/qa/competitor-clone-playability-checks";
import { SAMPLE_PLAY_PROFILES } from "@/lib/sample-play-profiles/registry";
import { SAMPLES } from "@/lib/samples";

assert.equal(
  Object.keys(SAMPLE_PLAY_PROFILES).length,
  SAMPLES.length,
  "SAMPLE_PLAY_PROFILES 须覆盖全部 SAMPLES",
);

const failures: string[] = [];

for (const sample of SAMPLES) {
  const spec = buildCanonicalAstrocadeSpec(sample.prompt, "zh-Hans", { sampleId: sample.id });
  const scene = expectedPhaserSceneName(spec);
  const expected = EXPECTED_SCENE_BY_SAMPLE[sample.id];
  if (expected && scene !== expected) {
    failures.push(`${sample.id}: scene ${scene} !== ${expected}`);
    continue;
  }
  const checks = buildCompetitorClonePlayabilityChecks(sample, spec);
  if (!playabilityChecksPass(checks)) {
    const bad = Object.entries(checks)
      .filter(([, v]) => !v)
      .map(([k]) => k)
      .join(", ");
    failures.push(`${sample.id}: ${bad}`);
  }
}

if (failures.length) {
  console.error("[FAIL] competitor-clone-checks-offline:\n" + failures.join("\n"));
  process.exit(1);
}

console.log(`qa:competitor-clone-checks-offline: ok (${SAMPLES.length}/${SAMPLES.length})`);
