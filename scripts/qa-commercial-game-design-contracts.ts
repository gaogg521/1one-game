import { applyHardQualityDefaults } from "../src/lib/game-quality";
import { mockSpecFromPrompt } from "../src/lib/mock-spec";
import { lintGameSpecForOrchestration } from "../src/lib/orchestration/lint-spec";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const match3Prompt = "做一个开心消消乐类型的三消游戏，糖果动物角色，交换消除，连锁爆炸，道具关卡和步数限制";
const match3 = applyHardQualityDefaults(mockSpecFromPrompt(match3Prompt), match3Prompt);
assert(match3.templateId === "puzzle", "开心消消乐 prompt should route to puzzle");
assert(match3.puzzle?.mode === "match3", "开心消消乐 prompt should use match3 mode");
assert(match3.puzzle?.matchMechanic === "swap", "开心消消乐 should use swap-match mechanic");
assert((match3.puzzle?.objectives?.length ?? 0) >= 2, "开心消消乐 should have multiple level objectives");
assert((match3.puzzle?.boosters?.length ?? 0) >= 3, "开心消消乐 should have commercial boosters");
assert((match3.puzzle?.specialTiles?.length ?? 0) >= 3, "开心消消乐 should have special tiles");
assert((match3.puzzle?.levelCount ?? 0) >= 3, "开心消消乐 should have a level pack");
assert(match3.labels.player !== "主角", "开心消消乐 should not keep generic player label");
assert(match3.labels.collectible !== "收集物", "开心消消乐 should not keep generic collectible label");

const xiangqiPrompt = "做一个中国象棋游戏，楚河汉界，红黑双方，对弈，有将军提示和吃子反馈，节奏紧凑";
const xiangqi = applyHardQualityDefaults(mockSpecFromPrompt(xiangqiPrompt), xiangqiPrompt);
assert(xiangqi.templateId === "chess", "中国象棋 prompt should route to chess");
assert(xiangqi.chess?.ruleset === "xiangqi", "中国象棋 should use xiangqi ruleset");
assert(xiangqi.chess?.boardCols === 9, "中国象棋 should use 9 columns");
assert(xiangqi.chess?.boardRows === 10, "中国象棋 should use 10 rows");
assert((xiangqi.chess?.pieceSet?.length ?? 0) >= 7, "中国象棋 should include full piece families");
assert((xiangqi.chess?.aiDepth ?? 0) >= 1, "中国象棋 should include AI depth");
assert(xiangqi.chess?.showLegalMoves, "中国象棋 should show legal moves");
assert(xiangqi.chess?.checkHint, "中国象棋 should include check hints");
assert(xiangqi.labels.player !== "主角", "中国象棋 should not keep generic player label");
assert(xiangqi.labels.hazard !== "障碍", "中国象棋 should not keep generic hazard label");

for (const spec of [match3, xiangqi]) {
  const lint = lintGameSpecForOrchestration(spec);
  assert(lint.ok, `${spec.title}: commercial spec should pass orchestration lint${lint.ok ? "" : `: ${lint.issues.join("; ")}`}`);
}

console.log("[OK] qa-commercial-game-design-contracts");
