/**
 * Scene 质量门禁 —— 移植自 threejs-game-skills 的 reference gate + debug-profiler 失败模式清单。
 *
 * 1. Reference Gate：4 步共创"提炼意图"后，检查必需 reference 是否就位（template-brief-override + playableLoop），
 *    缺失则返回 block 理由，前端禁止进入"生成"阶段。
 * 2. Failure Mode Checklist：Scene 常见失败模式（static demo / 输入触发不了 / camera 延迟 / state 不驱动 UI / 过早抽象），
 *    供生成后 QA 与前端"制作过程"面板展示。
 */
import { getTemplateBriefOverride } from "@/lib/creative-brief/template-brief-overrides";
import { detectTemplateFromPrompt } from "@/lib/template-selector";

export type GateResult = {
  passed: boolean;
  templateId: string;
  missing: string[];
  warnings: string[];
};

/** Reference Gate：检查 template-brief-override + playableLoop 是否就位 */
export function checkReferenceGate(prompt: string, templateHint?: string): GateResult {
  const templateId = (templateHint && templateHint !== "auto")
    ? templateHint
    : (detectTemplateFromPrompt(prompt.trim()) ?? "avoider");
  const ov = getTemplateBriefOverride(templateId);
  const missing: string[] = [];
  const warnings: string[] = [];

  if (!ov) {
    missing.push(`template-brief-override[${templateId}] 不存在，将走 general-arcade 兜底（创意解读可能与提示词无关）`);
  } else {
    if (ov.world.length < 10) missing.push(`${templateId}.world 过短`);
    if (ov.scenes.length < 2) warnings.push(`${templateId}.scenes 不足 2 个`);
    if (!ov.playableLoop) {
      warnings.push(`${templateId}.playableLoop 缺失——LLM 缺少"verb/objective/feedback/failRetry"结构化玩法定义`);
    }
    if (ov.gameplayHints.length < 2) warnings.push(`${templateId}.gameplayHints 不足 2 条`);
  }

  return {
    passed: missing.length === 0,
    templateId,
    missing,
    warnings,
  };
}

/** Debug-profiler 失败模式清单（移植自 threejs-game-skills gameplay-systems common failure modes） */
export const SCENE_FAILURE_MODES = [
  {
    mode: "static-demo",
    symptom: "画面渲染了但不动——Scene update 循环没跑（rAF 节流 / finished=true / loop paused）",
    check: "按方向键/点击后 playerX 不变、画面像素静止",
  },
  {
    mode: "input-not-triggered",
    symptom: "按键无反应——输入没进 Phaser（canvas 未聚焦 / input.keyboard 未绑 / JustDown 在非 active scene）",
    check: "console 无错但 playerX/qaTouches 不变；pointerdown 事件 canvas 收到但 Scene handler 不触发",
  },
  {
    mode: "camera-delay",
    symptom: "相机跟随延迟或遮挡下一个决策点——玩家看不到即将到来的威胁",
    check: "主角始终在屏幕正中且前方视野 < 30% 屏宽",
  },
  {
    mode: "state-no-ui-vfx",
    symptom: "状态变化不驱动 UI/音频/VFX——分数变了 HUD 不更新、combo 不出特效",
    check: "score/lives 变化后 HUD 文字未刷新、juicePickup 未触发",
  },
  {
    mode: "premature-abstraction",
    symptom: "过早抽象——机制还没跑通就建了实体组件系统，导致改不动",
    check: "Entity/System 类存在但玩法仍不可玩",
  },
  {
    mode: "geometry-placeholder",
    symptom: "玩家/敌人是纯几何形状（矩形+圆头），无 emoji 无纹理无细节",
    check: "add.circle/add.rectangle 直接当玩家/敌人，无 setTexture/emoji",
  },
  {
    mode: "brief-spec-mismatch",
    symptom: "Creative Brief 与 spec.templateId 撕裂——brief 说 endless-runner 但 spec 渲染 platformer",
    check: "brief.packId 与 spec.templateId 不一致",
  },
] as const;

export type FailureMode = (typeof SCENE_FAILURE_MODES)[number];

/** 对生成的 spec 做失败模式静态扫描（不跑 Phaser，只看 spec 字段） */
export function scanFailureModes(spec: {
  templateId: string;
  title?: string;
  gameplay?: { playerSpeed?: number; hazardSpeed?: number; lives?: number; winScore?: number };
  director?: { events?: unknown[] };
  labels?: { player?: string; hazard?: string; collectible?: string };
}): { mode: string; triggered: boolean; detail: string }[] {
  const results: { mode: string; triggered: boolean; detail: string }[] = [];
  const gp = spec.gameplay ?? {};

  // state-no-ui-vfx：director.events 空
  const events = spec.director?.events ?? [];
  results.push({
    mode: "state-no-ui-vfx",
    triggered: events.length === 0,
    detail: events.length === 0 ? "director.events 为空，状态变化无事件驱动" : `director.events ${events.length} 个`,
  });

  // geometry-placeholder：templateId 不在已知 emoji/精致程序化名单
  const okTemplates = new Set([
    "fruit-ninja", "moba", "sports", "fighting", "endless-runner", "breakout", "horror", "strategy",
    "chess", "farming", "platformer", "shooter", "towerDefense", "play", "coaster", "physics",
    "tetris", "merge", "mahjong", "mahjong-solitaire", "dou-dizhu", "uno", "poker", "solitaire",
    "blackjack", "rhythm", "puzzle", "customization", "coloring", "pet", "cafe", "cooking",
    "garden", "tycoon", "dating-sim",
  ]);
  results.push({
    mode: "geometry-placeholder",
    triggered: !okTemplates.has(spec.templateId),
    detail: okTemplates.has(spec.templateId)
      ? `${spec.templateId} 已用 emoji/精致程序化`
      : `${spec.templateId} 视觉未确认，可能几何占位`,
  });

  // 数值缺失导致 input-not-triggered 的间接信号
  const badNums: string[] = [];
  if (!gp.playerSpeed || gp.playerSpeed < 100) badNums.push("playerSpeed");
  if (!gp.lives || gp.lives < 1) badNums.push("lives");
  if (!gp.winScore || gp.winScore < 1) badNums.push("winScore");
  results.push({
    mode: "input-not-triggered",
    triggered: badNums.length > 0,
    detail: badNums.length ? `数值缺失/异常: ${badNums.join(",")}` : "数值合理",
  });

  return results;
}
