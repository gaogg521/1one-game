import type { CreativeBrief } from "@/lib/creative-brief/types";
import type { GameSpec } from "@/lib/game-spec";
import { buildBriefVisualDirection } from "@/lib/assets/brief-visual-direction";
import {
  resolveAnimationSet,
  resolveAssetStyle,
  resolveMusicProfile,
  resolveParticleIntensity,
  resolveShaderPack,
  type VisualAnimationSet,
} from "@/lib/cohesive-presentation";

export type FirstMinuteBeat = {
  window: "0-5" | "5-20" | "20-40" | "40-60";
  goal: string;
  signals: string[];
};

/**
 * 一分钟体验合同不是运行时配置。它将“玩家第一分钟应该感受到什么”固定为
 * 可审阅、可度量的产品语言，供生成调试、QA 和之后的发布门禁共用。
 */
export type GameExperienceContract = {
  playerFantasy: string;
  coreAction: string;
  signatureDelight: string;
  firstMinute: FirstMinuteBeat[];
};

export type CharacterActionCue = {
  id: string;
  moment: string;
  feedback: string;
};

/**
 * 从实际可解析的 GameSpec 和 Creative Brief 汇总出的美术/声音/动作合同。
 * 它是资产制作与人工验收的共同输入，不会在这里伪造或替换运行时资产。
 */
export type GameArtDirectionPack = {
  visual: {
    assetStyle: string;
    shaderPack: string;
    particleIntensity: string;
    animationSet: VisualAnimationSet;
    colors: GameSpec["theme"];
  };
  audio: {
    musicProfile: string;
    bgmTag?: string;
    sfxPack?: string;
  };
  anchors: {
    world: string;
    scene: string;
    units: string[];
    mood: string[];
    vfx: string[];
  };
  characterActions: CharacterActionCue[];
};

export type GameVerticalSliceScorecard = {
  version: 1;
  templateId: GameSpec["templateId"];
  contract: GameExperienceContract;
  artDirection: GameArtDirectionPack;
  dimensions: {
    clarity: number;
    pacing: number;
    agency: number;
    presentation: number;
    feel: number;
  };
  score: number;
  verdict: "ready" | "needs_polish" | "blocked";
  reasons: string[];
};

type ExperienceShape = Pick<GameExperienceContract, "coreAction" | "signatureDelight" | "firstMinute">;

const DEFAULT_ACTIONS: CharacterActionCue[] = [
  { id: "idle", moment: "首次可玩画面", feedback: "角色或核心物件有呼吸、待机或轻微节奏" },
  { id: "core-action", moment: "每次核心操作", feedback: "输入、动画和音效在一个动作内对应" },
  { id: "impact", moment: "命中、失败或关键反馈", feedback: "颜色、粒子、镜头或音效至少两项同步" },
  { id: "celebrate", moment: "完成目标或触发高潮", feedback: "奖励、短暂停顿和明确的正反馈" },
];

