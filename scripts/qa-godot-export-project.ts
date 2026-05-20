/**
 * Godot 工程 zip 冒烟（任意 OS）
 * npm run godot:export:project
 */
import { mockSpecFromPrompt } from "../src/lib/mock-spec";
import { exportGodotProjectZip } from "../src/lib/godot-export-platform";

const prompt = process.argv.slice(2).join(" ") || "收集金币";
const spec = mockSpecFromPrompt(prompt);

async function main() {
  const r = await exportGodotProjectZip({ spec, projectId: "qa-project" });
  if (!r.ok) {
    console.error("[FAIL]", r.code, r.error);
    process.exit(1);
  }
  console.log("[OK]", r.downloadUrl);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
