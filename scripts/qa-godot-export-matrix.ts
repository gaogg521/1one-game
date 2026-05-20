/**
 * 六模板 Godot Web 导出矩阵冒烟（CI / 本地，需 godot:install:ci）
 * npm run qa:godot-export:matrix
 */
import { PRODUCT } from "../src/lib/product-config";
import { mockSpecFromPrompt } from "../src/lib/mock-spec";
import { exportGameSpecToGodotWeb } from "../src/lib/godot-export";

const PROMPTS: Record<string, string> = {
  avoider: "躲避陨石生存",
  collector: "收集金币躲开尖刺",
  survivor: "生存躲避敌人",
  platformer: "横版平台跳跃",
  towerDefense: "保卫萝卜塔防",
  shooter: "俯视角射击",
};

async function main() {
  let failed = 0;
  for (const templateId of PRODUCT.godot.supportedTemplates) {
    const spec = mockSpecFromPrompt(PROMPTS[templateId] ?? templateId);
    spec.templateId = templateId;
    process.stdout.write(`[qa] ${templateId} … `);
    const result = await exportGameSpecToGodotWeb({
      spec,
      projectId: `qa-matrix-${templateId}`,
    });
    if (!result.ok) {
      failed += 1;
      console.log(`FAIL (${result.code}) ${result.error}`);
    } else {
      console.log(`OK ${result.buildUrl} cached=${result.cached}`);
    }
  }
  if (failed > 0) {
    console.error(`[qa-godot-export:matrix] ${failed} failed`);
    process.exit(1);
  }
  console.log("[qa-godot-export:matrix] all templates OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
