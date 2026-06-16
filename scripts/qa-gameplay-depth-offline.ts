/**
 * 玩法深度断言离线校验（旗舰样品字段映射 + 用例对齐）
 * npm run qa:gameplay-depth-offline
 */
import fs from "node:fs";
import path from "node:path";
import { validateGameplayDepthOffline } from "@/lib/qa/gameplay-depth";
import { STRICT_VISUAL_SAMPLE_IDS } from "@/lib/qa/canvas-image-parity";
import { validateSampleGameplayCasesOffline } from "@/lib/qa/sample-gameplay-interaction";
import { SAMPLES } from "@/lib/samples";
import { buildCanonicalAstrocadeSpec } from "@/lib/astrocade-canonical-spec";
import { sampleProjectId } from "@/lib/sample-gallery";
import { runtimeSeedFromSpec } from "@/lib/runtime-seed";

const SPRITE_KINDS = ["player", "hazard", "gem", "power", "boss"] as const;

const depthFailures = validateGameplayDepthOffline();
const caseFailures = validateSampleGameplayCasesOffline();

const seedFailures: string[] = [];
for (const s of SAMPLES) {
  const a = buildCanonicalAstrocadeSpec(s.prompt, "zh-Hans", { sampleId: s.id });
  const b = { ...a, title: `${a.title}（副本）` };
  if (runtimeSeedFromSpec(a) !== runtimeSeedFromSpec(b)) {
    seedFailures.push(`${s.id}: duplicate title changes runtime seed`);
  }
}

const assetFailures: string[] = [];
for (const s of SAMPLES) {
  const projectId = sampleProjectId(s.id);
  for (const kind of SPRITE_KINDS) {
    const spritePath = path.join(process.cwd(), "public", "game-sprites", projectId, `${kind}.png`);
    if (!fs.existsSync(spritePath)) assetFailures.push(`missing sprite: ${projectId}/${kind}.png`);
  }
  const bgPath = path.join(process.cwd(), "public", "game-bg", `${projectId}.png`);
  if (!fs.existsSync(bgPath)) assetFailures.push(`missing background: ${projectId}.png`);
}

const all = [...depthFailures, ...caseFailures, ...seedFailures, ...assetFailures];
if (all.length) {
  console.error("[FAIL] qa:gameplay-depth-offline:\n" + all.join("\n"));
  process.exit(1);
}

console.log(
  `qa:gameplay-depth-offline: ok (depth=${SAMPLES.length} strictVisual=${STRICT_VISUAL_SAMPLE_IDS.size} seed=${SAMPLES.length} assets=${SAMPLES.length})`,
);
