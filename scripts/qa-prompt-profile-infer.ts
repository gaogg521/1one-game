/**
 * 用户 POST 与样品 prompt 完全一致时自动套用 samplePlayProfile
 * npm run qa:prompt-profile-infer
 */
import { SAMPLES } from "../src/lib/samples";
import { enrichGameSpecForRuntime } from "../src/lib/enrich-game-spec";
import { mockSpecFromPrompt } from "../src/lib/mock-spec";
import { inferSampleIdFromPrompt } from "../src/lib/sample-play-profiles";

function main() {
  console.log("# qa:prompt-profile-infer\n");
  let ok = 0;
  for (const s of SAMPLES) {
    const inferred = inferSampleIdFromPrompt(s.prompt);
    if (inferred !== s.id) {
      throw new Error(`infer failed for ${s.id}: got ${inferred ?? "undefined"}`);
    }
    const userSpec = enrichGameSpecForRuntime(mockSpecFromPrompt(s.prompt), s.prompt, "zh-Hans");
    if (userSpec.samplePlayProfile?.variantId !== s.id) {
      throw new Error(
        `enrich user path missing profile for ${s.id}: got ${userSpec.samplePlayProfile?.variantId ?? "none"}`,
      );
    }
    console.log(`[OK] ${s.id} → profile ${userSpec.samplePlayProfile?.variantId}`);
    ok += 1;
  }

  const generic = enrichGameSpecForRuntime(
    mockSpecFromPrompt("做一个简单的躲避障碍小游戏"),
    "做一个简单的躲避障碍小游戏",
    "zh-Hans",
  );
  if (generic.samplePlayProfile?.variantId) {
    throw new Error(`generic prompt should not get profile: ${generic.samplePlayProfile.variantId}`);
  }
  console.log("[OK] generic prompt → no profile");

  console.log(`\n✓ prompt profile infer gate passed (${ok}/${SAMPLES.length})`);
}

main();
