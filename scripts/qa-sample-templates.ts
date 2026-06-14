/** 验证样品馆 templateId 推断与 registry override */
import { prisma } from "@/lib/prisma";
import { inferTemplateFromPrompt, SAMPLE_TEMPLATE_OVERRIDES } from "@/lib/game-templates";
import { resolveTemplateRuntime } from "@/lib/game-templates/registry";
import { SAMPLES } from "@/lib/samples";
import { sampleProjectId } from "@/lib/sample-gallery";
import type { GameSpec } from "@/lib/game-spec";

async function main() {
  let failed = 0;

  for (const s of SAMPLES) {
    const inferred = inferTemplateFromPrompt(s.prompt, { sampleId: s.id });
    const expected = SAMPLE_TEMPLATE_OVERRIDES[s.id];
    if (expected && inferred !== expected) {
      console.error(`[FAIL] ${s.id}: infer=${inferred} expected=${expected}`);
      failed += 1;
    } else {
      const rt = resolveTemplateRuntime(inferred);
      console.log(`[OK] ${s.id} → ${inferred} (phaser=${rt.phaser}, godot=${rt.godot})`);
    }
  }

  const rail = await prisma.project.findUnique({
    where: { id: sampleProjectId("rail-in-air") },
    select: { specJson: true },
  });
  if (!rail?.specJson) {
    console.error("[FAIL] DB 缺少样品 rail-in-air — 请 DATABASE_URL=file:./prisma/ci.sqlite npm run seed:samples");
    failed += 1;
  } else {
    const railSpec = JSON.parse(rail.specJson) as GameSpec;
    if (railSpec.templateId !== "coaster") {
      console.error(`[FAIL] DB rail-in-air templateId=${railSpec.templateId}`);
      failed += 1;
    } else {
      console.log("[OK] DB sample-rail-in-air templateId=coaster");
    }
  }

  await prisma.$disconnect();
  if (failed > 0) process.exit(1);
  console.log(`qa-sample-templates: ${SAMPLES.length} samples OK`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
