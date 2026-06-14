import { NextResponse } from "next/server";
import { generateComicCover } from "@/lib/cover-generation";
import { resolveComicStoryContext } from "@/lib/comic-story-genre";
import { prisma } from "@/lib/prisma";
import { getOwnerKey } from "@/lib/owner";
import {
  clearComicPanelImages,
  countPanelsWithImages,
  parseComicDocument,
  renderComicPanels,
  serializeComicPanels,
} from "@/lib/comic-panel-render";
import { getImageGenAvailability } from "@/lib/image-generation";
import { localizedJsonError } from "@/lib/api/localized-error";
import { comicPanelProgressMessage } from "@/lib/i18n/progress-message";
import { resolveRequestLocaleSync } from "@/lib/i18n/request-locale";

/** 漫画分镜配图：每格经网关文生图约 1～6 分钟，4 格顺序生成。 */
export const maxDuration = 600;

type RouteContext = { params: Promise<{ id: string }> };

type PanelsBody = { regenerate?: boolean; page?: number; panel?: number };

export async function POST(req: Request, ctx: RouteContext) {
  const uiLocale = resolveRequestLocaleSync(req);
  const pm = (key: string, params?: Record<string, string | number | undefined | null>) =>
    comicPanelProgressMessage(uiLocale, key, params);

  const ownerKey = await getOwnerKey();
  if (!ownerKey) {
    return localizedJsonError(req, "unauthorized", 401);
  }

  const { id } = await ctx.params;
  const row = await prisma.comic.findUnique({ where: { id } });
  if (!row || row.ownerKey !== ownerKey) {
    return localizedJsonError(req, "notFound", 404);
  }

  let body: PanelsBody = {};
  const reqCt = req.headers.get("content-type") ?? "";
  if (reqCt.includes("application/json")) {
    try {
      body = (await req.json()) as PanelsBody;
    } catch {
      body = {};
    }
  }

  const doc = parseComicDocument(row.imageUrls);
  if (doc.pages.length === 0) {
    return localizedJsonError(req, "noStoryboard", 400);
  }

  if (body.regenerate) {
    const scope =
      typeof body.page === "number" && body.page >= 1
        ? {
            pageNumber: Math.floor(body.page),
            ...(typeof body.panel === "number" && body.panel >= 1
              ? { panelNumber: Math.floor(body.panel) }
              : {}),
          }
        : "all";
    clearComicPanelImages(doc, scope);
  }

  const before = countPanelsWithImages(doc);
  if (!body.regenerate && before.withImage >= before.total) {
    return NextResponse.json({
      ok: true,
      comic: { id, imageUrls: row.imageUrls },
      rendered: 0,
      withImage: before.withImage,
      total: before.total,
      imageSource: "none",
      message: pm("panelsComplete"),
    });
  }

  const availability = getImageGenAvailability();
  const { title: storyTitle, summary: storySummary, genre: storyGenre } =
    await resolveComicStoryContext(row, uiLocale);
  let coverPath = row.coverPath;

  const fullRegenerate =
    body.regenerate && !(typeof body.page === "number" && body.page >= 1);
  if (fullRegenerate && row.novelId) {
    const novel = await prisma.novel.findUnique({
      where: { id: row.novelId },
      select: { summary: true, content: true },
    });
    const newCover = await generateComicCover(
      id,
      row.title,
      novel?.summary ?? "",
      novel?.content?.slice(0, 800) ?? row.prompt ?? "",
      storyGenre,
    );
    if (newCover) coverPath = newCover;
  }

  try {
    const { doc: updated, rendered, total, imageSource, errors, imageGenHint } =
      await renderComicPanels(doc, {
        onlyMissing: true,
        coverPath,
        storyGenre,
        storyContext: { title: storyTitle, summary: storySummary },
        skipStyleRefs: fullRegenerate && !doc.characterSheetUrls?.length,
        director: doc.director,
        characterSheetUrls: doc.characterSheetUrls,
        comicId: id,
        uiLocale,
      });
    const after = countPanelsWithImages(updated);
    const imageUrls = serializeComicPanels(updated);

    await prisma.comic.update({
      where: { id },
      data: {
        imageUrls,
        status: after.withImage > 0 ? "ready" : row.status,
      },
    });

    const errSummary = errors.length > 0 ? errors.slice(0, 4).join("；") : undefined;
    const errorSuffix =
      errSummary && (uiLocale === "zh-Hans" || uiLocale === "zh-Hant")
        ? `（${errSummary}）`
        : errSummary
          ? ` (${errSummary})`
          : "";

    return NextResponse.json({
      ok: true,
      comic: { id, imageUrls },
      rendered,
      attempted: total,
      withImage: after.withImage,
      total: after.total,
      imageSource,
      imageGenModel: availability.openaiModel,
      imageGenHint,
      errors: errors.length ? errors : undefined,
      message:
        after.withImage === 0
          ? errSummary ||
            pm("noneGeneratedWithHint", { hint: availability.message })
          : after.withImage < after.total
            ? pm("partialWithRemaining", {
                rendered,
                remaining: after.total - after.withImage,
                errors: errorSuffix,
              })
            : pm("generateComplete"),
    });
  } catch {
    return localizedJsonError(req, "comicPanelRenderFailed", 502);
  }
}
