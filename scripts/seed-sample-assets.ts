/**
 * 为 17 款样品馆生成程序化 sprite + 背景（无需文生图密钥）。
 * npm run seed:sample-assets
 *
 * 旗舰 5 款若已有完整 PNG（如文生图 seed），默认跳过以免覆盖。
 * FORCE_PROCEDURAL=1 — 强制重写全部样品贴图
 */
import fs from "node:fs";
import path from "node:path";
import { buildCanonicalAstrocadeSpec } from "@/lib/astrocade-canonical-spec";
import { sampleProjectId } from "@/lib/sample-gallery";
import { writeSampleProceduralAssets } from "@/lib/procedural-game-assets";
import { STRICT_VISUAL_SAMPLE_IDS } from "@/lib/qa/canvas-image-parity";
import { SAMPLES } from "@/lib/samples";

const SPRITE_FILES = ["player.png", "hazard.png", "gem.png", "power.png", "boss.png"] as const;
const FORCE = process.env.FORCE_PROCEDURAL === "1";

function hasCompleteSampleAssets(projectId: string): boolean {
  const spriteDir = path.join(process.cwd(), "public", "game-sprites", projectId);
  const bg = path.join(process.cwd(), "public", "game-bg", `${projectId}.png`);
  if (!fs.existsSync(bg)) return false;
  return SPRITE_FILES.every((f) => fs.existsSync(path.join(spriteDir, f)));
}

async function main(): Promise<void> {
  const written: string[] = [];
  const skipped: string[] = [];

  for (const s of SAMPLES) {
    const projectId = sampleProjectId(s.id);
    if (
      !FORCE &&
      STRICT_VISUAL_SAMPLE_IDS.has(s.id) &&
      hasCompleteSampleAssets(projectId)
    ) {
      skipped.push(projectId);
      console.log(`[seed-assets] skip ${projectId} — 已有贴图（保留 AI/手工资产）`);
      continue;
    }
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

  console.log(`seed:sample-assets: ok (${written.length} samples + stub${skipped.length ? ` · skipped ${skipped.length} flagship` : ""})`);
}

main().catch((e) => {
  console.error("[FAIL]", e instanceof Error ? e.message : e);
  process.exit(1);
});
