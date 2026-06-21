import type { AppLocale } from "@/i18n/routing";
import type { GameSpec } from "@/lib/game-spec";

export type SceneGoalGuidance = {
  title: string;
  objective: string;
  controls: string;
  stakes: string;
  banner: { title: string; message: string; ms: number };
  bottomHint: string;
};

function isZh(locale: AppLocale): boolean {
  return locale.startsWith("zh");
}

function fallback(value: string | null | undefined, zh: string, en: string, locale: AppLocale): string {
  const trimmed = value?.trim();
  if (trimmed) return trimmed;
  return isZh(locale) ? zh : en;
}

function targetScore(spec: GameSpec): number {
  return spec.gameplay.winScore ?? 20;
}

export function buildSceneGoalGuidance(spec: GameSpec, locale: AppLocale): SceneGoalGuidance {
  const zh = isZh(locale);
  const variantId = spec.samplePlayProfile?.variantId;
  const title = zh ? `${spec.title} · 目标` : `${spec.title} · Goal`;
  const hero = fallback(spec.labels.player, "主角", "hero", locale);
  const hazard = fallback(spec.labels.hazard, "威胁", "threats", locale);
  const collectible = fallback(spec.labels.collectible, "目标物", "objectives", locale);
  const skill = fallback(spec.systems?.skill?.name, "技能", "skill", locale);
  const score = targetScore(spec);

  let objective = zh ? `收集 ${score} 个${collectible}，避开${hazard}` : `Collect ${score} ${collectible} while avoiding ${hazard}`;
  let controls = zh ? `移动${hero}，看准时机用 Shift ${skill}` : `Move ${hero}, then use Shift for ${skill}`;
  let stakes = zh ? "连续收集会让节奏和奖励更明显" : "Clean streaks make rewards and pacing more visible";

  if (spec.templateId === "shooter") {
    objective = zh ? `击破 ${score} 个${hazard}，保持火力和走位` : `Destroy ${score} ${hazard} while keeping your firing lane`;
    controls = zh ? `方向键/WASD 移动，自动射击，Shift 释放${skill}` : `Move with arrows/WASD, auto-fire, Shift for ${skill}`;
    stakes = zh ? "优先处理近身目标，别让屏幕压力滚起来" : "Clear close threats first before pressure snowballs";
  } else if (spec.templateId === "platformer") {
    objective = zh ? `穿越关卡，收集 ${score} 个${collectible}并抵达终点` : `Cross the stage, collect ${score} ${collectible}, and reach the finish`;
    controls = zh ? `左右移动，空格/W 跳跃，Shift 使用${skill}` : `Move left/right, jump with Space/W, Shift for ${skill}`;
    stakes = zh ? "注意章节变化，后段会出现更密集的风险" : "Watch chapter changes; later sections raise the pressure";
  } else if (spec.templateId === "towerDefense") {
    const base = fallback(spec.labels.collectible, "基地", "base", locale);
    objective = zh ? `建造并升级${hero}，守住${base}到最后一波` : `Build and upgrade ${hero} to hold the ${base} through the final wave`;
    controls = zh ? `点击塔位建造/升级，Shift 释放${skill}` : `Click slots to build/upgrade, Shift for ${skill}`;
    stakes = zh ? "漏怪会直接消耗基地生命，波次越后奖励越高" : "Leaks damage the base; later waves bring higher rewards";
  } else if (spec.templateId === "farming") {
    objective = zh ? `规划种植，完成收获目标并积累金币` : "Plant smart, meet the harvest goal, and build your coin economy";
    controls = zh ? `点击地块播种/浇水/收获，选择作物调整节奏` : "Click plots to plant, water, and harvest; swap crops to tune pacing";
    stakes = zh ? "连续收获会放大奖励反馈" : "Harvest streaks amplify reward feedback";
  } else if (spec.templateId === "puzzle") {
    objective = zh ? `在步数限制内解开谜题并达到目标分` : "Solve the puzzle within the move limit and hit the target score";
    controls = zh ? `点击可交互元素，优先寻找连锁机会` : "Click interactive pieces and look for chain opportunities";
    stakes = zh ? "大组合会触发更强反馈和更高得分" : "Bigger matches trigger stronger feedback and better scores";
  } else if (spec.templateId === "fighting") {
    const roundsToWin = spec.fighting?.rounds ? Math.ceil(spec.fighting.rounds / 2) : 2;
    objective = zh ? `打赢 ${roundsToWin} 局，击败 AI 对手` : `Win ${roundsToWin} rounds to defeat the AI`;
    controls = zh ? "A/D 移动 · J 轻拳 · K 重拳 · L 格挡 · U 特殊技" : "A/D move · J light · K heavy · L block · U special";
    stakes = zh ? "连续命中触发组合，格挡可减免伤害" : "Chain hits for combos; hold block to reduce damage";
  } else if (spec.templateId === "moba") {
    objective = zh ? "摧毁所有 AI 方塔，保护己方塔" : "Destroy all enemy towers while protecting yours";
    controls = zh ? "WASD/方向键 移动 · Q/W/E 技能 · 空格 普攻" : "WASD/arrows move · Q/W/E skills · Space attack";
    stakes = zh ? "优先推最近外塔，控制中路节奏" : "Clear the nearest tower first to control the lane";
  } else if (spec.templateId === "horror") {
    const nights = spec.horror?.nights ?? 3;
    objective = zh ? `撑过 ${nights} 夜，关门阻挡摄像头怪物` : `Survive ${nights} nights by closing doors on monsters`;
    controls = zh ? "1-6 切换摄像头 · 空格/按钮 关门阻挡" : "1-6 switch camera · Space/button to close door";
    stakes = zh ? "关门耗电，电力耗尽即失败" : "Doors drain power — run out of power and you lose";
  } else if (spec.templateId === "strategy") {
    objective = zh ? "调兵遣将，摧毁敌方据点并守住防线" : "Command forces, destroy the enemy HQ and hold your base";
    controls = zh ? "点击选择单位，点击目标移动/攻击，Shift 技能" : "Click unit to select, click target to move/attack, Shift for skill";
    stakes = zh ? "兵种克制是关键，分阶段推进" : "Counter-units matter; advance in stages";
  } else if (spec.templateId === "rhythm") {
    objective = zh ? `命中节拍，达到 ${score} 分` : `Hit the beats and reach ${score} points`;
    controls = zh ? "D / F / J / K 按对应轨道节点 · 或点击轨道区域" : "D/F/J/K to hit notes · or tap the lane zones";
    stakes = zh ? "连续命中叠加 Combo，miss 会重置倍率" : "Sustain combo for multiplier; misses reset it";
  } else if (spec.templateId === "breakout") {
    objective = zh ? "打破所有砖块，球不能落地" : "Break all bricks without letting the ball fall";
    controls = zh ? "鼠标/触控 左右移动挡板" : "Move paddle with mouse or touch";
    stakes = zh ? "用边角反弹可连续打到更多砖块" : "Corner angles let you hit multiple bricks at once";
  } else if (spec.templateId === "tetris") {
    const tetLines = spec.tetris?.targetLines ?? 20;
    objective = zh ? `消除 ${tetLines} 行方块通关` : `Clear ${tetLines} lines to win`;
    controls = zh ? "← → 移动 · ↑ 旋转 · ↓ 软降 · 空格 硬降 · P 暂停" : "← → move · ↑ rotate · ↓ soft drop · Space hard drop · P pause";
    stakes = zh ? "一次消多行得分更高，保持顶部留有空间" : "Clearing multiple lines at once scores higher";
  } else if (spec.templateId === "sports") {
    objective = zh ? `投篮/射门 ${score} 次得分通关` : `Score ${score} goals/baskets to win`;
    controls = zh ? "← → / A D 移动 · 按住空格蓄力，松开投篮" : "← →/A/D move · hold Space to charge, release to shoot";
    stakes = zh ? "蓄力越足力道越大，注意目标的移动节奏" : "More charge = more power; track the goal's drift";
  } else if (spec.templateId === "physics") {
    objective = zh ? "利用物理弹射击中目标，累计得分" : "Use physics to launch projectiles and hit targets";
    controls = zh ? "拖拽或点击施力，调整角度与力度" : "Drag or click to apply force; adjust angle and power";
    stakes = zh ? "借反弹和连锁一次打到多个目标" : "Use bounces and chains to hit multiple targets at once";
  } else if (
    spec.templateId === "dou-dizhu" ||
    spec.templateId === "poker" ||
    spec.templateId === "blackjack"
  ) {
    objective = zh ? "赢得牌局，出完手牌或击败对手" : "Win the hand by playing out cards or outplaying the opponent";
    controls = zh ? "点击牌选中，点击「出牌」提交，点击「不要」跳过" : "Click cards to select · 'Play' to submit · 'Pass' to skip";
    stakes = zh ? "读懂对手出牌节奏，掌握手牌节奏" : "Read opponent patterns and manage your hand wisely";
  } else if (spec.templateId === "mahjong" || spec.templateId === "mahjong-solitaire") {
    objective = zh ? "匹配并消除牌型，完成胡牌/消除目标" : "Match tiles to clear the board or complete a winning hand";
    controls = zh ? "点击选择麻将牌，相同牌型可消除" : "Click tiles to select; matching pairs clear together";
    stakes = zh ? "优先消除孤立牌，避免死局" : "Clear isolated tiles first to avoid deadlock";
  } else if (spec.templateId === "chess") {
    objective = zh ? "将死对方王，赢得棋局" : "Checkmate the opponent's king to win";
    controls = zh ? "点击己方棋子，再点击目标格落子" : "Click your piece, then click a target square";
    stakes = zh ? "控制中心、发展子力，再寻找将军机会" : "Control center, develop pieces, then look for checks";
  } else if (spec.templateId === "uno") {
    objective = zh ? "率先出完手牌赢得胜利" : "Be the first to play all your cards";
    controls = zh ? "点击可出的牌出牌，无牌可出时摸牌" : "Click a playable card to play it, or draw when stuck";
    stakes = zh ? "保留功能牌在关键时机使用" : "Save action cards for the right moment";
  } else if (spec.templateId === "solitaire") {
    objective = zh ? "按规则将所有牌移至基础堆" : "Move all cards to the foundation piles in order";
    controls = zh ? "点击或拖拽牌到合法位置" : "Click or drag cards to valid positions";
    stakes = zh ? "提前规划移牌路径，避免死局" : "Plan ahead to avoid blocking yourself";
  } else if (spec.templateId === "racing" || spec.templateId === "coaster") {
    const coasterMode = spec.coaster?.mode;
    if (variantId === "temple-relic-runner" || coasterMode === "endlessRoad") {
      objective = zh
        ? `无尽奔跑，躲避滚石/断柱/横梁，收集${collectible}`
        : `Run endlessly, dodge rocks/pillars/beams, and collect ${collectible}`;
      controls = zh
        ? "A/D 或 ←→ 换道 · W/空格 跳跃 · S/↓ 滑铲 · 鼠标点按/滑动"
        : "A/D or arrows to switch lanes · W/Space jump · S/Down slide · tap/swipe";
      stakes = zh
        ? "追兵条会随时间上涨；吃金币、过弯道可拉开距离；满条则被抓住"
        : "Chaser bar rises over time — coins and drift turns push it back; max means caught";
    } else {
      objective = zh ? `沿轨道竞速完赛，用 Boost/Brake 控制节奏` : "Race the track to the finish using boost and brake";
      controls = zh ? "E/右键 Boost · Q/左键 Brake · V 切换视角" : "E/right boost · Q/left brake · V toggle camera";
      stakes = zh ? "下坡加速、上坡减速，尽量刷新最快时间" : "Hills change speed — chase your best time";
    }
  }

  const message = zh ? `目标：${objective}｜操作：${controls}` : `Goal: ${objective} | Controls: ${controls}`;
  const bannerMs = variantId === "temple-relic-runner" ? 1600 : 2200;

  return {
    title,
    objective,
    controls,
    stakes,
    banner: { title, message, ms: bannerMs },
    bottomHint: zh ? `操作：${controls} · ${stakes}` : `Controls: ${controls} · ${stakes}`,
  };
}

/** 已有左上 Goal 面板时，开场 Banner 只闪标题，避免与顶栏长文案叠层发糊 */
export function introBannerWhenGoalPanel(guidance: SceneGoalGuidance): SceneGoalGuidance["banner"] {
  const shortTitle = guidance.banner.title.split("·")[0]?.trim() || guidance.banner.title;
  return {
    title: shortTitle,
    message: "",
    ms: Math.min(guidance.banner.ms, 1400),
  };
}
