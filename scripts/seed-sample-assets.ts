/**
 * 为 17 款样品馆生成程序化 sprite + 背景（无需文生图密钥）。
 * npm run seed:sample-assets
 */
import { buildCanonicalAstrocadeSpec } from "@/lib/astrocade-canonical-spec";
import { sampleProjectId } from "@/lib/sample-gallery";
import { writeSampleProceduralAssets } from "@/lib/procedural-game-assets";
import { STRICT_VISUAL_SAMPLE_IDS } from "@/lib/qa/canvas-image-parity";
import { SAMPLES } from "@/lib/samples";

async function main(): Promise<void> {
  const written: string[] = [];

  for (const s of SAMPLES) {
    const projectId = sampleProjectId(s.id);
    const spec = buildCanonicalAstrocadeSpec(s.prompt, "zh-Hans", { sampleId: s.id });
    spec.title = s.title;
    await writeSampleProceduralAssets(projectId, spec, {
      rich: STRICT_VISUAL_SAMPLE_IDS.has(s.id),
    });
    written.push(projectId);
    console.log(`[seed-assets] ${projectId} · sprites×5 + background`);
  }

  // E2E stub 通用贴图
  const stubSpec = buildCanonicalAstrocadeSpec(
    "做一个解压向物理小游戏：打击 dummy 假人",
    "zh-Hans",
    { sampleId: "smash-the-dummy" },
  );
  await writeSampleProceduralAssets("stub", stubSpec, { rich: false });

  console.log(`seed:sample-assets: ok (${written.length} samples + stub)`);
}

main().catch((e) => {
  console.error("[FAIL]", e instanceof Error ? e.message : e);
  process.exit(1);
});
