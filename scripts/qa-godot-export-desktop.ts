/**
 * Windows PC 导出冒烟
 * npm run godot:export:desktop -- "塔防"
 */
import { mockSpecFromPrompt } from "../src/lib/mock-spec";
import { exportGodotWindowsDesktop } from "../src/lib/godot-export-platform";

const prompt = process.argv.slice(2).join(" ") || "保卫萝卜塔防";
const spec = mockSpecFromPrompt(prompt);

async function main() {
  console.log(`[qa] windows desktop template=${spec.templateId}`);
  const r = await exportGodotWindowsDesktop({ spec, projectId: "qa-desktop" });
  if (!r.ok) {
    console.error("[FAIL]", r.code, r.error);
    process.exit(1);
  }
  console.log("[OK]", r.downloadUrl, "cached=", r.cached);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
