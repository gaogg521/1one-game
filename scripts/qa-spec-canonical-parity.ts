/**
 * 全局 canonical spec 门禁：同 prompt → 样品 seed 与用户 POST 入库 spec 结构一致
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
    const userSpec = buildCanonicalAstrocadeSpec(s.prompt, "zh-Hans", {
      persistedSpec: mockSpecFromPrompt(s.prompt),
    });
    const a = stableKey(sampleSpec);
    const b = stableKey(userSpec);
    if (a !== b) {
      console.error(`[FAIL] ${s.id} canonical mismatch`);
      console.error(" sample", a.slice(0, 120));
      console.error(" user  ", b.slice(0, 120));
      process.exit(1);
    }
    console.log(`[OK] ${s.id} → ${expectedPhaserSceneName(sampleSpec)} · ${sampleSpec.samplePlayProfile?.variantId}`);
    ok += 1;
  }
  console.log(`\n✓ spec canonical parity ${ok}/${SAMPLES.length}`);

  const postOk = SAMPLES.every((s) => {
    const viaPost = prepareGameSpecForPersist(mockSpecFromPrompt(s.prompt), s.prompt, "zh-Hans");
    const direct = buildCanonicalAstrocadeSpec(s.prompt, "zh-Hans", { persistedSpec: mockSpecFromPrompt(s.prompt) });
    return stableKey(viaPost) === stableKey(direct);
  });
  if (!postOk) {
    console.error("[FAIL] prepareGameSpecForPersist != buildCanonical persisted path");
    process.exit(1);
  }
  console.log("[OK] POST persist path matches canonical");
}

main();
