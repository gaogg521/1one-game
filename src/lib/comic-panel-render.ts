import { generateComfyImages, comfyImageUrl } from "@/lib/comfy-image-gen";
import {
  generateImageDetailed,
  generateImagesBatchDetailed,
  getImageGenAvailability,
} from "@/lib/image-generation";
import { getComicPanelGenConcurrency, getImageGenBatchPanelCount } from "@/lib/model-config";
import { getComfyBaseUrl } from "@/lib/orchestration/comfy-gateway";
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
  opts?: { onlyMissing?: boolean; onProgress?: (ev: ComicPanelProgressEvent) => void },
): Promise<RenderComicPanelsResult> {
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

  const panelConcurrency = getComicPanelGenConcurrency();
  const batchPanelCount = getImageGenBatchPanelCount();
  const useOpenAIBatch =
    batchPanelCount > 0 && flat.length > 1 && flat.length <= batchPanelCount;

  opts?.onProgress?.({
    type: "start",
    total: flat.length,
    message: availability.ok
      ? useOpenAIBatch
        ? `${availability.message} · 一次请求生成 ${flat.length} 张`
        : `${availability.message} · 并发 ${panelConcurrency} 格`
      : availability.message,
    model: availability.openaiModel,
    concurrency: useOpenAIBatch ? 1 : panelConcurrency,
  });

  const prompts = flat.map(
    (f) => f.panel.prompt?.trim() || f.panel.caption?.trim() || "Chinese historical manga panel, cinematic",
  );

  const comfyBase = getComfyBaseUrl();
  let imageSource = "none";
  const urls: (string | undefined)[] = new Array(flat.length);
  const errors: string[] = [];

  if (comfyBase) {
    const comfyImages = await generateComfyImages(prompts);
    if (comfyImages.length > 0) {
      for (let i = 0; i < flat.length; i++) {
        const img = comfyImages[i];
        if (img) urls[i] = comfyImageUrl(comfyBase, img);
      }
      imageSource = "comfy";
    } else {
      errors.push("ComfyUI 未返回图片");
    }
  }

  if (imageSource === "none") {
    if (!availability.ok) {
      return {
        doc,
        rendered: 0,
        total: flat.length,
        imageSource: "none",
        errors: [availability.message],
        imageGenHint: availability.message,
      };
    }

    if (useOpenAIBatch) {
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
        `[comic-panels] 开始文生图 ${flat.length} 格 · 并发 ${panelConcurrency} · ${availability.message}`,
      );
    }

    const generated = useOpenAIBatch
      ? urls
      : await mapWithConcurrency(prompts, panelConcurrency, async (prompt, i) => {
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

      let detail;
      try {
        detail = await generateImageDetailed(prompt, { size: "1024x1024", quality: "standard" });
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
        return undefined;
      }
      console.info(
        `[comic-panels] 第 ${label} 格成功 · ${detail.provider}/${detail.model} · 总 ${formatImageGenElapsed(elapsedMs)}` +
          (apiMs != null ? ` · API ${formatImageGenElapsed(apiMs)}` : ""),
      );
      flat[i]!.panel.imageUrl = detail.url;
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
      return detail.url;
    });

    if (!useOpenAIBatch) {
      for (let i = 0; i < generated.length; i++) {
        if (generated[i]) urls[i] = generated[i];
      }
      if (generated.some(Boolean)) {
        imageSource = generated.some((u) => u && errors.length === 0) ? "openai" : "openai_partial";
        if (imageSource === "openai_partial") imageSource = "openai";
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
