/**
 * 文学 QA：漫画配图（lib 直调 vs HTTP SSE）
 */
import { prisma } from "@/lib/prisma";
import { parseComicImageUrls, serializeComicDocument } from "@/lib/comic-format";
import {
  renderComicPanels,
  countPanelsWithImages,
  parseComicDocument,
} from "@/lib/comic-panel-render";
import { resolveComicStoryContext } from "@/lib/comic-story-genre";
import type { AppLocale } from "@/i18n/routing";

export type PanelRenderMode = "lib" | "http";

export type PanelRenderProgress = {
  pass: number;
  maxPasses: number;
  message: string;
};

export async function renderComicPanelsViaLib(opts: {
  comicId: string;
  ownerKey: string;
  uiLocale?: AppLocale;
  onProgress?: (line: string) => void;
}): Promise<{ withImage: number; total: number; ms: number }> {
  const uiLocale = opts.uiLocale ?? "zh-Hans";
  const t0 = Date.now();
  const row = await prisma.comic.findUnique({ where: { id: opts.comicId } });
  if (!row) throw new Error("comic not found");
  if (opts.ownerKey && row.ownerKey !== opts.ownerKey) {
    throw new Error(`comic owner mismatch: expected ${opts.ownerKey}`);
  }
  const doc = parseComicDocument(row.imageUrls);
  const { title, summary, genre } = await resolveComicStoryContext(row, uiLocale);
  const result = await renderComicPanels(doc, {
    onlyMissing: true,
    coverPath: row.coverPath,
    storyGenre: genre,
    storyContext: { title, summary },
    director: doc.director,
    characterSheetUrls: doc.characterSheetUrls,
    comicId: opts.comicId,
    uiLocale,
    onProgress: (ev) => {
      if (ev.type === "panel_done") {
        const msg = "message" in ev && typeof ev.message === "string" ? ev.message : "";
        opts.onProgress?.(msg);
      }
    },
  });
  await prisma.comic.update({
    where: { id: opts.comicId },
    data: { imageUrls: serializeComicDocument(result.doc) },
  });
  const totalPanels =
    result.total > 0 ? result.total : doc.pages.flatMap((p) => p.panels).length;
  const counted = countPanelsWithImages(result.doc);
  return {
    withImage: counted.withImage,
    total: totalPanels > 0 ? totalPanels : counted.total,
    ms: Date.now() - t0,
  };
}

async function readSseStream(res: Response, onEvent: (ev: Record<string, unknown>) => void) {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const chunk of parts) {
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        try {
          onEvent(JSON.parse(line.slice(6)) as Record<string, unknown>);
        } catch {
          /* ignore */
        }
      }
    }
  }
}

export async function renderComicPanelsViaHttp(opts: {
  comicId: string;
  ownerKey: string;
  baseUrl?: string;
  onProgress?: (line: string) => void;
}): Promise<{ withImage: number; total: number; ms: number }> {
  const base = opts.baseUrl?.replace(/\/$/, "") || "http://127.0.0.1:8888";
  const t0 = Date.now();
  const res = await fetch(`${base}/api/comic/${opts.comicId}/panels/stream`, {
    method: "POST",
    headers: { Cookie: `gcreator_owner=${opts.ownerKey}` },
  });
  if (!res.ok) {
    throw new Error(`panels/stream ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const done = { withImage: 0, total: 0 };
  await readSseStream(res, (ev) => {
    const type = typeof ev.type === "string" ? ev.type : "";
    if (type === "panel_done") {
      const msg = typeof ev.message === "string" ? ev.message : "";
      opts.onProgress?.(msg);
    }
    if (type === "error") {
      throw new Error(String(ev.error ?? ev.message ?? "配图失败"));
    }
    if (type === "done") {
      if (typeof ev.withImage === "number") done.withImage = ev.withImage;
      if (typeof ev.total === "number") done.total = ev.total;
    }
  });
  return {
    withImage: done.withImage,
    total: done.total,
    ms: Date.now() - t0,
  };
}

export async function renderComicPanelsUntilComplete(opts: {
  comicId: string;
  ownerKey: string;
  expectedTotal: number;
  mode?: PanelRenderMode;
  baseUrl?: string;
  maxPasses?: number;
  uiLocale?: AppLocale;
  onPassStart?: (p: PanelRenderProgress) => void;
  onProgress?: (line: string) => void;
}): Promise<{ withImage: number; totalMs: number }> {
  const mode = opts.mode ?? "lib";
  const maxPasses = Math.min(6, Math.max(1, opts.maxPasses ?? 4));
  let totalMs = 0;
  let withImage = 0;

  for (let pass = 1; pass <= maxPasses; pass++) {
    opts.onPassStart?.({ pass, maxPasses, message: mode });
    const round =
      mode === "lib"
        ? await renderComicPanelsViaLib({
            comicId: opts.comicId,
            ownerKey: opts.ownerKey,
            uiLocale: opts.uiLocale,
            onProgress: opts.onProgress,
          })
        : await renderComicPanelsViaHttp({
            comicId: opts.comicId,
            ownerKey: opts.ownerKey,
            baseUrl: opts.baseUrl,
            onProgress: opts.onProgress,
          });
    totalMs += round.ms;
    withImage = Math.max(withImage, round.withImage);
    if (withImage >= opts.expectedTotal) break;
    const remain = opts.expectedTotal - withImage;
    if (remain > 0 && pass < maxPasses) {
      opts.onProgress?.(`仍缺 ${remain} 格`);
    }
  }

  if (mode === "lib") {
    const row = await prisma.comic.findUnique({ where: { id: opts.comicId } });
    if (row) {
      withImage = parseComicImageUrls(row.imageUrls)
        .pages.flatMap((p) => p.panels)
        .filter((p) => p.imageUrl?.trim()).length;
    }
  }

  return { withImage, totalMs };
}