const ACTIONS_BY_TEMPLATE: Partial<Record<GameSpec["templateId"], CharacterActionCue[]>> = {
  "endless-runner": [
    { id: "run", moment: "开局至全程", feedback: "持续跑步循环与节奏型脚步音" },
    { id: "lane-shift", moment: "换道", feedback: "位移拖影与短促闪避音" },
    { id: "near-miss", moment: "贴边躲避", feedback: "短暂镜头推拉和奖励提示" },
    { id: "impact-or-finish", moment: "碰撞或冲刺结算", feedback: "强对比特效、震动和清晰结果" },
  ],
  puzzle: [
    { id: "select", moment: "选中棋子", feedback: "高亮、缩放和可交换提示" },
    { id: "swap", moment: "交换", feedback: "移动补间与交换音" },
    { id: "cascade", moment: "连消", feedback: "由小到大的粒子、音高和数字反馈" },
    { id: "booster", moment: "特殊棋子", feedback: "短暂停顿、范围特效和明确清屏结果" },
  ],
  physics: [
    { id: "aim", moment: "拖拽或瞄准", feedback: "轨迹/力度预览" },
    { id: "release", moment: "松手释放", feedback: "蓄力音效和可感知的初速度" },
    { id: "collision-chain", moment: "连锁碰撞", feedback: "碰撞音、粒子和分数级联" },
    { id: "precision-finish", moment: "精准完成", feedback: "慢放或镜头强调后结算" },
  ],
  platformer: [
    { id: "run", moment: "地面移动", feedback: "移动循环与地表反馈" },
    { id: "jump", moment: "跳跃/二段跳", feedback: "起跳、空中和落地三段反馈" },
    { id: "collect", moment: "获得收集物", feedback: "吸附、粒子和音高递进" },
    { id: "land-or-hit", moment: "精准落点或受击", feedback: "落地压缩或受击闪烁，结果明确" },
  ],
  farming: [
    { id: "idle", moment: "农场待机", feedback: "作物、角色或环境有轻微生命感" },
    { id: "plant", moment: "种植", feedback: "地块状态立即变化" },
    { id: "water-or-grow", moment: "照料/成长", feedback: "成长阶段可见且伴随轻量音效" },
    { id: "harvest", moment: "收获", feedback: "飞出收益、粒子和下一目标提示" },
  ],
};

const DEFAULT_SHAPE: ExperienceShape = {
  coreAction: "识别局势、做出一次明确操作，并立刻看到结果",
  signatureDelight: "一次清晰的奖励、升级或局势反转",
  firstMinute: [
    { window: "0-5", goal: "看见目标并完成第一次操作", signals: ["目标", "操作反馈"] },
    { window: "5-20", goal: "掌握核心循环", signals: ["奖励", "风险"] },
    { window: "20-40", goal: "遇到第一处变化并作出选择", signals: ["变奏", "选择"] },
    { window: "40-60", goal: "完成一次可分享的高潮或结算", signals: ["高潮", "结算"] },
  ],
};

