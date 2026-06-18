/**
 * Staging 环境门禁（离线）
 * npm run qa:opengame-staging-env
 */
import fs from "node:fs";
import path from "node:path";
import {
  isOpenGameBrowserBenchEnabled,
  isOpenGameBrowserBenchRepairEnabled,
} from "@/lib/opengame-skills/browser-bench-env";
import { isComfyGameSpriteEnabled, assertComfySpriteWorkflowPreviewSize } from "@/lib/comfy-game-sprite-gen";

const failures: string[] = [];

const stagingExample = path.join(process.cwd(), ".env.staging.example");
if (!fs.existsSync(stagingExample)) {
  failures.push("missing .env.staging.example");
} else {
  const text = fs.readFileSync(stagingExample, "utf8");
  for (const key of [
    "STAGING=1",
    "OPENGAME_BROWSER_BENCH=1",
    "OPENGAME_BROWSER_BENCH_REPAIR=1",
    "QA_ROUTES_ENABLED=1",
    "GAME_SPRITE_COMFY=1",
  ]) {
    if (!text.includes(key)) failures.push(`.env.staging.example missing ${key}`);
  }
}

process.env.STAGING = "1";
delete process.env.OPENGAME_BROWSER_BENCH;
if (!isOpenGameBrowserBenchEnabled()) failures.push("STAGING=1 should enable browser bench");
if (!isOpenGameBrowserBenchRepairEnabled()) failures.push("STAGING=1 should enable browser bench repair");

process.env.GAME_SPRITE_COMFY = "1";
process.env.COMFY_UI_BASE_URL = "http://127.0.0.1:8188";
if (!isComfyGameSpriteEnabled()) failures.push("GAME_SPRITE_COMFY=1 + COMFY should enable comfy sprites");

if (!assertComfySpriteWorkflowPreviewSize()) failures.push("comfy sprite workflow not 256");

if (failures.length) {
  console.error("[FAIL] qa-opengame-staging-env");
  failures.forEach((f) => console.error(" -", f));
  process.exit(1);
}
console.log("[OK] qa-opengame-staging-env");
