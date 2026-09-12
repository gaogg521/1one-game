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
  // A placement game where the probe never saw a unit reach the field.
  "player_not_placed_yet",
  // It runs, but it cannot actually be played to a conclusion.
  "core_loop_unresolved",
  // A HUD field renders as NaN/undefined, usually gating the whole economy.
  "hud_value_not_a_number",
  // Hazards or projectiles are drawn but never actually move.
  "entities_never_move",
  // The first minute does not hold together.
  "vertical_slice_blocked",
  // Things the player is asked to chase that they cannot see or reach.
  "collectible_not_visible",
  "collectible_spawn_outside_viewport",
  // What the art director saw in the delivered frame.
  "art_direction_mismatch",
  "hud_unreadable",
  "low_contrast_subject",
]);

/**
 * Telling the code agent to draw artwork that does not exist is worse than
 * leaving it alone. Observed in production: a required player sprite 404'd, the
 * polish round ordered the runtime to use it anyway, and the next build drew a
 * player nobody could see. When a slot is missing, the repair belongs in asset
 * generation, so the "asset unused" findings are dropped for that round.
 */
const ASSET_MISSING_PREFIX = "required_asset_missing";
const ASSET_USE_FINDINGS = new Set([
  "runtime_background_asset_unused",
  "runtime_player_asset_unused",
  "runtime_enemy_asset_unused",
  "runtime_sprite_actor_missing",
]);

export function selectGameQualityPolishFindings(advisories: readonly string[]): string[] {
  const codes = advisories.map((entry) => {
    const code = entry.startsWith("advisory:") ? entry.slice("advisory:".length) : entry;
    // Some advisories carry evidence after a colon (which HUD field, which
    // entity kind). Match the code, keep the detail out of the lookup.
    const colon = code.indexOf(":");
    return colon > 0 ? code.slice(0, colon) : code;
  });
  const assetsMissing = advisories.some((entry) => entry.includes(ASSET_MISSING_PREFIX));
  const seen = new Set<string>();
  for (const code of codes) {
    if (!POLISHABLE_ADVISORIES.has(code)) continue;
    if (assetsMissing && ASSET_USE_FINDINGS.has(code)) continue;
    seen.add(code);
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
    player_not_placed_yet: "确认放置流程可用：开局 5 秒内玩家应当负担得起第一次放置，放置后单位必须立刻画在被点击的格子上并开始工作；如果资源门槛太高，降低首个单位的成本或提高开局资源。",
    player_too_small: "放大主角：绘制尺寸按 Math.max(48, Math.min(g.width, g.height) * 0.09) 从舞台推导，不要用固定小数值；碰撞体要跟着可见尺寸一起改。",
    entities_never_move: "有一类实体被画出来了却从不移动：真实试玩中它的坐标全程没有变化，说明这个系统写了但没跑起来。请确认它的 update 函数确实被 main 的 update 每帧调用、确实按 dt 改写 x / y、速度不是 0 或 undefined，并且读写的是 g.world 里那一批被绘制的同一个实体（不要改一个游离对象）。敌人和子弹不动，等于整个玩法不成立。",
    hud_value_not_a_number: "HUD 出现 NaN / undefined：某个计数器从未被初始化成数字就参与了运算。把所有资源、分数、计时器在 init 与 restart 里显式赋 0 或初始值，任何 += / -= 之前先确认左值是数字（用 Number(x) || 0 兜底），并确认配置里读到的字段确实存在。玩家看到 NaN 通常意味着整套经济系统失效。",
    core_loop_unresolved: "核心循环没有闭合：真实试玩中分数从未变化、也没有产生胜负结算。请修好收集/受伤判定与结束条件——碰到收集物必须加分，碰到障碍必须扣血，计时归零或达成目标必须走 g.start 的结束流程并显示结算卡。碰撞判定必须使用可见精灵的位置和尺寸。",
    vertical_slice_blocked: "重做前 60 秒节奏：10 秒内同屏最多 1 个威胁，30 秒内最多 2 个且速度不超过峰值的 60%，失败至少需要 3 次失误，每次掉血后至少 1.5 秒无敌并有闪烁提示，开局 5 秒内必须有一个无风险可拿的得分。",
    collectible_not_visible: "收集物必须在画面内可见，且不小于 32 像素。",
    collectible_spawn_outside_viewport: "收集物出生点必须限制在 g.width / g.height 之内。",
    art_direction_mismatch: "画面与既定美术方向不符：按 art direction 的画风、镜头和构图重做背景与角色素材描述，保持创作者原始意图。",
    hud_unreadable: "HUD 重做：分数、生命、计时集中在一次 g.ui.hud 调用里，不要与玩法元素重叠或被裁切，必要时加深色底衬提高可读性。",
    low_contrast_subject: "提高主角与障碍相对背景的对比度：调整配色或加描边/投影，让玩家一眼能分辨可操作对象。",
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
