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
  comicStyleGeminiRequiredMessage,
} from "@/lib/comic-style-reference";
import {
  parseComicImageUrls,
  serializeComicDocument,
  type ComicDocument,
  type ComicPanel,
} from "@/lib/comic-format";
import { formatImageGenElapsed } from "@/lib/format-duration";
import {
  ensureComicCharacterSheetsForRender,
} from "@/lib/comic-character-sheet-gen";
import { getComicPanelGenConcurrency } from "@/lib/model-config";
import { PRODUCT } from "@/lib/product-config";
import type { AppLocale } from "@/i18n/routing";
import { comicPanelProgressMessage } from "@/lib/i18n/progress-message";

export { formatImageGenElapsed } from "@/lib/format-duration";

const DEFAULT_COMIC_PANEL_IMAGE_TIMEOUT_MS = 12 * 60 * 1000;

function resolveComicPanelImageTimeoutMs(): number {
  const raw = Number.parseInt(process.env.COMIC_PANEL_IMAGE_TIMEOUT_MS ?? process.env.IMAGE_GEN_TIMEOUT_MS ?? "", 10);
  if (Number.isFinite(raw) && raw >= 30_000) return Math.min(raw, 30 * 60 * 1000);
  return DEFAULT_COMIC_PANEL_IMAGE_TIMEOUT_MS;
}

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
    /** 漫画 id，配图阶段按需生成角色参考图 */
    comicId?: string;
    uiLocale?: AppLocale;
  },
): Promise<RenderComicPanelsResult> {
  const locale = opts?.uiLocale ?? "zh-Hans";
  const pm = (key: string, params?: Record<string, string | number | undefined | null>) =>
    comicPanelProgressMessage(locale, key, params);
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
      message: pm("noPanelsNeeded"),
    });
    return { doc, rendered: 0, total: 0, imageSource: "none", errors: [] };
  }

  const styleRefUrls = collectComicStyleReferenceUrls(doc, opts?.coverPath, {
    storyGenre,
    skipStyleRefs,
  });
  let charSheets = opts?.characterSheetUrls?.filter(Boolean) ?? doc.characterSheetUrls?.filter(Boolean) ?? [];
  if (charSheets.length === 0 && opts?.comicId && doc.stylePreset) {
    const ensured = await ensureComicCharacterSheetsForRender({
      comicKey: opts.comicId,
      stylePreset: doc.stylePreset,
      roster: doc.characterRoster,
      director: opts?.director ?? doc.director ?? null,
      existingUrls: charSheets,
      uiLocale: locale,
      timeoutMs: PRODUCT.comic.charSheetTimeoutMs,
    });
    charSheets = ensured.urls;
    if (ensured.roster) {
      doc.characterRoster = ensured.roster;
      doc.characterSheetUrls = ensured.urls;
    }
  }
  for (const url of charSheets) {
    if (!styleRefUrls.includes(url)) styleRefUrls.push(url);
  }
  const useStyleRefs = styleRefUrls.length > 0;
  const needsGeminiForRefs = comicPanelRenderNeedsGemini(styleRefUrls);
  const hasPanelAnchor = countPanelsWithImages(doc).withImage > 0;
  /** 漫画禁用 OpenAI 批量：无法锚定参考图，格与格之间易画风不一 */
  const useOpenAIBatch = false;

  /** 全量重绘且已有锚点图时须 Gemini；补缺失格允许 OpenAI 无参考图降级，避免 62/64 永久卡死 */
  const blockWithoutGemini =
    hasPanelAnchor && needsGeminiForRefs && !availability.hasGemini && !onlyMissing;
  if (blockWithoutGemini) {
    const geminiMsg = comicStyleGeminiRequiredMessage(locale);
    opts?.onProgress?.({
      type: "done",
      rendered: 0,
      total: flat.length,
      withImage: countPanelsWithImages(doc).withImage,
      message: geminiMsg,
    });
    return {
      doc,
      rendered: 0,
      total: flat.length,
      imageSource: "none",
      errors: [geminiMsg],
      imageGenHint: geminiMsg,
    };
  }

  const styleConsistencyNote =
    !availability.hasGemini && (flat.length > 1 || (onlyMissing && hasPanelAnchor))
      ? pm("geminiWeakOpenAI")
      : null;

  const panelConcurrency = getComicPanelGenConcurrency();
  const extraRef =
    styleRefUrls.length > 1 ? pm("extraRefFirstPanel") : "";
  opts?.onProgress?.({
    type: "start",
    total: flat.length,
    message: availability.ok
      ? [
          useStyleRefs
            ? pm("startAnchoredSheets", { detail: availability.message, extraRef })
            : flat.length > 1
              ? pm("startParallel", {
                  detail: availability.message,
                  concurrency: panelConcurrency,
                })
              : availability.message,
          styleConsistencyNote,
        ]
          .filter(Boolean)
          .join(" · ")
      : availability.message,
    model: availability.openaiModel,
    concurrency: panelConcurrency,
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
      errors.push(pm("comfyNoImages"));
    } else if (comfyOk < flat.length) {
      errors.push(pm("comfyPartial", { ok: comfyOk, total: flat.length }));
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
          message: pm("batchGenerating", {
            count: flat.length,
            elapsed: formatImageGenElapsed(elapsedMs, locale),
          }),
        });
      }, 5_000);

      let batch;
      try {
        const timeoutMs = resolveComicPanelImageTimeoutMs();
        batch = await generateImagesBatchDetailed(prompts, {
          size: "1024x1024",
          quality: "standard",
          timeoutMs,
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
        let detail = batch.results[i]!;
        if ((!detail.ok || !detail.url) && process.env.COMIC_PANEL_RETRY !== "0") {
          const timeoutMs = resolveComicPanelImageTimeoutMs();
          const retry = await generateImageDetailed(prompts[i]!, {
            size: "1024x1024",
            quality: "standard",
            timeoutMs,
          });
          if (retry.ok && retry.url) detail = retry;
        }
        const elapsedMs = batch.durationMs;

        if (!detail.ok || !detail.url) {
          const err = detail.error || pm("unknownError");
          errors.push(pm("panelError", { index: label, error: err }));
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
        `[comic-panels] 开始文生图 ${flat.length} 格 · 首格锚定 + 最多 ${panelConcurrency} 路并行 · ${availability.message}`,
      );

      async function renderCloudPanelAt(i: number): Promise<void> {
        if (urls[i]) return;
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
            message: pm("panelGenerating", {
              index: label,
              total: flat.length,
              elapsed: formatImageGenElapsed(elapsedMs, locale),
            }),
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
          const timeoutMs = resolveComicPanelImageTimeoutMs();
          const genOpts = {
            size: "1024x1024" as const,
            quality: "standard" as const,
            styleReferenceUrls: useRefs,
            styleGenre: storyGenre,
            timeoutMs,
          };
          detail = await generateImageDetailed(prompt, genOpts);
          if ((!detail.ok || !detail.url) && process.env.COMIC_PANEL_RETRY !== "0") {
            await new Promise((r) => setTimeout(r, 2500));
            detail = await generateImageDetailed(prompt, genOpts);
          }
        } finally {
          clearInterval(heartbeat);
        }

        const elapsedMs = Date.now() - panelT0;
        const apiMs = detail.durationMs;

        if (!detail.ok || !detail.url) {
          const err = detail.error || pm("unknownError");
          errors.push(pm("panelError", { index: label, error: err }));
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
          return;
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

      const pending = flat.map((_, idx) => idx).filter((idx) => !urls[idx]);
      if (pending.length > 0) {
        await renderCloudPanelAt(pending[0]!);
        const rest = pending.slice(1);
        if (rest.length > 0) {
          await mapWithConcurrency(rest, panelConcurrency, (idx) => renderCloudPanelAt(idx));
        }
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
      ? errors[0] ?? pm("noneGenerated")
      : after.withImage < after.total
        ? pm("partialRendered", { rendered, total: flat.length })
        : pm("allComplete");

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
export type ComicPanelClearScope =
  | "all"
  | { pageNumber: number; panelNumber?: number };

export function clearComicPanelImages(
  doc: ComicDocument,
  scope: ComicPanelClearScope = "all",
): number {
  let cleared = 0;
  for (const page of doc.pages) {
    if (scope !== "all" && page.page !== scope.pageNumber) continue;
    if (scope !== "all" && scope.panelNumber != null) {
      const idx = scope.panelNumber - 1;
      const panel = page.panels[idx];
      if (panel?.imageUrl?.trim()) {
        delete panel.imageUrl;
        cleared += 1;
      }
      continue;
    }
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
