/**

 * 14 款样品 samplePlayProfile 门禁

 * npm run qa:sample-profiles

 */

import { SAMPLES } from "../src/lib/samples";

import { enrichGameSpecForRuntime } from "../src/lib/enrich-game-spec";

import { parseGameSpec } from "../src/lib/game-spec";

import { SAMPLE_PLAY_PROFILES } from "../src/lib/sample-play-profiles/registry";

import { specForSample } from "../src/lib/sample-specs";



function assert(cond: boolean, msg: string) {

  if (!cond) throw new Error(msg);

}



function main() {

  console.log("# qa:sample-profiles — Astrocade per-game 定制层\n");

  assert(Object.keys(SAMPLE_PLAY_PROFILES).length === SAMPLES.length, "registry must cover all samples");

  for (const s of SAMPLES) {

    assert(!!SAMPLE_PLAY_PROFILES[s.id], `missing profile: ${s.id}`);

    const spec = enrichGameSpecForRuntime(specForSample(s), s.prompt, "zh-Hans", { sampleId: s.id });

    parseGameSpec(spec);

    assert(spec.samplePlayProfile?.variantId === s.id, `${s.id} variantId mismatch`);

    if (s.id === "gun-merge-3d-zombie-apocalypse" || s.id === "blade-defender-merge") {

      assert(spec.samplePlayProfile?.towerDefense?.mergeGrid === true, "merge grid profile");

    }

    if (s.id === "grow-a-garden") {

      assert(spec.samplePlayProfile?.farming?.autoWater === true, "garden auto water");

    }

    if (s.id === "color-bloom") {

      assert((spec.samplePlayProfile?.puzzle?.match3BloomScale ?? 0) >= 1.3, "match3 bloom scale");

    }

    console.log(`[OK] ${s.id} → ${spec.templateId} · profile ${spec.samplePlayProfile?.variantId}`);

  }

  console.log("\n✓ sample play profiles gate passed");

}



main();

