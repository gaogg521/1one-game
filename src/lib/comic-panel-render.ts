import { generateComfyImages, comfyImageUrl } from "@/lib/comfy-image-gen";
import {
  generateImageDetailed,
  generateImagesBatchDetailed,
  getImageGenAvailability,
} from "@/lib/image-generation";
import { getComfyBaseUrl } from "@/lib/orchestration/comfy-gateway";
import { buildPanelImagePrompt } from "@/lib/comic-generate-config";
import type { ComicDirectorPack } from "@/lib/comic-director-types";
import type { ComicStoryContext } from "@/lib/comic-panel-prompt-urban";
import { docHasPlaceholderPanels } from "@/lib/comic-panel-prompt-urban";
import type { CoverGenre } from "@/lib/cover-genre";
import {
  collectComicStyleReferenceUrls,
  comicPanelRenderNeedsGemini,
  COMIC_STYLE_GEMINI_REQUIRED_MSG,
} from "@/lib/comic-style-reference";
import {
  parseComicImageUrls,
  serializeComicDocument,
  type ComicDocument,
  type ComicPanel,
} from "@/lib/comic-format";
import { formatImageGenElapsed } from "@/lib/format-duration";

export { formatImageGenElapsed } from "@/lib/format-duration";

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]!, i);
    }
  }
  const workers = Math.min(concurrency, Math.max(1, items.length));
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

export type RenderComicPanelsResult = {
  doc: ComicDocument;
  rendered: number;
  total: number;
  imageSource: string;
  errors: string[];
  imageGenHint?: string;
};

export type ComicPanelProgressEvent =
  | { type: "start"; total: number; message: string; model?: string; concurrency?: number }
  | { type: "panel_start"; index: number; total: number; caption?: string }
  | { type: "heartbeat"; index: number; total: number; message: string; elapsedMs: number }
  | {
      type: "panel_done";
      index: number;
      total: number;
      ok: boolean;
      error?: string;
      withImage: number;
      imageUrls: string;
      elapsedMs: number;
      durationMs?: number;
      provider?: string;
    }
  | { type: "done"; rendered: number; total: number; withImage: number; message: string };

