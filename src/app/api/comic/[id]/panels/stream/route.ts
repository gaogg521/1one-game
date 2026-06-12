import { generateComicCover } from "@/lib/cover-generation";
import { getImageGenAvailability } from "@/lib/image-generation";
import { resolveComicStoryContext } from "@/lib/comic-story-genre";
import { getOwnerKey } from "@/lib/owner";
import { prisma } from "@/lib/prisma";
import {
  clearComicPanelImages,
  countPanelsWithImages,
  parseComicDocument,
  renderComicPanels,
  serializeComicPanels,
} from "@/lib/comic-panel-render";
import { gateGenerationQuota } from "@/lib/commerce/generation-gate";
import { apiErrorTextForLocale, localizedStreamError } from "@/lib/api/localized-error";
import { coverGenreLabel } from "@/lib/i18n/cover-genre-label";
import { comicPanelProgressMessage } from "@/lib/i18n/progress-message";
import { resolveRequestLocaleSync } from "@/lib/i18n/request-locale";

export const maxDuration = 600;

type RouteContext = { params: Promise<{ id: string }> };

function sseData(obj: Record<string, unknown>): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

type PanelStreamBody = {
  /** 清空已有配图后全部重画（封面仍作风格参考） */
  regenerate?: boolean;
  /** 仅重画指定页（1-based，与分镜 page 字段一致） */
  page?: number;
};

export async function POST(req: Request, ctx: RouteContext) {
  const uiLocale = resolveRequestLocaleSync(req);
  const pm = (key: string, params?: Record<string, string | number | undefined | null>) =>
    comicPanelProgressMessage(uiLocale, key, params);

  const ownerKey = await getOwnerKey();
  if (!ownerKey) {
    return localizedStreamError(req, "unauthorized", 401);
  }

  const { id } = await ctx.params;

  const quotaBlock = await gateGenerationQuota("comicPanels", { refId: id });
  if (quotaBlock) return quotaBlock;
  const row = await prisma.comic.findUnique({ where: { id } });
  if (!row || row.ownerKey !== ownerKey) {
    return localizedStreamError(req, "notFound", 404);
  }

  let body: PanelStreamBody = {};
  const reqCt = req.headers.get("content-type") ?? "";
  if (reqCt.includes("application/json")) {
    try {
      body = (await req.json()) as PanelStreamBody;
    } catch {
      body = {};
    }
  }

  const doc = parseComicDocument(row.imageUrls);
  if (doc.pages.length === 0) {
    return localizedStreamError(req, "noStoryboard", 400);
  }

  const availability = getImageGenAvailability();
  const encoder = new TextEncoder();
  const { title: storyTitle, summary: storySummary, genre: storyGenre } =
    await resolveComicStoryContext(row, uiLocale);
  let coverPath = row.coverPath;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(sseData(obj)));
      };

      try {
        const fullRegenerate =
          body.regenerate &&
          !(typeof body.page === "number" && body.page >= 1);

        if (fullRegenerate && row.novelId) {
          const novel = await prisma.novel.findUnique({
            where: { id: row.novelId },
            select: { summary: true, content: true },
          });
          const genreLabel = coverGenreLabel(uiLocale, storyGenre);
          send({ type: "status", message: pm("regenCover", { genre: genreLabel }) });
          const newCover = await generateComicCover(
            id,
            row.title,
            novel?.summary ?? "",
            novel?.content?.slice(0, 800) ?? row.prompt ?? "",
            storyGenre,
          );
          if (newCover) coverPath = newCover;
        }

        if (body.regenerate) {
          const scope =
            typeof body.page === "number" && body.page >= 1
              ? { pageNumber: Math.floor(body.page) }
              : "all";
          const cleared = clearComicPanelImages(doc, scope);
          const clearedUrls = serializeComicPanels(doc);
          await prisma.comic.update({
            where: { id },
            data: { imageUrls: clearedUrls },
          });
          send({
            type: "status",
            message:
              cleared > 0
                ? scope === "all"
                  ? pm("clearedAll", { count: cleared })
                  : pm("clearedPage", { page: scope.pageNumber, count: cleared })
                : pm("scopeNoImages"),
            imageUrls: clearedUrls,
          });
        } else {
          send({
            type: "status",
            message: availability.ok
              ? pm("connectedSerial", { detail: availability.message })
              : availability.message,
          });
        }

        const result = await renderComicPanels(doc, {
          onlyMissing: true,
          coverPath,
          storyGenre,
          storyContext: { title: storyTitle, summary: storySummary },
          skipStyleRefs: fullRegenerate && !doc.characterSheetUrls?.length,
          director: doc.director,
          characterSheetUrls: doc.characterSheetUrls,
          uiLocale,
          onProgress: (ev) => {
            send(ev as unknown as Record<string, unknown>);
            if (ev.type === "panel_done") {
              void prisma.comic
                .update({
                  where: { id },
                  data: {
                    imageUrls: ev.imageUrls,
                    status: ev.withImage > 0 ? "ready" : row.status,
                  },
                })
                .catch(() => {});
            }
          },
        });

        const imageUrls = serializeComicPanels(result.doc);
        const after = countPanelsWithImages(result.doc);

        await prisma.comic.update({
          where: { id },
          data: {
            imageUrls,
            status: after.withImage > 0 ? "ready" : row.status,
          },
        });

        send({
          type: "done",
          ok: true,
          comic: { id, imageUrls },
          rendered: result.rendered,
          withImage: after.withImage,
          total: after.total,
          imageSource: result.imageSource,
          errors: result.errors.length ? result.errors : undefined,
          message:
            after.withImage === 0
              ? result.errors.join("；") || pm("noneGenerated")
              : after.withImage < after.total
                ? pm("partialDone", { withImage: after.withImage, total: after.total })
                : pm("allComplete"),
        });
      } catch {
        send({
          type: "error",
          error: apiErrorTextForLocale(uiLocale, "comicPanelRenderFailed"),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
