/**
 * 全局 canonical spec 门禁：样品显式 seed 保持稳定；用户传入的完整 spec
 * 保留其玩法决策，不能只因 prompt 命中样品关键词而被换成样品模板。
 * npm run qa:spec-canonical-parity
 */
import { buildCanonicalAstrocadeSpec } from "../src/lib/astrocade-canonical-spec";
import { mockSpecFromPrompt } from "../src/lib/mock-spec";
import { prepareGameSpecForPersist } from "../src/lib/spec-patch";
import { SAMPLES } from "../src/lib/samples";
import { expectedPhaserSceneName } from "../src/lib/game-templates/runtime";

function stableKey(spec: ReturnType<typeof buildCanonicalAstrocadeSpec>): string {
  const { agenticModule: _a, ...rest } = spec;
  return JSON.stringify(rest);
}

function main() {
  console.log("# qa:spec-canonical-parity — 全局 canonical spec\n");
  let ok = 0;
  for (const s of SAMPLES) {
    const sampleSpec = buildCanonicalAstrocadeSpec(s.prompt, "zh-Hans", { sampleId: s.id });
    const a = stableKey(sampleSpec);
    const replay = stableKey(buildCanonicalAstrocadeSpec(s.prompt, "zh-Hans", { sampleId: s.id }));
    if (a !== replay) {
      console.error(`[FAIL] ${s.id} explicit sample seed is not deterministic`);
      process.exit(1);
    }
    console.log(`[OK] ${s.id} → ${expectedPhaserSceneName(sampleSpec)} · ${sampleSpec.samplePlayProfile?.variantId}`);
    ok += 1;
  }
  console.log(`\n✓ spec canonical parity ${ok}/${SAMPLES.length}`);

  const postOk = SAMPLES.every((s) => {
    const supplied = mockSpecFromPrompt(s.prompt);
    const viaPost = prepareGameSpecForPersist(supplied, s.prompt, "zh-Hans");
    return viaPost.templateId === supplied.templateId;
  });
  if (!postOk) {
    console.error("[FAIL] prepareGameSpecForPersist replaced explicit user gameplay identity");
    process.exit(1);
  }
  console.log("[OK] POST persist path preserves explicit user gameplay identity");

  const tuned = mockSpecFromPrompt("打击 dummy 假人解压");
  tuned.gameplay.winScore = 199;
  tuned.samplePlayProfile = {
    ...(tuned.samplePlayProfile ?? { variantId: "delivery-physics" }),
    variantId: tuned.samplePlayProfile?.variantId ?? "delivery-physics",
    physics: { ...(tuned.samplePlayProfile?.physics ?? {}), targetHits: 999 },
  };
  const persistedTuned = prepareGameSpecForPersist(tuned, "打击 dummy 假人解压", "zh-Hans");
  if (persistedTuned.gameplay.winScore !== 199 || persistedTuned.samplePlayProfile?.physics?.targetHits !== 999) {
    console.error("[FAIL] persisted user tuning was replaced by inferred sample defaults");
    process.exit(1);
  }
  console.log("[OK] inferred sample keywords do not replace explicit user tuning");
}

main();
