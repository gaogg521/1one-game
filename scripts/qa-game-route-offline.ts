/**
 * 游戏模板推断 + 模型路由（text/vision）离线断言
 * npm run qa:game-route-offline
 */
import { inferTemplateFromPrompt } from "@/lib/game-templates/infer";
import { resolveGameModelRoute } from "@/lib/game-model-route";

const failures: string[] = [];

const shooterPrompt = "设计一个飞机大战的游戏";
const shooterTemplate = inferTemplateFromPrompt(shooterPrompt);
if (shooterTemplate !== "shooter") {
  failures.push(`飞机大战应命中 shooter，实际 ${shooterTemplate}`);
}

const textRoute = resolveGameModelRoute({ prompt: shooterPrompt });
if (textRoute.mode !== "text" || textRoute.scene !== "game_text") {
  failures.push(`无图 prompt 应走 game_text，实际 ${textRoute.mode}/${textRoute.scene}`);
}

const visionRoute = resolveGameModelRoute({
  prompt: `${shooterPrompt}\n【参考素材】战机草图`,
});
if (visionRoute.mode !== "vision" || visionRoute.scene !== "game_vision") {
  failures.push(`有参考图应走 game_vision，实际 ${visionRoute.mode}/${visionRoute.scene}`);
}

if (failures.length) {
  console.error("[qa:game-route-offline] FAIL");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log("[qa:game-route-offline] PASS");
console.log(`  template=${shooterTemplate} text=${textRoute.scene} vision=${visionRoute.scene}`);
