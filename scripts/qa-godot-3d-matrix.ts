/**
 * Godot 3D 运行时矩阵：专用 runtime 脚本应含 SubViewport + Node3D
 * npm run qa:godot-3d-matrix
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "godot-templates/ai-mother-universal/scripts/runtimes");

/** 全部 11 个 Godot 专用 runtime 应为 SubViewport 3D */
const EXPECT_3D: Record<string, string> = {
  coaster: "coaster_runtime.gd",
  strategy: "strategy_runtime.gd",
  chess: "chess_runtime.gd",
  customization: "customization_runtime.gd",
  platformer: "platformer_runtime.gd",
  physics: "physics_runtime.gd",
  arena: "arena_runtime.gd",
  shooter: "shooter_runtime.gd",
  tower_defense: "tower_defense_runtime.gd",
  farming: "farming_runtime.gd",
  puzzle: "puzzle_runtime.gd",
};

function main() {
  let failed = 0;
  for (const [key, file] of Object.entries(EXPECT_3D)) {
    const src = fs.readFileSync(path.join(ROOT, file), "utf8");
    const has3d = src.includes("SubViewport") && src.includes("Node3D");
    if (!has3d) {
      console.error(`[FAIL] ${key}: ${file} missing SubViewport/Node3D`);
      failed += 1;
    } else {
      console.log(`[OK] ${key} → 3D SubViewport`);
    }
  }
  if (failed > 0) {
    console.error(`\n[FAIL] qa-godot-3d-matrix: ${failed} runtime(s)`);
    process.exit(1);
  }
  console.log(`\n[OK] qa-godot-3d-matrix: ${Object.keys(EXPECT_3D).length}/${Object.keys(EXPECT_3D).length} 3D runtimes`);
}

main();
