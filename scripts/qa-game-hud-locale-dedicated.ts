/**
 * 专用 Scene HUD：ms/th 不得与 en 完全相同的 dedicated 文案
 * npm run qa:game-hud-locale-dedicated
 */
import fs from "node:fs";
import path from "node:path";

const DEDICATED_KEYS = [
  "physicsControls",
  "strategyControls",
  "farmingControls",
  "puzzleMatch3Hint",
  "customizationHint",
  "chessTurnWhite",
] as const;

function load(loc: string) {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "src/messages", `${loc}.json`), "utf8")) as {
    gameEvents: { hud: Record<string, string> };
  };
}

function main() {
  const en = load("en");
  let failed = 0;
  for (const loc of ["ms", "th"] as const) {
    const j = load(loc);
    for (const key of DEDICATED_KEYS) {
      const ev = en.gameEvents.hud[key];
      const lv = j.gameEvents.hud[key];
      if (!lv || lv === ev) {
        console.error(`[FAIL] ${loc} gameEvents.hud.${key} still English fallback`);
        failed += 1;
      }
    }
    if (failed === 0) console.log(`[OK] ${loc} dedicated HUD localized (${DEDICATED_KEYS.length} keys)`);
  }
  if (failed > 0) {
    console.error(`\n[FAIL] qa-game-hud-locale-dedicated: ${failed} key(s)`);
    process.exit(1);
  }
  console.log("\n[OK] qa-game-hud-locale-dedicated: ms + th dedicated HUD");
}

main();
