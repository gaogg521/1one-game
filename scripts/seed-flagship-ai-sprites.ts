/**
 * 旗舰 5 款样品文生图 sprite + 背景（需 IMAGE_GEN 密钥）。
 * RUN_REAL_IMAGE_GEN=1 npm run seed:flagship-ai-sprites
 * FORCE_REGEN=1 — 覆盖已有 PNG
 */
import fs from "node:fs";
import path from "node:path";
import { buildCanonicalAstrocadeSpec } from "@/lib/astrocade-canonical-spec";
import { generateGameBackground } from "@/lib/game-background-gen";
import { generateGameSprites } from "@/lib/game-sprite-gen";
import { getImageGenAvailability } from "@/lib/image-generation";
import { sampleProjectId } from "@/lib/sample-gallery";
import { STRICT_VISUAL_SAMPLE_IDS } from "@/lib/qa/canvas-image-parity";
import { SAMPLES } from "@/lib/samples";

const FORCE = process.env.FORCE_REGEN === "1";

function clearSampleAssets(projectId: string): void {
  const spriteDir = path.join(process.cwd(), "public", "game-sprites", projectId);
  if (fs.existsSync(spriteDir)) {
    for (const f of fs.readdirSync(spriteDir)) {
      if (f.endsWith(".png")) fs.unlinkSync(path.join(spriteDir, f));
    }
  }
  const bg = path.join(process.cwd(), "public", "game-bg", `${projectId}.png`);
  if (fs.existsSync(bg)) fs.unlinkSync(bg);
}

async function main(): Promise<void> {
  if (process.env.RUN_REAL_IMAGE_GEN !== "1") {
    console.error("[FAIL] 需 RUN_REAL_IMAGE_GEN=1");
    process.exit(1);
  }

  const availability = getImageGenAvailability();
  if (!availability.ok) {
    console.error("[FAIL]", availability.message);
    process.exit(1);
  }

  const flagship = SAMPLES.filter((s) => STRICT_VISUAL_SAMPLE_IDS.has(s.id));
  console.log(`[flagship-ai] ${flagship.length} samples · force=${FORCE}`);

  let ok = 0;
  let fail = 0;

  for (const s of flagship) {
    const projectId = sampleProjectId(s.id);
    const spec = buildCanonicalAstrocadeSpec(s.prompt, "zh-Hans", { sampleId: s.id });
    spec.title = s.title;

    if (FORCE) clearSampleAssets(projectId);

    console.log(`\n→ ${s.id} (${projectId})`);

    const sprites = await generateGameSprites(projectId, spec, "zh-Hans");
    const spriteOk = sprites.filter((r) => r.url).length;
    console.log(`  sprites: ${spriteOk}/${sprites.length}`);

    const bgUrl = await generateGameBackground(projectId, spec);
    console.log(`  background: ${bgUrl ? "ok" : "skip"}`);

    if (spriteOk >= 3 && bgUrl) ok += 1;
    else fail += 1;
  }

  console.log(`\nseed:flagship-ai-sprites: ${ok}/${flagship.length} full ok · ${fail} partial/fail`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error("[FAIL]", e instanceof Error ? e.message : e);
  process.exit(1);
});