/** 为分镜生成配图并写入 panel.imageUrl。 */
export async function renderComicPanels(
  doc: ComicDocument,
  opts?: {
    onlyMissing?: boolean;
    onProgress?: (ev: ComicPanelProgressEvent) => void;
    /** 漫画封面路径，与首张已有分镜图一并作为风格参考 */
    coverPath?: string | null;
    /** 题材画风锁（都市/仙侠等），拼入 prompt 与 Gemini 参考图指令 */
    storyGenre?: CoverGenre;
    /** 小说标题/摘要：占位分镜时按都市节奏重建画面 prompt */
    storyContext?: ComicStoryContext;
    /** 强制不用参考图（如重生成全部后的首格） */
    skipStyleRefs?: boolean;
    /** 长篇导演包（优先 doc.director） */
    director?: ComicDirectorPack | null;
    /** Character Sheet First：角色参考图 URL 列表，用于分镜配图风格锚定 */
    characterSheetUrls?: string[];
  },
): Promise<RenderComicPanelsResult> {
  const storyGenre = opts?.storyGenre ?? "general";
  const skipStyleRefs =
    opts?.skipStyleRefs === true ||
    (storyGenre === "urban" && docHasPlaceholderPanels(doc));
  const totalScenes = doc.pages.reduce((n, p) => n + p.panels.length, 0);
  const onlyMissing = opts?.onlyMissing !== false;
  const availability = getImageGenAvailability();
  const flat: { panel: ComicPanel; index: number }[] = [];
  let panelIndex = 0;

  for (const page of doc.pages) {
    for (const panel of page.panels) {
      panelIndex += 1;
      if (!onlyMissing || !panel.imageUrl?.trim()) {
        flat.push({ panel, index: panelIndex });
      }
    }
  }

  if (flat.length === 0) {
    opts?.onProgress?.({
      type: "done",
      rendered: 0,
      total: 0,
      withImage: countPanelsWithImages(doc).withImage,
      message: "无需补图",
    });
    return { doc, rendered: 0, total: 0, imageSource: "none", errors: [] };
  }

  const styleRefUrls = collectComicStyleReferenceUrls(doc, opts?.coverPath, {
    storyGenre,
    skipStyleRefs,
  });
  // 合并角色参考图（Character Sheet First）
  const charSheets = opts?.characterSheetUrls?.filter(Boolean) ?? [];
  for (const url of charSheets) {
    if (!styleRefUrls.includes(url)) styleRefUrls.push(url);
  }
  const useStyleRefs = styleRefUrls.length > 0;
  const needsGeminiForRefs = comicPanelRenderNeedsGemini(styleRefUrls);
  const hasPanelAnchor = countPanelsWithImages(doc).withImage > 0;
  /** 漫画禁用 OpenAI 批量：无法锚定参考图，格与格之间易画风不一 */
  const useOpenAIBatch = false;

  if (hasPanelAnchor && needsGeminiForRefs && !availability.hasGemini) {
    opts?.onProgress?.({
      type: "done",
      rendered: 0,
      total: flat.length,
      withImage: countPanelsWithImages(doc).withImage,
      message: COMIC_STYLE_GEMINI_REQUIRED_MSG,
    });
    return {
      doc,
      rendered: 0,
      total: flat.length,
      imageSource: "none",
      errors: [COMIC_STYLE_GEMINI_REQUIRED_MSG],
      imageGenHint: COMIC_STYLE_GEMINI_REQUIRED_MSG,
    };
  }

  const styleConsistencyNote =
    !availability.hasGemini && flat.length > 1
      ? "未配置 GEMINI_API_KEY，将用 OpenAI 逐格生成（画风一致性较弱，建议补配 Gemini）"
      : null;

  opts?.onProgress?.({
    type: "start",
    total: flat.length,
    message: availability.ok
      ? [
          useStyleRefs
            ? `${availability.message} · 已锚定首张分镜${styleRefUrls.length > 1 ? "+封面" : ""}，逐格串行续画`
            : flat.length > 1
              ? `${availability.message} · 逐格串行（首格定调后后续格锚定画风）`
              : availability.message,
          styleConsistencyNote,
        ]
          .filter(Boolean)
          .join(" · ")
      : availability.message,
    model: availability.openaiModel,
    concurrency: 1,
  });

  const director = opts?.director ?? doc.director;
  const stylePreset = doc.stylePreset;
  const prompts = flat.map((f) =>
    buildPanelImagePrompt(f.panel, storyGenre, {
      sceneIndex: f.index,
      totalScenes,
      story: opts?.storyContext,
      director,
      stylePreset,
    }),
  );

  const comfyBase = getComfyBaseUrl();
  let imageSource = "none";
  const urls: (string | undefined)[] = new Array(flat.length);
  const errors: string[] = [];

  if (comfyBase) {
    const comfyImages = await generateComfyImages(prompts);
    for (let i = 0; i < flat.length; i++) {
      const img = comfyImages[i];
      if (img) urls[i] = comfyImageUrl(comfyBase, img);
    }
    const comfyOk = urls.filter(Boolean).length;
    if (comfyOk > 0) imageSource = "comfy";
    if (comfyOk === 0) {
      errors.push("ComfyUI 未返回图片，将尝试云端文生图");
    } else if (comfyOk < flat.length) {
      errors.push(`ComfyUI 仅成功 ${comfyOk}/${flat.length} 格，缺图将改用云端文生图补全`);
    }
  }

  const needsCloudPanels = () => flat.some((_, i) => !urls[i]);

  if (needsCloudPanels()) {
    if (!availability.ok) {
      if (!urls.some(Boolean)) {
        return {
          doc,
          rendered: 0,
          total: flat.length,
          imageSource: "none",
          errors: [...errors, availability.message],
          imageGenHint: availability.message,
        };
      }
    } else if (useOpenAIBatch && flat.every((_, i) => !urls[i])) {
      for (const f of flat) {
        opts?.onProgress?.({
          type: "panel_start",
          index: f.index,
          total: flat.length,
          caption: f.panel.caption,
        });
      }

      const batchT0 = Date.now();
      console.info(
        `[comic-panels] 开始批量文生图 ${flat.length} 格（单次 n=${flat.length}）· ${availability.message}`,
      );

      const heartbeat = setInterval(() => {
        const elapsedMs = Date.now() - batchT0;
        opts?.onProgress?.({
          type: "heartbeat",
          index: flat[0]!.index,
          total: flat.length,
          elapsedMs,
          message: `正在一次生成 ${flat.length} 张配图（已用时 ${formatImageGenElapsed(elapsedMs)}）…`,
        });
      }, 5_000);

      let batch;
      try {
        batch = await generateImagesBatchDetailed(prompts, {
          size: "1024x1024",
          quality: "standard",
        });
      } finally {
        clearInterval(heartbeat);
      }

      console.info(
        `[comic-panels] 批量结束 mode=${batch.mode} · ${formatImageGenElapsed(batch.durationMs)}` +
          (batch.batchError ? ` · 降级原因: ${batch.batchError}` : ""),
      );

      for (let i = 0; i < batch.results.length; i++) {
        if (urls[i]) continue;
        const label = flat[i]!.index;
        const detail = batch.results[i]!;
        const elapsedMs = batch.durationMs;

        if (!detail.ok || !detail.url) {
          const err = detail.error || "未知错误";
          errors.push(`第 ${label} 格：${err}`);
          opts?.onProgress?.({
            type: "panel_done",
            index: label,
            total: flat.length,
            ok: false,
            error: err,
            withImage: countPanelsWithImages(doc).withImage,
            imageUrls: serializeComicDocument(doc),
            elapsedMs,
            durationMs: detail.durationMs,
          });
          continue;
        }

        flat[i]!.panel.imageUrl = detail.url;
        urls[i] = detail.url;
        opts?.onProgress?.({
          type: "panel_done",
          index: label,
          total: flat.length,
          ok: true,
          withImage: countPanelsWithImages(doc).withImage,
          imageUrls: serializeComicDocument(doc),
          elapsedMs,
          durationMs: detail.durationMs,
          provider: detail.provider,
        });
      }

      if (batch.results.some((r) => r.ok)) {
        imageSource = batch.mode === "batch" ? "openai_batch" : "openai";
      }
    } else {
      console.info(
        `[comic-panels] 开始文生图 ${flat.length} 格 · 逐格串行（画风一致）· ${availability.message}`,
      );

      for (let i = 0; i < flat.length; i++) {
        if (urls[i]) continue;
        const prompt = prompts[i]!;
        const label = flat[i]!.index;
        const caption = flat[i]!.panel.caption;
        const panelT0 = Date.now();
        opts?.onProgress?.({
          type: "panel_start",
          index: label,
          total: flat.length,
          caption,
        });
        console.info(`[comic-panels] 第 ${label} 格请求中…`);

        const heartbeat = setInterval(() => {
          const elapsedMs = Date.now() - panelT0;
          opts?.onProgress?.({
            type: "heartbeat",
            index: label,
            total: flat.length,
            elapsedMs,
            message: `第 ${label}/${flat.length} 格：已用时 ${formatImageGenElapsed(elapsedMs)}，文生图生成中…`,
          });
        }, 5_000);

      const panelStyleRefs = collectComicStyleReferenceUrls(doc, opts?.coverPath, {
        storyGenre,
        skipStyleRefs,
      });
      const useRefs =
        panelStyleRefs.length > 0 && availability.hasGemini ? panelStyleRefs : undefined;
      let detail;
      try {
        detail = await generateImageDetailed(prompt, {
          size: "1024x1024",
          quality: "standard",
          styleReferenceUrls: useRefs,
          styleGenre: storyGenre,
        });
        } finally {
          clearInterval(heartbeat);
        }

        const elapsedMs = Date.now() - panelT0;
        const apiMs = detail.durationMs;

        if (!detail.ok || !detail.url) {
          const err = detail.error || "未知错误";
          errors.push(`第 ${label} 格：${err}`);
          console.warn(
            `[comic-panels] 第 ${label} 格失败 · 总 ${formatImageGenElapsed(elapsedMs)}`,
            err,
          );
          opts?.onProgress?.({
            type: "panel_done",
            index: label,
            total: flat.length,
            ok: false,
            error: err,
            withImage: countPanelsWithImages(doc).withImage,
            imageUrls: serializeComicDocument(doc),
            elapsedMs,
            durationMs: apiMs,
          });
          continue;
        }
        console.info(
          `[comic-panels] 第 ${label} 格成功 · ${detail.provider}/${detail.model} · 总 ${formatImageGenElapsed(elapsedMs)}` +
            (apiMs != null ? ` · API ${formatImageGenElapsed(apiMs)}` : ""),
        );
        flat[i]!.panel.imageUrl = detail.url;
        urls[i] = detail.url;
        opts?.onProgress?.({
          type: "panel_done",
          index: label,
          total: flat.length,
          ok: true,
          withImage: countPanelsWithImages(doc).withImage,
          imageUrls: serializeComicDocument(doc),
          elapsedMs,
          durationMs: apiMs,
          provider: detail.provider,
        });
        if (detail.provider) imageSource = detail.provider;
      }
    }
  }

  let rendered = 0;
  for (let i = 0; i < flat.length; i++) {
    const url = urls[i];
    if (!url) continue;
    if (!flat[i]!.panel.imageUrl) flat[i]!.panel.imageUrl = url;
    rendered += 1;
  }

  const after = countPanelsWithImages(doc);
  const doneMessage =
    after.withImage === 0
      ? errors[0] ?? "配图未生成"
      : after.withImage < after.total
        ? `已生成 ${rendered}/${flat.length} 格`
        : "配图全部完成";

  opts?.onProgress?.({
    type: "done",
    rendered,
    total: flat.length,
    withImage: after.withImage,
    message: doneMessage,
  });

  return {
    doc,
    rendered,
    total: flat.length,
    imageSource,
    errors,
    imageGenHint: availability.ok ? availability.message : availability.message,
  };
}

/** 清空分镜配图 URL（保留 caption/prompt；封面在 comic.coverPath 不受影响）。 */
export function clearComicPanelImages(
  doc: ComicDocument,
  scope: "all" | { pageNumber: number } = "all",
): number {
  let cleared = 0;
  for (const page of doc.pages) {
    if (scope !== "all" && page.page !== scope.pageNumber) continue;
    for (const panel of page.panels) {
      if (panel.imageUrl?.trim()) {
        delete panel.imageUrl;
        cleared += 1;
      }
    }
  }
  return cleared;
}

export function countPanelsWithImages(doc: ComicDocument): { withImage: number; total: number } {
  let withImage = 0;
  let total = 0;
  for (const page of doc.pages) {
    for (const panel of page.panels) {
      total += 1;
      if (panel.imageUrl?.trim()) withImage += 1;
    }
  }
  return { withImage, total };
}

export function parseComicDocument(imageUrlsRaw: string): ComicDocument {
  return parseComicImageUrls(imageUrlsRaw);
}

export function serializeComicPanels(doc: ComicDocument): string {
  return serializeComicDocument(doc);
}
