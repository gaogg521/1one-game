/**
 * 专用 Scene 用户可见 HUD 禁止硬编码中文
 * npm run qa:scene-hud-i18n
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SCENES_DIR = join(process.cwd(), "src/game/engine");
const HUD_PATTERNS = [
  /\.setText\s*\(\s*["'`][^"'`]*[\u4e00-\u9fff]/,
  /banner\.show\s*\(\s*\{[^}]*title:\s*["'`][^"'`]*[\u4e00-\u9fff]/,
  /\.add\.text\s*\([^,]+,\s*[^,]+,\s*["'`][^"'`]*[\u4e00-\u9fff]/,
  /\.text\s*\([^,]+,\s*[^,]+,\s*["'`][^"'`]*[\u4e00-\u9fff]/,
];

function main() {
  const files = readdirSync(SCENES_DIR).filter((f) => f.endsWith("Scene.ts"));
  let failed = 0;

  for (const file of files) {
    const lines = readFileSync(join(SCENES_DIR, file), "utf8").split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]!;
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
      if (!/[\u4e00-\u9fff]/.test(line)) continue;
      if (!HUD_PATTERNS.some((re) => re.test(line))) continue;
      console.error(`[FAIL] ${file}:${i + 1} HUD hardcoded Chinese: ${trimmed.slice(0, 100)}`);
      failed += 1;
    }
  }

  if (failed > 0) {
    console.error(`\n[FAIL] qa-scene-hud-i18n: ${failed} HUD line(s)`);
    process.exit(1);
  }
  console.log(`[OK] qa-scene-hud-i18n: ${files.length} Scene files HUD-clean`);
}

main();
