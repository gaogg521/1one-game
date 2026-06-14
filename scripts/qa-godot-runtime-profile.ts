/**
 * Godot runtime 源码须引用 sample_play_profile 字段（静态门禁）
 * npm run qa:godot:runtime-profile
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "godot-templates/ai-mother-universal/scripts/runtimes");

const EXPECT: Array<{ file: string; needles: string[] }> = [
  { file: "farming_runtime.gd", needles: ["sample_play_profile", "autoWater", "decorativeFence"] },
  { file: "chess_runtime.gd", needles: ["sample_play_profile", "showLegalMoves", "winMoves"] },
  { file: "strategy_runtime.gd", needles: ["sample_play_profile", "winNodes", "rushMode"] },
  { file: "physics_runtime.gd", needles: ["sample_play_profile", "hitImpulse", "comboMultiplier"] },
  { file: "shooter_runtime.gd", needles: ["sample_play_profile", "orbitChopper", "sniperScope"] },
  { file: "customization_runtime.gd", needles: ["sample_play_profile", "editGoal", "potterySpin", "_pottery_part", "_glaze_mesh", "_rim_mesh", "_base_mesh"] },
  { file: "tower_defense_runtime.gd", needles: ["sample_play_profile", "mergeGrid"] },
  {
    file: "puzzle_runtime.gd",
    needles: [
      "sample_play_profile",
      "match3BloomScale",
      "whimsicalPanels",
      "memoryTimerSec",
      "kidsJigsaw",
    ],
  },
  { file: "coaster_runtime.gd", needles: ["sample_play_profile", "speedBoost"] },
  { file: "platformer_runtime.gd", needles: ["sample_play_profile", "treasureHeist"] },
  { file: "arena_runtime.gd", needles: ["sample_play_profile", "GameJuice.burst"] },
];

function main() {
  console.log("# qa:godot:runtime-profile — Godot runtime 读 profile 门禁\n");
  for (const { file, needles } of EXPECT) {
    const src = fs.readFileSync(path.join(ROOT, file), "utf8");
    for (const n of needles) {
      if (!src.includes(n)) {
        throw new Error(`${file} missing "${n}"`);
      }
    }
    console.log(`[OK] ${file}`);
  }
  console.log("\n✓ godot runtime profile gate passed");
}

main();
