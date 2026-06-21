/**
 * Visual Scorecard — 10 维视觉质量评分（移植自 threejs-game-skills AAA graphics builder）。
 *
 * 对生成的 GameSpec 做静态评分（不跑 Phaser，只看 spec 字段完整性 + template-brief-overrides 对齐度），
 * 低于阈值的维度触发"视觉返工"建议。
 *
 * 10 维（每维 0-3 分，0=缺失/占位，1=基础，2=合格，3=精致）：
 *  1. artDirection   — 标题/副标题/世界观命名是否统一
 *  2. hero           — 玩家角色是否有 emoji/精致程序化（非裸几何）
 *  3. obstacles      — 敌人/障碍是否有 emoji/精致程序化
 *  4. rewards        — 收集物/金币是否有 emoji/精致程序化
 *  5. world          — 场景/背景是否有主题感（非纯色底）
 *  6. materials      — 配色是否完整（bg/player/hazard/collectible/particle 5 色）
 *  7. lighting       — musicProfile/presentation 是否设定
 *  8. vfx            — director.events 是否有视觉事件（combo/bonus/danger）
 *  9. ui             — labels 是否齐全（player/hazard/collectible/subtitle）
 * 10. perf           — gameplay 数值是否在合理区间（非 0/非极端）
 */
import type { GameSpec } from "@/lib/game-spec";
import { getTemplateBriefOverride } from "@/lib/creative-brief/template-brief-overrides";

export type ScorecardDimension =
  | "artDirection"
  | "hero"
  | "obstacles"
  | "rewards"
  | "world"
  | "materials"
  | "lighting"
  | "vfx"
  | "ui"
  | "perf";

export type DimensionScore = {
  dimension: ScorecardDimension;
  score: 0 | 1 | 2 | 3;
  reason: string;
};

export type VisualScorecard = {
  scores: DimensionScore[];
  average: number;
  automaticFailures: string[];
  passing: boolean; // average >= 2 且无 automaticFailure
  reworkSuggestions: string[];
};

const PASS_THRESHOLD = 2.0;

/** 已知用 emoji 或精致程序化渲染的模板（审计结论） */
const EMOJI_OK_TEMPLATES = new Set([
  "fruit-ninja", "moba", "sports", "fighting", "endless-runner",
  "breakout", "horror", "strategy", "chess", "farming",
]);
const PROCEDURAL_OK_TEMPLATES = new Set([
  "platformer", "shooter", "towerDefense", "play", "coaster",
  "physics", "tetris", "merge", "mahjong", "mahjong-solitaire",
  "dou-dizhu", "uno", "poker", "solitaire", "blackjack",
  "rhythm", "puzzle", "customization", "coloring", "pet",
  "cafe", "cooking", "garden", "tycoon", "dating-sim",
]);

function scoreArtDirection(spec: GameSpec): DimensionScore {
  const title = (spec.title ?? "").trim();
  const subtitle = (spec.labels?.subtitle ?? "").trim();
  if (!title) return { dimension: "artDirection", score: 0, reason: "无标题" };
  if (!subtitle) return { dimension: "artDirection", score: 1, reason: "有标题无副标题" };
  // 标题与副标题是否风格一致（简单启发：都有内容且长度合理）
  if (title.length >= 2 && subtitle.length >= 2) {
    return { dimension: "artDirection", score: 3, reason: "标题+副标题完整" };
  }
  return { dimension: "artDirection", score: 2, reason: "标题/副标题偏短" };
}

function scoreHero(spec: GameSpec): DimensionScore {
  const t = spec.templateId;
  if (EMOJI_OK_TEMPLATES.has(t) || PROCEDURAL_OK_TEMPLATES.has(t)) {
    return { dimension: "hero", score: 3, reason: `${t} 已用 emoji/精致程序化角色` };
  }
  // 卡牌/棋类无玩家角色概念，算合格
  if (["card", "checkers", "chinese-checkers", "junqi", "aeroplane-chess", "turn-based", "auto-battler", "idle", "sandbox", "hidden-object", "word-game", "escape-room", "mystery"].includes(t)) {
    return { dimension: "hero", score: 2, reason: `${t} 无玩家角色概念，合格` };
  }
  return { dimension: "hero", score: 1, reason: `${t} 角色视觉未确认，可能几何占位` };
}

function scoreObstacles(spec: GameSpec): DimensionScore {
  const t = spec.templateId;
  // 无敌人/障碍的模板（卡牌/棋/模拟经营）
  const noObstacle = ["card", "mahjong", "mahjong-solitaire", "dou-dizhu", "uno", "poker", "solitaire", "blackjack", "chess", "checkers", "chinese-checkers", "junqi", "aeroplane-chess", "farming", "garden", "cafe", "cooking", "tycoon", "pet", "idle", "customization", "coloring", "dating-sim", "sandbox", "merge", "tetris"];
  if (noObstacle.includes(t)) {
    return { dimension: "obstacles", score: 3, reason: `${t} 无敌人概念，N/A 计满` };
  }
  if (EMOJI_OK_TEMPLATES.has(t) || PROCEDURAL_OK_TEMPLATES.has(t)) {
    return { dimension: "obstacles", score: 3, reason: `${t} 敌人已 emoji/精致程序化` };
  }
  return { dimension: "obstacles", score: 1, reason: `${t} 敌人视觉未确认` };
}