const EXPERIENCE_BY_TEMPLATE: Partial<Record<GameSpec["templateId"], ExperienceShape>> = {
  "endless-runner": {
    coreAction: "切换跑道、躲开障碍并吃到高价值收集物",
    signatureDelight: "连续闪避后触发短暂加速或高价值收集雨",
    firstMinute: [
      { window: "0-5", goal: "滑动换道，安全越过第一组障碍", signals: ["单指操作", "近失反馈"] },
      { window: "5-20", goal: "建立连续收集与闪避节奏", signals: ["连击", "收集音效"] },
      { window: "20-40", goal: "面对更密集路线并选择风险收益", signals: ["路线分叉", "加速"] },
      { window: "40-60", goal: "用一次高潮事件结束首局", signals: ["冲刺", "结算"] },
    ],
  },
  puzzle: {
    coreAction: "交换或连接棋子，制造连消与特殊棋子",
    signatureDelight: "一次四连以上的清屏、爆炸或连锁反应",
    firstMinute: [
      { window: "0-5", goal: "完成第一手有效消除", signals: ["可交换提示", "命中反馈"] },
      { window: "5-20", goal: "看懂目标并打出第一次连消", signals: ["目标进度", "连击"] },
      { window: "20-40", goal: "生成或使用特殊棋子解决变化", signals: ["特殊棋子", "选择"] },
      { window: "40-60", goal: "以一次清晰结算收束首关", signals: ["高潮清屏", "胜负结算"] },
    ],
  },
  physics: {
    coreAction: "拖拽、瞄准或释放，让物理连锁达成目标",
    signatureDelight: "一次可预期又带意外的连锁碰撞",
    firstMinute: [
      { window: "0-5", goal: "完成一次低门槛拖拽或释放", signals: ["轨迹预览", "碰撞反馈"] },
      { window: "5-20", goal: "理解目标与物理规则", signals: ["目标提示", "连锁得分"] },
      { window: "20-40", goal: "用角度或力度解决第一处变化", signals: ["策略选择", "风险回报"] },
      { window: "40-60", goal: "以一次大连锁或精准通关结束", signals: ["慢镜/震动", "结算"] },
    ],
  },
  platformer: {
    coreAction: "移动、跳跃并用机动穿过平台与危险区",
    signatureDelight: "一次精准跳跃、二段跳或连贯穿越",
    firstMinute: [
      { window: "0-5", goal: "移动并完成第一次跳跃", signals: ["移动响应", "落地反馈"] },
      { window: "5-20", goal: "掌握障碍节奏与收集路线", signals: ["收集", "安全落点"] },
      { window: "20-40", goal: "用机动能力通过第一段挑战", signals: ["二段跳/冲刺", "风险回报"] },
      { window: "40-60", goal: "完成一段可记住的穿越或小高潮", signals: ["段落提示", "结算"] },
    ],
  },
  farming: {
    coreAction: "选择作物、种植收获，并把收益投入下一次选择",
    signatureDelight: "第一次成熟收获立刻解锁更高价值选择",
    firstMinute: [
      { window: "0-5", goal: "选中地块并种下第一颗种子", signals: ["地块高亮", "种植反馈"] },
      { window: "5-20", goal: "完成第一次浇灌或收获循环", signals: ["成长状态", "收益"] },
      { window: "20-40", goal: "根据金币作出第一笔经营选择", signals: ["价格", "解锁"] },
      { window: "40-60", goal: "收获一轮成果并看见下一目标", signals: ["收获高潮", "目标更新"] },
    ],
  },
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function hasTemplateDepth(spec: GameSpec): boolean {
  switch (spec.templateId) {
    case "endless-runner":
      return Boolean(spec.endlessRunner);
    case "puzzle":
      return Boolean(spec.puzzle?.objectives?.length || spec.puzzle?.boosters?.length || spec.puzzle?.specialTiles?.length);
    case "physics":
      return Boolean(spec.systems?.skill || spec.systems?.powerups?.length);
    case "platformer":
      return Boolean(spec.platformer?.doubleJump || spec.platformer?.grappleEnabled || spec.platformer?.levelLayers);
    case "farming":
      return Boolean(spec.farming?.crops?.length);
    default:
      return Boolean(spec.systems?.skill || spec.systems?.powerups?.length);
  }
}

export function buildGameExperienceContract(spec: GameSpec, brief?: CreativeBrief): GameExperienceContract {
  const shape = EXPERIENCE_BY_TEMPLATE[spec.templateId] ?? DEFAULT_SHAPE;
  const fantasy = brief?.logline?.trim() || spec.labels.subtitle?.trim() || `${spec.title}中的${spec.labels.player}`;
  return {
    playerFantasy: fantasy,
    coreAction: shape.coreAction,
    signatureDelight: shape.signatureDelight,
    firstMinute: shape.firstMinute,
  };
}

export function buildGameArtDirectionPack(spec: GameSpec, brief?: CreativeBrief): GameArtDirectionPack {
  const visualDirection = buildBriefVisualDirection(brief);
  return {
    visual: {
      assetStyle: resolveAssetStyle(spec),
      shaderPack: resolveShaderPack(spec),
      particleIntensity: resolveParticleIntensity(spec),
      animationSet: resolveAnimationSet(spec),
      colors: spec.theme,
    },
    audio: {
      musicProfile: resolveMusicProfile(spec),
      ...(spec.presentation?.bgmTag ? { bgmTag: spec.presentation.bgmTag } : {}),
      ...(spec.presentation?.sfxPack ? { sfxPack: spec.presentation.sfxPack } : {}),
    },
    anchors: {
      world: visualDirection?.worldLine || spec.labels.subtitle || spec.title,
      scene: visualDirection?.sceneLine || spec.title,
      units: brief?.units.slice(0, 4) ?? [spec.labels.player, spec.labels.hazard],
      mood: brief?.mood.slice(0, 5) ?? [resolveMusicProfile(spec)],
      vfx: brief?.vfx.slice(0, 4) ?? (spec.director?.events ?? []).slice(0, 4).map((event) => event.type),
    },
    characterActions: ACTIONS_BY_TEMPLATE[spec.templateId] ?? DEFAULT_ACTIONS,
  };
}

/**
 * 纯静态评分：不调用模型、不改变 spec。它验证生成物是否已有一款可试玩成品
 * 所必须的首分钟节奏、操作空间、表现层和反馈基础。
 */
export function evaluateGameVerticalSlice(spec: GameSpec, brief?: CreativeBrief): GameVerticalSliceScorecard {
  const reasons: string[] = [];
  const artDirection = buildGameArtDirectionPack(spec, brief);
  const events = spec.director?.events ?? [];
  const acts = spec.director?.acts ?? [];
  const hasEarlyEvent = events.some((event) => event.at <= 0.35);
  const hasMidEvent = events.some((event) => event.at > 0.35 && event.at <= 0.7);
  const hasLateEvent = events.some((event) => event.at > 0.7);
  const uniqueEventTypes = new Set(events.map((event) => event.type)).size;

  const clarity = clampScore(
    30 +
      (spec.title.trim().length >= 2 ? 20 : 0) +
      (spec.labels.player.trim().length >= 1 ? 20 : 0) +
      (spec.labels.hazard.trim().length >= 1 ? 15 : 0) +
      (spec.labels.subtitle?.trim() ? 15 : 0),
  );
  if (clarity < 75) reasons.push("missing_player_facing_goal_copy");

  const pacing = clampScore(
    (acts.length >= 4 ? 40 : acts.length * 10) +
      (hasEarlyEvent ? 15 : 0) +
      (hasMidEvent ? 15 : 0) +
      (hasLateEvent ? 15 : 0) +
      (uniqueEventTypes >= 3 ? 15 : uniqueEventTypes * 5),
  );
  if (acts.length < 4) reasons.push("first_minute_needs_four_acts");
  if (!hasEarlyEvent) reasons.push("missing_early_hook_event");
  if (!hasMidEvent) reasons.push("missing_midgame_variation");
  if (!hasLateEvent) reasons.push("missing_first_minute_payoff");

  const agency = clampScore(
    35 +
      (spec.systems?.skill ? 25 : 0) +
      ((spec.systems?.powerups?.length ?? 0) >= 2 ? 20 : 0) +
      (hasTemplateDepth(spec) ? 20 : 0),
  );
  if (agency < 65) reasons.push("needs_meaningful_player_choice");

  const presentation = clampScore(
    (artDirection.visual.assetStyle ? 25 : 0) +
      (artDirection.audio.musicProfile ? 20 : 0) +
      (spec.presentation?.hudFontStyle ? 15 : 0) +
      (spec.presentation?.qualityTier && spec.presentation.qualityTier !== "minimal" ? 20 : 0) +
      (artDirection.audio.bgmTag ? 10 : 0) +
      (artDirection.audio.sfxPack ? 10 : 0),
  );
  if (presentation < 70) reasons.push("presentation_pack_incomplete");

  const feel = clampScore(
    (spec.theme.particleTint ? 15 : 0) +
      (artDirection.visual.particleIntensity !== "minimal" ? 20 : 0) +
      (artDirection.visual.animationSet !== "none" ? 25 : 0) +
      (spec.systems?.skill ? 20 : 0) +
      ((spec.systems?.powerups?.length ?? 0) >= 2 ? 20 : 0),
  );
  if (feel < 55) reasons.push("feedback_and_action_polish_missing");

  const dimensions = { clarity, pacing, agency, presentation, feel };
  const score = clampScore((clarity + pacing + agency + presentation + feel) / 5);
  const hardBlock = pacing < 45 || presentation < 45;
  const verdict = hardBlock ? "blocked" : score >= 75 && Object.values(dimensions).every((value) => value >= 55) ? "ready" : "needs_polish";

  return {
    version: 1,
    templateId: spec.templateId,
    contract: buildGameExperienceContract(spec, brief),
    artDirection,
    dimensions,
    score,
    verdict,
    reasons,
  };
}
