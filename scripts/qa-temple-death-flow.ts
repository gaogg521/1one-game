/**
 * 神庙死亡 3 秒结算流程离线断言
 * npm run qa:temple-death-flow
 */
import fs from "node:fs";
import path from "node:path";

const coaster = fs.readFileSync(path.join(process.cwd(), "src/game/engine/CoasterScene.ts"), "utf8");
const player = fs.readFileSync(path.join(process.cwd(), "src/components/GamePlayerInner.tsx"), "utf8");
const puzzle = fs.readFileSync(path.join(process.cwd(), "src/game/engine/PuzzleScene.ts"), "utf8");

const failures: string[] = [];

for (const sym of [
  "scheduleTempleDeathFinalize",
  "finalizeTempleRunSession",
  "templeDeathFinalizeAt",
  "templeDeathCountdown",
  "refreshDeathRecapHud",
  "tryRestartTempleRun",
]) {
  if (!coaster.includes(sym)) failures.push(`CoasterScene missing ${sym}`);
}

if (!coaster.includes("delayedCall(3000")) {
  failures.push("temple death finalize should use 3s delayedCall");
}

if (!player.includes("setResult") || !player.includes("result ?")) {
  failures.push("GamePlayerInner should render result overlay after onEnd");
}

if (!puzzle.includes("playAnipopStarFlyIn")) {
  failures.push("PuzzleScene should include anipop star fly-in animation");
}

if (failures.length) {
  console.error("[FAIL] qa-temple-death-flow");
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}

console.log("[OK] qa-temple-death-flow: temple death settle + anipop star fly-in hooks");
