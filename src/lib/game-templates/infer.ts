import { GAME_TEMPLATE_DEFINITIONS } from "@/lib/game-templates/definitions";
import { isGameTemplateId, type GameTemplateId } from "@/lib/game-templates/registry";

export type InferTemplateOptions = {
  /** 显式指定时跳过关键词推断 */
  hint?: GameTemplateId | "auto";
  /** 样品馆 sample id，优先级高于关键词 */
  sampleId?: string;
};

/** 样品 id → 语义模板（最可靠，避免 prompt 误判） */
export const SAMPLE_TEMPLATE_OVERRIDES: Partial<Record<string, GameTemplateId>> = {
  "rail-in-air": "coaster",
  "smash-the-dummy": "physics",
  "grow-a-garden": "farming",
  "color-bloom": "puzzle",
  "whimsy-differences": "puzzle",
  "gun-merge-3d-zombie-apocalypse": "towerDefense",
  "ultimate-3d-chess": "chess",
  "elastic-thief-2": "stealth",
  "state-conquest": "strategy",
  "tiny-planet-chopper": "shooter",
  "blade-defender-merge": "towerDefense",
  "car-color-palette": "customization",
  "pottery-master-3d": "customization",
  "crashy-roads": "racing",
  "blocky-sniper-hunter": "sniper",
  "memory-match-mania": "puzzle",
  "kids-puzzle": "puzzle",
};

/**
 * 从 prompt / 样品 id / 模板 hint 推断语义 templateId。
 * 新增模板时只需在 definitions 写 infer 规则，或给样品加 override。
 */
export function inferTemplateFromPrompt(
  prompt: string,
  opts: InferTemplateOptions = {},
): GameTemplateId {
  if (opts.sampleId && SAMPLE_TEMPLATE_OVERRIDES[opts.sampleId]) {
    return SAMPLE_TEMPLATE_OVERRIDES[opts.sampleId]!;
  }
  if (opts.hint && opts.hint !== "auto" && isGameTemplateId(opts.hint)) {
    return opts.hint;
  }

  const blob = prompt.trim();
  if (!blob) return "avoider";

  let best: GameTemplateId = "avoider";
  let bestScore = -1;

  for (const def of GAME_TEMPLATE_DEFINITIONS) {
    for (const rule of def.infer) {
      if (!rule.pattern.test(blob)) continue;
      if (rule.priority > bestScore) {
        bestScore = rule.priority;
        best = def.id as GameTemplateId;
      }
    }
  }

  return best;
}
