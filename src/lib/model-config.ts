/**
 * 模型 ID：由 `product-config.ts` 驱动，不在 .env 中配置业务模型。
 */
import { PRODUCT } from "@/lib/product-config";

export type ImageGenSizeOption = import("@/lib/product-config").ImageGenSizeOption;

export function normalizeOpenAIModelId(id: string): string {
  const t = id.trim();
  const prefix = "litellm/";
  if (t.toLowerCase().startsWith(prefix)) return t.slice(prefix.length);
  return t;
}

function dedupeModelIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of ids) {
    const t = normalizeOpenAIModelId(m);
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

/** 游戏 / GameSpec / 规格修补 / 视觉参考等文本链路 */
export function getModelCascade(): string[] {
  const { gamePrimary, gameFallbacks } = PRODUCT.models;
  return dedupeModelIds([gamePrimary, ...gameFallbacks]);
}

/** 小说正文、漫画分镜 JSON */
export function getNovelStyleTextModelCascade(): string[] {
  const { novelTextPrimary, novelTextFallback } = PRODUCT.models;
  return dedupeModelIds([novelTextPrimary, novelTextFallback]);
}

export function getImageGenOpenAIModel(): string {
  return PRODUCT.models.imageOpenAI;
}

export function getImageGenGeminiModel(): string {
  return PRODUCT.models.imageGemini;
}

export function getImageGenDefaultSize(): ImageGenSizeOption {
  return PRODUCT.image.defaultSize;
}

export function getComicPanelGenConcurrency(): number {
  return Math.min(4, Math.max(1, PRODUCT.comic.panelGenConcurrency));
}

export function getImageGenBatchPanelCount(): number {
  const n = PRODUCT.comic.batchPanelCount;
  return n > 0 ? Math.min(4, Math.floor(n)) : 0;
}