function scoreRewards(spec: GameSpec): DimensionScore {
  const t = spec.templateId;
  const noRewards = ["chess", "checkers", "chinese-checkers", "junqi", "aeroplane-chess", "horror", "escape-room", "mystery", "dating-sim"];
  if (noRewards.includes(t)) {
    return { dimension: "rewards", score: 3, reason: `${t} 无收集物概念，N/A 计满` };
  }
  if (EMOJI_OK_TEMPLATES.has(t) || PROCEDURAL_OK_TEMPLATES.has(t)) {
    return { dimension: "rewards", score: 3, reason: `${t} 收集物已 emoji/精致程序化` };
  }
  return { dimension: "rewards", score: 1, reason: `${t} 收集物视觉未确认` };
}

function scoreWorld(spec: GameSpec): DimensionScore {
  const ov = getTemplateBriefOverride(spec.templateId);
  if (!ov) return { dimension: "world", score: 1, reason: "无 template override，世界观未定" };
  if (ov.scenes.length >= 3 && ov.world.length > 10) {
    return { dimension: "world", score: 3, reason: "世界观+场景完整" };
  }
  if (ov.scenes.length >= 1) {
    return { dimension: "world", score: 2, reason: "有场景但不够丰富" };
  }
  return { dimension: "world", score: 1, reason: "场景缺失" };
}

function scoreMaterials(spec: GameSpec): DimensionScore {
  const th = spec.theme;
  const has = (c?: string) => Boolean(c && c.trim() && c.trim() !== "#000000");
  const count = [
    has(th.backgroundColor),
    has(th.playerColor),
    has(th.hazardColor),
    has(th.collectibleColor),
    has(th.particleTint),
  ].filter(Boolean).length;
  if (count >= 5) return { dimension: "materials", score: 3, reason: `5 色完整` };
  if (count >= 3) return { dimension: "materials", score: 2, reason: `${count}/5 色齐全` };
  return { dimension: "materials", score: 1, reason: `仅 ${count}/5 色` };
}

function scoreLighting(spec: GameSpec): DimensionScore {
  const mp = spec.presentation?.musicProfile;
  if (mp && ["organic", "pulse", "minimal", "neon"].includes(mp)) {
    return { dimension: "lighting", score: 3, reason: `musicProfile=${mp}` };
  }
  return { dimension: "lighting", score: 1, reason: "无 musicProfile" };
}

function scoreVfx(spec: GameSpec): DimensionScore {
  const events = spec.director?.events ?? [];
  const visualTypes = events.filter((e) =>
    ["comboBonus", "coinRain", "danger", "goalShift", "victory", "boss", "elite"].includes(e.type),
  );
  if (visualTypes.length >= 3) return { dimension: "vfx", score: 3, reason: `${visualTypes.length} 个视觉事件` };
  if (visualTypes.length >= 1) return { dimension: "vfx", score: 2, reason: `${visualTypes.length} 个视觉事件` };
  return { dimension: "vfx", score: 1, reason: "无视觉事件" };
}

function scoreUi(spec: GameSpec): DimensionScore {
  const labels = spec.labels ?? {};
  const has = (v?: string) => Boolean(v && v.trim());
  const count = [
    has(labels.player),
    has(labels.hazard),
    has(labels.collectible),
    has(labels.subtitle),
  ].filter(Boolean).length;
  if (count >= 4) return { dimension: "ui", score: 3, reason: `4 标签完整` };
  if (count >= 2) return { dimension: "ui", score: 2, reason: `${count}/4 标签` };
  return { dimension: "ui", score: 1, reason: `仅 ${count}/4 标签` };
}

function scorePerf(spec: GameSpec): DimensionScore {
  const gp = spec.gameplay;
  const issues: string[] = [];
  if (!gp.playerSpeed || gp.playerSpeed < 100) issues.push("playerSpeed 过低");
  if (!gp.hazardSpeed || gp.hazardSpeed < 50) issues.push("hazardSpeed 过低");
  if (!gp.spawnIntervalMs || gp.spawnIntervalMs < 200) issues.push("spawnIntervalMs 过密");
  if (!gp.winScore || gp.winScore < 1) issues.push("winScore 缺失");
  if (!gp.lives || gp.lives < 1) issues.push("lives 缺失");
  if (issues.length === 0) return { dimension: "perf", score: 3, reason: "数值合理" };
  if (issues.length <= 2) return { dimension: "perf", score: 2, reason: issues.join(";") };
  return { dimension: "perf", score: 1, reason: issues.join(";") };
}

export function scoreVisualQuality(spec: GameSpec): VisualScorecard {
  const scores: DimensionScore[] = [
    scoreArtDirection(spec),
    scoreHero(spec),
    scoreObstacles(spec),
    scoreRewards(spec),
    scoreWorld(spec),
    scoreMaterials(spec),
    scoreLighting(spec),
    scoreVfx(spec),
    scoreUi(spec),
    scorePerf(spec),
  ];
  const average = scores.reduce((s, d) => s + d.score, 0) / scores.length;

  const automaticFailures: string[] = [];
  // 自动失败：任一维度 0 分
  for (const d of scores) {
    if (d.score === 0) automaticFailures.push(`${d.dimension}: ${d.reason}`);
  }
  // 自动失败：artDirection 或 hero 为 1（太弱）
  if (scores.find((d) => d.dimension === "artDirection")?.score === 1) {
    automaticFailures.push("artDirection 过弱（标题或副标题缺失）");
  }

  const passing = average >= PASS_THRESHOLD && automaticFailures.length === 0;

  const reworkSuggestions: string[] = [];
  for (const d of scores) {
    if (d.score < 2) {
      reworkSuggestions.push(`提升 ${d.dimension}: ${d.reason}`);
    }
  }

  return { scores, average, automaticFailures, passing, reworkSuggestions };
}
