/**
 * 「策展上下文」—— 编排上游各节点的统一可读切片（Phase 0：类型 + builder；后续 ingest URL 聚合可挂载于此）。
 */

import { PRODUCT } from "@/lib/product-config";
import type { GameTemplateId } from "@/lib/game-templates";

export type OrchestrationQualityTier = "fast" | "standard" | "rich" | "astrocade";

export type ContextPack = {
  /** ISO 语义区域，默认与用户输入一致可由路由覆盖 */
  locale: "zh" | "en" | "mixed";
  userPromptTrimmed: string;
  templateHintEffective: "auto" | string;
  searchEnhance: boolean;
  enhancePass: boolean;
  /** 创意里是否出现过【参考素材】等片段（服务端仅做启发式标记） */
  hasReferenceSnippet: boolean;
  /** 为未来资产档位预留 */
  qualityTier: OrchestrationQualityTier;
};

export function inferHasReferenceSnippet(prompt: string): boolean {
  return /【参考素材】|参考图\s*图\d|参考图编号说明/.test(prompt);
}

export type BuildContextPackInput = {
  prompt: string;
  templateHint: "auto" | GameTemplateId;
  searchEnhance: boolean;
  enhancePass: boolean;
  /** 可由 Accept-Language 等注入；无时按启发式 zh/en */
  localeHint?: ContextPack["locale"];
};

/** 粗略判断 locale（避免引入重量级 i18n 依赖）。 */
export function inferLocale(prompt: string, hint?: ContextPack["locale"]): ContextPack["locale"] {
  if (hint === "zh" || hint === "en") return hint;
  if (/[a-zA-Z]{12,}/.test(prompt) && !/[\u4e00-\u9fff]/.test(prompt)) return "en";
  if (/[\u4e00-\u9fff]/.test(prompt)) return "zh";
  return "mixed";
}

export function buildContextPack(input: BuildContextPackInput): ContextPack {
  const userPromptTrimmed = input.prompt.trim();
  return {
    locale: inferLocale(userPromptTrimmed, input.localeHint),
    userPromptTrimmed,
    templateHintEffective: input.templateHint,
    searchEnhance: input.searchEnhance,
    enhancePass: input.enhancePass,
    hasReferenceSnippet: inferHasReferenceSnippet(userPromptTrimmed),
    qualityTier: resolveQualityTier(),
  };
}

/** 编排质量档位（见 `product-config.ts`） */
export function resolveQualityTier(): OrchestrationQualityTier {
  return PRODUCT.orchestration.qualityTier;
}

/** @deprecated 使用 resolveQualityTier */
export const resolveQualityTierFromEnv = resolveQualityTier;
