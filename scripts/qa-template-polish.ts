/**
 * template 族 Primary polish 门禁：关键 Scene 须接入 gameJuice
 * npm run qa:template-polish
 */
import fs from "node:fs";
import path from "node:path";

const SCENES: Array<{ file: string; required: RegExp[] }> = [
  {
    file: "src/game/engine/PlatformerScene.ts",
    required: [/juiceBurst/, /juiceShake/],
  },
  {
    file: "src/game/engine/PuzzleScene.ts",
    required: [/juiceBurst/, /juiceShake/, /juiceFloater/],
  },
  {
    file: "src/game/engine/CoasterScene.ts",
    required: [/juiceShake/, /juiceFloater/, /juiceFlash/],
  },
  {
    file: "src/game/engine/CustomizationScene.ts",
    required: [/juiceBurst/, /juiceFlash/],
  },
];

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function main() {
  console.log("# qa:template-polish — template 族 juice 门禁\n");
  for (const { file, required } of SCENES) {
    const src = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    for (const re of required) {
      assert(re.test(src), `${file} missing ${re}`);
    }
    console.log(`[OK] ${file}`);
  }
  const platBp = fs.readFileSync(path.join(process.cwd(), "src/lib/platformer-blueprint.ts"), "utf8");
  assert(!/SAMPLE_MODES\s*:/.test(platBp), "platformer-blueprint must not use SAMPLE_MODES");
  console.log("[OK] platformer-blueprint: no SAMPLE_MODES");
  assert(/levelLayers/.test(platBp), "platformer-blueprint must define levelLayers");
  const themeVisual = fs.readFileSync(path.join(process.cwd(), "src/game/engine/template-theme-visual.ts"), "utf8");
  assert(/paintPlatformerParallax/.test(themeVisual), "template-theme-visual must export parallax");
  assert(/paintPuzzleThemeBackdrop/.test(themeVisual), "template-theme-visual must export puzzle backdrop");
  assert(/paintCoasterSkyBackdrop/.test(themeVisual), "template-theme-visual must export coaster backdrop");
  assert(/paintCustomizationStudio/.test(themeVisual), "template-theme-visual must export customization studio");
  const platScene = fs.readFileSync(path.join(process.cwd(), "src/game/engine/PlatformerScene.ts"), "utf8");
  const puzzleScene = fs.readFileSync(path.join(process.cwd(), "src/game/engine/PuzzleScene.ts"), "utf8");
  const coasterScene = fs.readFileSync(path.join(process.cwd(), "src/game/engine/CoasterScene.ts"), "utf8");
  const customScene = fs.readFileSync(path.join(process.cwd(), "src/game/engine/CustomizationScene.ts"), "utf8");
  assert(/template-theme-visual/.test(platScene), "PlatformerScene must use template-theme-visual");
  assert(/template-theme-visual/.test(puzzleScene), "PuzzleScene must use template-theme-visual");
  assert(/template-theme-visual/.test(coasterScene), "CoasterScene must use template-theme-visual");
  assert(/template-theme-visual/.test(customScene), "CustomizationScene must use template-theme-visual");
  const godotSpec = fs.readFileSync(
    path.join(process.cwd(), "godot-templates/ai-mother-universal/scripts/autoload/game_spec_data.gd"),
    "utf8",
  );
  assert(/func platformer\(\)/.test(godotSpec), "Godot GameSpecData must expose platformer()");
  console.log("[OK] template-theme-visual wired (Phaser + Godot spec bridge)");
  const puzzleBp = fs.readFileSync(path.join(process.cwd(), "src/lib/puzzle-blueprint.ts"), "utf8");
  assert(/cols: 8/.test(puzzleBp), "puzzle-blueprint match3 cols should be 8+");
  const coasterBp = fs.readFileSync(path.join(process.cwd(), "src/lib/coaster-blueprint.ts"), "utf8");
  assert(/distanceGoal/.test(coasterBp), "coaster-blueprint must scale distanceGoal");
  console.log("[OK] blueprint density fields present");
  console.log("\n✓ template polish gate passed");
}

main();
