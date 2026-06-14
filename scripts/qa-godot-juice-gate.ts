/**
 * Godot Secondary runtime 须接入 GameJuice（对标 Phaser gameJuice）
 * npm run qa:godot:juice-gate
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "godot-templates/ai-mother-universal/scripts/runtimes");

const EXPECT: Array<{ file: string; needles: string[] }> = [
  { file: "puzzle_runtime.gd", needles: ["GameJuice.burst", "GameJuice.flash_background"] },
  { file: "farming_runtime.gd", needles: ["GameJuice.burst", "_crop_nodes"] },
  { file: "strategy_runtime.gd", needles: ["GameJuice.burst", "GameJuice.flash_background"] },
  { file: "physics_runtime.gd", needles: ["GameJuice.burst", "comboMultiplier"] },
  { file: "customization_runtime.gd", needles: ["_glaze_mesh", "_rim_mesh", "_base_mesh"] },
  { file: "shooter_runtime.gd", needles: ["GameJuice.burst"] },
  { file: "tower_defense_runtime.gd", needles: ["GameJuice.burst"] },
  { file: "platformer_runtime.gd", needles: ["GameJuice.burst"] },
  { file: "coaster_runtime.gd", needles: ["sample_play_profile", "GameJuice.flash_background", "GameJuice.shake_node"] },
  { file: "chess_runtime.gd", needles: ["sample_play_profile", "GameJuice.burst", "showLegalMoves"] },
  { file: "arena_runtime.gd", needles: ["GameJuice.burst", "GameJuice.flash_background"] },
];

function main() {
  console.log("# qa:godot:juice-gate — Secondary polish 门禁\n");
  for (const { file, needles } of EXPECT) {
    const src = fs.readFileSync(path.join(ROOT, file), "utf8");
    for (const n of needles) {
      if (!src.includes(n)) throw new Error(`${file} missing "${n}"`);
    }
    console.log(`[OK] ${file}`);
  }
  console.log("\n✓ godot juice gate passed");
}

main();
