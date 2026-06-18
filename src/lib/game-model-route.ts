import { normalizeOpenAIModelId } from "@/lib/model-config";
import { inferHasReferenceSnippet } from "@/lib/orchestration/context-pack";
import { PRODUCT } from "@/lib/product-config";
import { getSceneModelCascade } from "@/lib/runtime-config";
import type { RuntimeSceneKey } from "@/lib/runtime-providers";

export type GameModelRouteMode = "text" | "vision";

export type GameModelRouteInput = {
  prompt?: string;
  assetManifestItemCount?: number;
  hasReferenceAssets?: boolean;
};

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

/** 无参考图 → 文本池；有参考图 / 参考素材摘录 → 多模态池 */
export function resolveGameModelRouteMode(input: GameModelRouteInput): GameModelRouteMode {
  if (input.hasReferenceAssets === true) return "vision";
  if (input.hasReferenceAssets === false) return "text";
  if ((input.assetManifestItemCount ?? 0) > 0) return "vision";
  if (input.prompt && inferHasReferenceSnippet(input.prompt)) return "vision";
  return "text";
}

export function gameSceneKeyForMode(mode: GameModelRouteMode): RuntimeSceneKey {
  return mode === "vision" ? "game_vision" : "game_text";
}

export function getGameModelCascade(mode: GameModelRouteMode): string[] {
  const scene = gameSceneKeyForMode(mode);
  const fromRoute = getSceneModelCascade(scene);
  if (fromRoute.length) return dedupeModelIds(fromRoute);

  const m = PRODUCT.models;
  if (mode === "vision") {
    return dedupeModelIds([
      m.gameVisionPrimary ?? m.gamePrimary,
      ...(m.gameVisionFallbacks ?? m.gameFallbacks ?? []),
    ]);
  }
  return dedupeModelIds([
    m.gameTextPrimary ?? m.gamePrimary,
    ...(m.gameTextFallbacks ?? m.gameFallbacks ?? []),
  ]);
}

export function resolveGameModelRoute(input: GameModelRouteInput = {}) {
  const mode = resolveGameModelRouteMode(input);
  return {
    mode,
    scene: gameSceneKeyForMode(mode),
    models: getGameModelCascade(mode),
  };
}
