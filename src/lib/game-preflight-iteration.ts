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

/**
 * Advisory findings worth one bounded polish round on a build that already
 * runs. Deliberately narrow: each entry names something a design or code agent
 * can actually change, and every entry costs a full production run, so noisy or
 * infrastructural advisories stay out.
 */
const POLISHABLE_ADVISORIES = new Set([
  // The game is letterboxed into the phone it ships on.
  "runtime_letterboxed",
  // Generated artwork exists but the runtime draws primitives instead.
  "runtime_background_asset_unused",
  "runtime_player_asset_unused",
  "runtime_enemy_asset_unused",
  "runtime_sprite_actor_missing",
  // The protagonist is too small to track on a phone.
  "player_too_small",
  // The first minute does not hold together.
  "vertical_slice_blocked",
  // Things the player is asked to chase that they cannot see or reach.
  "collectible_not_visible",
  "collectible_spawn_outside_viewport",
]);

export function selectGameQualityPolishFindings(advisories: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const entry of advisories) {
    const code = entry.startsWith("advisory:") ? entry.slice("advisory:".length) : entry;
    if (POLISHABLE_ADVISORIES.has(code)) seen.add(code);
  }
  return [...seen];
}

/**
 * A playable game is never held back for these -- that is what made the product
 * feel like it gated everything. It ships, the player plays it, and the
 * platform spends exactly one more round making it better.
 */
export function shouldScheduleGameQualityPolish(input: {
  productionRound: number;
  maxProductionRounds: number;
  findings: readonly string[];
}): boolean {
  return input.findings.length > 0
    && Number.isInteger(input.productionRound)
    && input.productionRound === 1
    && Number.isInteger(input.maxProductionRounds)
    && input.maxProductionRounds >= 2;
}

export function buildGameQualityPolishInstruction(findings: readonly string[]): string {
  const asks: Record<string, string> = {
    runtime_letterboxed: "把舞台改成竖屏并铺满 393×852 手机画面：所有边界、出生点和 HUD 锚点都从 g.width / g.height 读取，不要把玩法挤在中间一条。",
    runtime_background_asset_unused: "背景必须真正绘制项目生成的背景素材，而不是纯色或程序化图形。",
    runtime_player_asset_unused: "主角必须绘制项目生成的主角素材。",
    runtime_enemy_asset_unused: "敌人/障碍必须绘制项目生成的素材。",
    runtime_sprite_actor_missing: "用 g.assets.image 加载素材并用 r.sprite 绘制角色，不要用矩形和圆形代替角色。",
    player_too_small: "放大主角：绘制尺寸按 Math.max(48, Math.min(g.width, g.height) * 0.09) 从舞台推导，不要用固定小数值；碰撞体要跟着可见尺寸一起改。",
    vertical_slice_blocked: "重做前 60 秒节奏：10 秒内同屏最多 1 个威胁，30 秒内最多 2 个且速度不超过峰值的 60%，失败至少需要 3 次失误，每次掉血后至少 1.5 秒无敌并有闪烁提示，开局 5 秒内必须有一个无风险可拿的得分。",
    collectible_not_visible: "收集物必须在画面内可见，且不小于 32 像素。",
    collectible_spawn_outside_viewport: "收集物出生点必须限制在 g.width / g.height 之内。",
  };
  return [
    "这是交付后的一轮自动质量打磨。游戏已经可以玩，不要推翻创意、玩法或美术方向。",
    "只按下面的观测结果做针对性修改，并保持主角、机制和标题不变：",
    ...findings.map((code) => `- ${asks[code] ?? code}`),
    "主角在手机上的绘制尺寸不得小于舞台短边的 9%，也不得小于 48 像素。",
  ].join("\n");
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
