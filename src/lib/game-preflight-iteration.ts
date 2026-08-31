/**
 * Bounded preflight iteration policy. This is deliberately separate from the
 * post-release retention loop: it consumes production blockers before a
 * candidate is ever exposed to real players.
 */
export function shouldScheduleGamePreflightIteration(input: {
  productionRound: number;
  maxProductionRounds: number;
  blockers: readonly string[];
}): boolean {
  return input.blockers.length > 0
    && Number.isInteger(input.productionRound)
    && Number.isInteger(input.maxProductionRounds)
    && input.productionRound >= 1
    && input.maxProductionRounds >= 3
    && input.maxProductionRounds <= 5
    && input.productionRound < input.maxProductionRounds;
}

export function buildGamePreflightRevisionInstruction(input: {
  productionRound: number;
  maxProductionRounds: number;
  blockers: readonly string[];
}): string {
  return [
    `这是预发布自动修订第 ${input.productionRound + 1}/${input.maxProductionRounds} 轮。`,
    "你是游戏设计 Agent。必须实际修改 GameSpec 中与失败原因对应的规则、节奏、UI 或视觉参数；保留作品身份和核心创意。",
    `上一轮失败：${input.blockers.join("、")}`,
    "优先解决可玩性、显式机制覆盖、首分钟反馈和视觉辨识度。不要只改标题或说明文字。",
  ].join("\n");
}
