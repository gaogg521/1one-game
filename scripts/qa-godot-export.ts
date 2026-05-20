/**
 * 冒烟：GameSpec → Godot Web 导出（需本机 tools/godot + export_templates）
 * npm run qa:godot-export
 */
import { mockSpecFromPrompt } from "../src/lib/mock-spec";
import { exportGameSpecToGodotWeb } from "../src/lib/godot-export";

const prompt =
  process.argv.slice(2).join(" ") ||
  "太空躲避陨石，收集星星，经典 avoider";
const spec = mockSpecFromPrompt(prompt);
// 强制测 avoider（若 prompt 未命中）
if (!process.argv.slice(2).length) {
  spec.templateId = "avoider";
}

async function main() {
  console.log(`[qa-godot-export] templateId=${spec.templateId} title=${spec.title}`);

  const result = await exportGameSpecToGodotWeb({
    spec,
    projectId: `qa-godot-${spec.templateId}`,
  });

  if (!result.ok) {
    console.error("[FAIL]", result.code, result.error);
    process.exit(1);
  }

  console.log("[OK] buildUrl=", result.buildUrl, "cached=", result.cached);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
