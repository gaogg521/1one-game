/**
 * Phase C 行为签收：P0 样品 hook 离线断言（消消乐 ⭐ / 神庙死亡流）
 * npm run qa:sample-behavior-signoff
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function assertFileContains(rel: string, needle: string, label: string) {
  const file = path.join(process.cwd(), rel);
  const src = fs.readFileSync(file, "utf8");
  if (!src.includes(needle)) {
    throw new Error(`${label}: missing "${needle}" in ${rel}`);
  }
  console.log(`[OK] ${label}`);
}

assertFileContains(
  "src/game/engine/PuzzleScene.ts",
  "playAnipopStarFlyIn",
  "消消乐关间星星飞入",
);
assertFileContains(
  "src/game/engine/CoasterScene.ts",
  "templeDeathCountdown",
  "神庙死亡倒计时 QA 状态",
);

execSync("npm run qa:temple-death-flow", { stdio: "inherit", cwd: process.cwd() });
console.log("[OK] qa:sample-behavior-signoff");
