/**
 * 游戏质量自评 Agent。
 *
 * spec 生成完后让一个"评论员 LLM"评 0-10 分 + 列出最弱维度 + 给具体建议。
 * 若评分低于阈值，自动触发 enhance 一轮再评。
 *
 * 输出消费场景：
 *  1. 前端 GamePlayer 角落显示 "AI 评审 7.2/10"（用户可见的质量信号）
 *  2. generate-spec 自动 enhance：评分 < 7 时把建议拼进 enhance prompt 再跑一遍
 *  3. QA 报告：spec 评分被记入 orchestration trace
 *
 * 设计原则：
 *  - 评论员只读 spec，不知道运行时实现；目的是评估"作为产品设计是否合格"
 *  - 用 23 款样品的高质量结果作为 in-context few-shot 锚定（这里仅用 2 个精简示例避免 token 过长）
 *  - 评分维度：节奏 / 风格匹配 / 系统深度 / 视觉差异化 / 文案叙事
 */

import type { GameSpec } from "@/lib/game-spec";
import { llmJson } from "@/lib/llm";
import { resolveGameModelRoute } from "@/lib/game-model-route";

export type GameCriticDim =
  | "pacing" // 节奏：director 4 幕 + 5-8 事件类型多样
  | "style_match" // 风格匹配：assetStyle + theme + musicProfile 互相协调
  | "systems_depth" // 系统深度：technique / powerup 与模板匹配
  | "visual_distinct" // 视觉差异化：theme 不是"灰底白字"
  | "narrative"; // 文案叙事：title / labels / subtitle 不抄用户原文且有想象力

export type GameCriticVerdict = {
  score: number; // 0..10
  strongest: GameCriticDim;
  weakest: GameCriticDim;
  weakestReason: string;
  /** 给 enhance 的具体可执行建议（数组每条独立）*/
  suggestions: string[];
  /** 一句话总结，可直接给用户看 */
  summary: string;
};

const SYSTEM = `你是「小游戏作品评审员」，给一份 GameSpec 评分。

# 评分维度（每项 0-10）
- pacing：director 节奏是否有 4 幕 + 5-8 个 events 且类型多样（避免 coinRain/goalShift/miniBoss 三件套）
- style_match：presentation.assetStyle / musicProfile / hudFontStyle / theme 是否相互协调，能否一眼读出气质
- systems_depth：技能 / 道具 / 模板蓝图（towerDefense / shooter / puzzle 等）的设计深度
- visual_distinct：theme 是否避免了通用"灰底白字"，是否有独特色彩氛围；backgroundColor 带色彩倾向（不是 #000000/#111111/纯黑 → 扣 2 分），playerColor 与 hazardColor 对比度足够（相似色系 → 扣 1 分）
- narrative：title / labels / subtitle 是否有想象力且不照抄用户原文，文案与 assetStyle 气质匹配

# 总分
取 5 维平均，保留 1 位小数。**若 visual_distinct ≤ 5（纯黑底或灰白同质化），总分最高 6.8 封顶**。

# 输出
只输出一个 JSON：{score, strongest, weakest, weakestReason, suggestions, summary}。
- suggestions：3-5 条**可执行**的改进建议，每条直接落到字段上（如"director.events 缺少 finalBarrage 类型，建议加在 0.9 位置"）
- summary：≤30 字的一句话，可直接展示给用户

# 学习样例（节选）
A. 节奏好：director.acts=[开场,加速,变奏,终局]，events=[coinRain(0.18)/miniBoss(0.42)/goalShift(0.6)/comboBonus(0.78)/finalBarrage(0.92)]，类型多样。
B. 节奏差：events 只有 3 个 [coinRain(0.34)/goalShift(0.58)/miniBoss(0.82)]，全是兜底三件套。
C. 风格匹配好：assetStyle=wuxia-flight + musicProfile=organic + theme 主色 #fde68a/#9f1239 + hudFontStyle=serif，风格自洽。
D. 风格匹配差：assetStyle=classic-arcade + 主题色却是 #1a2220/#8faf8c（自然色），气质冲突。
E. 视觉差异好：backgroundColor=#0c1226（深蓝带蓝），playerColor=#2dd4bf（青绿），hazardColor=#ef4444（红），色相差大。
F. 视觉差异差：backgroundColor=#111111（纯黑），playerColor=#ffffff（白），hazardColor=#999999（灰）→ visual_distinct ≤ 4，强制总分 ≤ 6.8。`;

const SCHEMA = {
  name: "game_critic_verdict",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      score: { type: "number", minimum: 0, maximum: 10 },
      strongest: {
        type: "string",
        enum: ["pacing", "style_match", "systems_depth", "visual_distinct", "narrative"],
      },
      weakest: {
        type: "string",
        enum: ["pacing", "style_match", "systems_depth", "visual_distinct", "narrative"],
      },
      weakestReason: { type: "string", minLength: 1, maxLength: 200 },
      suggestions: {
        type: "array",
        items: { type: "string", minLength: 1, maxLength: 200 },
        minItems: 3,
        maxItems: 6,
      },
      summary: { type: "string", minLength: 1, maxLength: 60 },
    },
    required: ["score", "strongest", "weakest", "weakestReason", "suggestions", "summary"],
  },
} as const;

/**
 * 评一次。失败返回 null，调用方可静默回退（不阻塞主链路）。
 */
export async function critiqueGameSpec(spec: GameSpec, userPrompt: string): Promise<GameCriticVerdict | null> {
  const route = resolveGameModelRoute({ prompt: userPrompt });
  // 评论员可以用更便宜的模型（取 cascade 的第一个）
  for (const model of route.models.slice(0, 2)) {
    try {
      const res = await llmJson({
        model,
        scene: route.scene,
        system: SYSTEM,
        user: `用户原 prompt：\n${userPrompt}\n\n待评审的 GameSpec：\n${JSON.stringify(spec).slice(0, 6000)}`,
        temperature: 0.2,
        mode: "json_schema",
        jsonSchema: SCHEMA,
        timeoutMs: 18000,
      });
      if (!res.ok) continue;
      const raw = res.raw as unknown;
      if (!raw || typeof raw !== "object") continue;
      const o = raw as Record<string, unknown>;
      const score = typeof o.score === "number" ? o.score : null;
      if (score === null) continue;
      return {
        score,
        strongest: o.strongest as GameCriticDim,
        weakest: o.weakest as GameCriticDim,
        weakestReason: String(o.weakestReason ?? ""),
        suggestions: Array.isArray(o.suggestions) ? (o.suggestions as string[]).slice(0, 6) : [],
        summary: String(o.summary ?? ""),
      };
    } catch {
      /* try next model */
    }
  }
  return null;
}

/** 把建议拼成给 enhance LLM 的额外提示 */
export function suggestionsToEnhanceHint(verdict: GameCriticVerdict): string {
  const lines = ["", "## AI 评审员建议（必须采纳，不修复将再次扣分）"];
  lines.push(`总分 ${verdict.score.toFixed(1)}/10，最弱维度：${verdict.weakest} —— ${verdict.weakestReason}`);
  if (verdict.weakest === "visual_distinct") {
    lines.push(
      "⚠️ 视觉强制规则：backgroundColor 不能是 #000000/#111111/纯黑，必须选带色相的深色（如深松绿 #1a2220、暮霭紫 #1e1a2a、深宝蓝 #0c1226）；playerColor 与 hazardColor 色相差须 ≥ 60°。",
    );
  }
  for (let i = 0; i < verdict.suggestions.length; i += 1) {
    lines.push(`${i + 1}. ${verdict.suggestions[i]}`);
  }
  return lines.join("\n");
}
