/**
 * Phase D：项目视听资产管线 — Brief 对齐的背景/精灵/封面
 */
import type { AppLocale } from "@/i18n/routing";
import type { CreativeBrief } from "@/lib/creative-brief/types";
import type { GameSpec } from "@/lib/game-spec";
import { generateGameBackground } from "@/lib/game-background-gen";
import { generateGameSprites, type SpriteGenResult } from "@/lib/game-sprite-gen";
import { generateGameCoverFromBrief } from "@/lib/game-brief-comfy-cover";
import { buildRuntimeAssetManifest } from "@/lib/assets/asset-runtime-resolver";
import { PRODUCT } from "@/lib/product-config";

export type ProjectAssetPipelineResult = {
  backgroundUrl: string | null;
  sprites: SpriteGenResult[];
  assetManifest: ReturnType<typeof buildRuntimeAssetManifest>;
  coverPath: string | null;
  coverSource: "comfy" | "llm" | "none" | "skipped";
};

export type RunProjectAssetPipelineOptions = {
  projectId: string;
  spec: GameSpec;
  brief?: CreativeBrief | null;
  uiLocale?: AppLocale;
  existingCoverPath?: string | null;
  /** 是否尝试 Brief 封面（默认读 PRODUCT.game.autoCoverFromBrief） */
  generateCover?: boolean;
};

/**
 * 并行生成背景 + 精灵；Brief 存在且尚无封面时追加封面（Comfy 优先）。
 */
export async function runProjectAssetPipeline(
  opts: RunProjectAssetPipelineOptions,
): Promise<ProjectAssetPipelineResult> {
  const uiLocale = opts.uiLocale ?? "zh-Hans";
  const brief = opts.brief ?? null;

  const [backgroundUrl, sprites] = await Promise.all([
    generateGameBackground(opts.projectId, opts.spec, brief),
    generateGameSprites(opts.projectId, opts.spec, uiLocale, brief),
  ]);

  const spritePayload = sprites.filter((s) => s.url).map((s) => ({ kind: s.kind, url: s.url! }));
  const assetManifest = buildRuntimeAssetManifest({
    projectId: opts.projectId,
    backgroundUrl,
    spriteUrls: spritePayload,
  });

  let coverPath: string | null = opts.existingCoverPath ?? null;
  let coverSource: ProjectAssetPipelineResult["coverSource"] = coverPath ? "skipped" : "none";

  const shouldCover =
    (opts.generateCover ?? PRODUCT.game.autoCoverFromBrief) &&
    brief &&
    !coverPath;

  if (shouldCover) {
    try {
      const cover = await generateGameCoverFromBrief(opts.projectId, brief, opts.spec);
      coverPath = cover.coverPath;
      coverSource = cover.source;
    } catch (e) {
      console.warn(
        `[game-asset-pipeline] cover failed for ${opts.projectId}:`,
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  return {
    backgroundUrl,
    sprites,
    assetManifest,
    coverPath,
    coverSource,
  };
}

/** 后台触发（不阻塞 HTTP 响应） */
export function scheduleProjectAssetPipeline(opts: RunProjectAssetPipelineOptions): void {
  void runProjectAssetPipeline(opts).catch((e) => {
    console.warn(
      `[game-asset-pipeline] background run failed for ${opts.projectId}:`,
      e instanceof Error ? e.message : String(e),
    );
  });
}
