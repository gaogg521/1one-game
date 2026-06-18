/**
 * 模型 ID：由 `product-config.ts` 驱动，不在 .env 中配置业务模型。
 */
import { PRODUCT } from "@/lib/product-config";
import { getEffectiveModels, getSceneModelCascade } from "@/lib/runtime-config";

export type ImageGenSizeOption = import("@/lib/product-config").ImageGenSizeOption;

export function normalizeOpenAIModelId(id: string): string {
  const t = id.trim();
  const prefix = "litellm/";
  const bare = t.toLowerCase().startsWith(prefix) ? t.slice(prefix.length) : t;
  /** 内部 LiteLLM 注册名与常见误写 */
  if (bare === "gpt-5.4") return "gpt-5-4";
  return bare;
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

/** 游戏文本链路默认池（无参考图）；请优先使用 resolveGameModelRoute / getGameModelCascade */
export function getModelCascade(): string[] {
  const fromRoute = getSceneModelCascade("game_text");
  if (fromRoute.length) return dedupeModelIds(fromRoute);
  const { gameTextPrimary, gameTextFallbacks, gamePrimary, gameFallbacks } = getEffectiveModels();
  return dedupeModelIds([
    gameTextPrimary ?? gamePrimary ?? PRODUCT.models.gameTextPrimary,
    ...(gameTextFallbacks ?? gameFallbacks ?? PRODUCT.models.gameTextFallbacks),
  ]);
}

export {
  getGameModelCascade,
  resolveGameModelRoute,
  resolveGameModelRouteMode,
  gameSceneKeyForMode,
  type GameModelRouteInput,
  type GameModelRouteMode,
} from "@/lib/game-model-route";

/** 小说正文、漫画分镜 JSON */
export function getNovelStyleTextModelCascade(): string[] {
  const fromRoute = getSceneModelCascade("novel");
  if (fromRoute.length) return dedupeModelIds(fromRoute);
  const { novelTextPrimary, novelTextFallback } = getEffectiveModels();
  return dedupeModelIds([
    novelTextPrimary ?? PRODUCT.models.novelTextPrimary,
    novelTextFallback ?? PRODUCT.models.novelTextFallback,
  ]);
}

/** 长篇设定圣经 / 章规划 JSON（可走独立 LiteLLM 池） */
export function getNovelPlanModelCascade(): string[] {
  const fromRoute = getSceneModelCascade("novel_plan");
  if (fromRoute.length) return dedupeModelIds(fromRoute);
  return getNovelStyleTextModelCascade();
}

/** 漫画分镜 / 导演包 JSON（可与正文分池） */
export function getComicStoryboardModelCascade(): string[] {
  const fromRoute = getSceneModelCascade("comic_storyboard");
  if (fromRoute.length) return dedupeModelIds(fromRoute);
  return getNovelStyleTextModelCascade();
}

export function getImageGenOpenAIModel(): string {
  const cascade = getSceneModelCascade("comic_image_openai");
  if (cascade[0]) return cascade[0];
  const { imageOpenAI } = getEffectiveModels();
  return imageOpenAI ?? PRODUCT.models.imageOpenAI;
}

export function getImageGenGeminiModel(): string {
  const cascade = getSceneModelCascade("comic_image_gemini");
  if (cascade[0]) return cascade[0];
  const { imageGemini } = getEffectiveModels();
  return imageGemini ?? PRODUCT.models.imageGemini;
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
