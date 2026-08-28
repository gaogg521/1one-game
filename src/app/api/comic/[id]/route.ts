import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOwnerKey } from "@/lib/owner";
import { isPrismaUniqueViolation } from "@/lib/prisma-errors";
import { newShareCode } from "@/lib/share-code";
import { displayComicTitle, resolveComicCoverPath } from "@/lib/comic-display";
import { countPanelsWithImages, parseComicDocument } from "@/lib/comic-panel-render";
import {
  addComicPage,
  addComicPanel,
  mergeComicPages,
  moveComicPanel,
  removeComicPanel,
  reorderComicPanelsInPage,
  serializeComicDocument,
  updateComicPanelFields,
} from "@/lib/comic-format";
import { normalizeNovelTitle } from "@/lib/novel-display";
import { canDeleteOwnedResource, isSuperAdmin } from "@/lib/super-admin";
import { localizedJsonError } from "@/lib/api/localized-error";
import { resolveRequestLocaleSync } from "@/lib/i18n/request-locale";
import { assessComicCreatorQuality, withCreatorEngagementQuality } from "@/lib/creator-quality";
import { resolveCreatorWorkStage } from "@/lib/creator-workflow";
import { mirrorComicToCreatorCore } from "@/lib/creator-core/comic-bridge";
import { canAccessWorkByDirectLink } from "@/lib/literary-safety";
import { deleteComicAssetFiles } from "@/lib/comic-assets-gc";
import { summarizeLiteraryEngagement } from "@/lib/literary-engagement";
import { getAcceptedLegacyArtifact, getAcceptedLegacyPublicationDisplay, getLegacyCreativeProjectSnapshot } from "@/lib/creator-core/repository";

type RouteContext = { params: Promise<{ id: string }> };

async function saveStoryboardRevision(input: {
  id: string;
  ownerKey: string;
  imageUrls: string;
  expectedUpdatedAt: Date;
}) {
  const updated = await prisma.comic.updateMany({
    where: {
      id: input.id,
      ownerKey: input.ownerKey,
      updatedAt: input.expectedUpdatedAt,
    },
    data: { imageUrls: input.imageUrls },
  });
  if (updated.count !== 1) return null;

  const comic = await prisma.comic.findUniqueOrThrow({ where: { id: input.id } });
  try {
    const core = await mirrorComicToCreatorCore({ comic, cause: "refine" });
    return { core, revisionToken: comic.updatedAt.toISOString() };
  } catch (error) {
    console.error("[comic-core-mirror]", { comicId: input.id, error });
    return { core: { status: "degraded" as const }, revisionToken: comic.updatedAt.toISOString() };
  }
}

export async function GET(req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const ownerKey = await getOwnerKey();

  const row = await prisma.comic.findUnique({
    where: { id },
    include: { novel: { select: { id: true, title: true } } },
  });
  if (!row) {
    return localizedJsonError(req, "notFound", 404);
  }

  const isOwner = ownerKey && row.ownerKey === ownerKey;
  const canDelete = canDeleteOwnedResource(row.ownerKey, ownerKey, req);
  if (!isOwner && !isSuperAdmin(req, ownerKey) && !canAccessWorkByDirectLink(row)) {
    return localizedJsonError(req, "notFound", 404);
  }
  const [acceptedComicDocument, acceptedDisplay] = !isOwner
    ? await Promise.all([
        getAcceptedLegacyArtifact({ legacyType: "comic", legacyId: id, kind: "comic_document" }),
        getAcceptedLegacyPublicationDisplay({ legacyType: "comic", legacyId: id }),
      ])
    : [null, null];
  // The editable legacy row may move ahead of the published version. Public
  // reading remains pinned to the author's confirmed storyboard artifact.
  const acceptedDoc = acceptedComicDocument?.content;
  const doc = acceptedDoc && typeof acceptedDoc === "object"
    ? (acceptedDoc as ReturnType<typeof parseComicDocument>)
    : parseComicDocument(row.imageUrls);
  const visibleImageUrls = acceptedDoc && typeof acceptedDoc === "object"
    ? serializeComicDocument(doc)
    : row.imageUrls;
  const panelStats = countPanelsWithImages(doc);
  const literaryEngagement = await summarizeLiteraryEngagement({ workType: "comic", workId: id, unitCount: Math.max(1, doc.pages.length) });
  const baseQuality = assessComicCreatorQuality(visibleImageUrls).report;
  const quality = withCreatorEngagementQuality(baseQuality, {
    sampleSize: literaryEngagement.sampleSize,
    likes: row.likeCount,
    starts: literaryEngagement.starts,
    completed: literaryEngagement.completed,
    completionRate: literaryEngagement.completionRate,
    averageProgressRate: literaryEngagement.averageProgressRate,
    unitViews: literaryEngagement.unitViews,
    literaryHealth: literaryEngagement.health.status,
    literaryAlertCodes: literaryEngagement.health.alerts.map((alert) => alert.code),
  });

  const uiLocale = resolveRequestLocaleSync(req);
  const creatorCore = isOwner
    ? await getLegacyCreativeProjectSnapshot({ ownerKey: ownerKey!, legacyType: "comic", legacyId: id })
    : null;

  return NextResponse.json({
    comic: {
      id: row.id,
      title: acceptedDisplay?.title?.trim() || row.title,
      displayTitle: displayComicTitle(
        acceptedDisplay?.title?.trim() || row.title,
        acceptedDisplay?.novelTitle?.trim() || row.novel?.title,
        acceptedDisplay?.prompt?.trim() || row.prompt,
        uiLocale,
      ),
      prompt: acceptedDisplay?.prompt?.trim() || row.prompt,
      imageUrls: visibleImageUrls,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      revisionToken: row.updatedAt.toISOString(),
      shareCode: row.shareCode,
      likeCount: row.likeCount,
      status: row.status,
      visibility: row.visibility,
      workflow: { stage: resolveCreatorWorkStage({ status: row.status, visibility: row.visibility, quality }) },
      quality,
      ...(isOwner ? { literaryEngagement } : {}),
      ...(isOwner ? { creatorCore } : {}),
      isOwner: Boolean(isOwner),
      ...(isOwner
        ? {
            generationProvider: row.generationProvider,
            generationModel: row.generationModel,
          }
        : {}),
      canDelete,
      panelsWithImage: panelStats.withImage,
      panelsTotal: panelStats.total,
      coverPath: resolveComicCoverPath(visibleImageUrls, acceptedDisplay?.coverPath?.trim() || row.coverPath),
      novelId: row.novelId,
      novel: row.novel
        ? {
            ...row.novel,
            displayTitle: normalizeNovelTitle(row.novel.title, row.prompt, undefined, uiLocale),
          }
        : null,
    },
  });
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const ownerKey = await getOwnerKey();
  if (!ownerKey) {
    return localizedJsonError(req, "unauthorized", 401);
  }

  const { id } = await ctx.params;
  const row = await prisma.comic.findUnique({ where: { id } });
  if (!row || row.ownerKey !== ownerKey) {
    return localizedJsonError(req, "notFound", 404);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return localizedJsonError(req, "badJson", 400);
  }

  const ensureShareCode =
    typeof body === "object" &&
    body !== null &&
    "ensureShareCode" in body &&
    Boolean((body as { ensureShareCode?: unknown }).ensureShareCode);

  const storyboardReorder =
    typeof body === "object" &&
    body !== null &&
    "storyboardReorder" in body &&
    typeof (body as { storyboardReorder?: unknown }).storyboardReorder === "object" &&
    (body as { storyboardReorder?: unknown }).storyboardReorder !== null
      ? (body as {
          storyboardReorder: { pageIndex?: unknown; fromIndex?: unknown; toIndex?: unknown };
        }).storyboardReorder
      : null;

  const expectedRevisionToken =
    typeof body === "object" &&
    body !== null &&
    "expectedRevisionToken" in body &&
    typeof (body as { expectedRevisionToken?: unknown }).expectedRevisionToken === "string"
      ? (body as { expectedRevisionToken: string }).expectedRevisionToken
      : null;
  const expectedUpdatedAt = expectedRevisionToken ? new Date(expectedRevisionToken) : null;
  const hasValidRevisionToken = Boolean(expectedUpdatedAt && Number.isFinite(expectedUpdatedAt.getTime()));

  if (storyboardReorder) {
    if (!hasValidRevisionToken) return localizedJsonError(req, "storyboardRevisionRequired", 400);
    const pageIndex = Number(storyboardReorder.pageIndex);
    const fromIndex = Number(storyboardReorder.fromIndex);
    const toIndex = Number(storyboardReorder.toIndex);
    if (!Number.isFinite(pageIndex) || !Number.isFinite(fromIndex) || !Number.isFinite(toIndex)) {
      return localizedJsonError(req, "badJson", 400);
    }
    const doc = parseComicDocument(row.imageUrls);
    const next = reorderComicPanelsInPage(doc, pageIndex, fromIndex, toIndex);
    if (!next) {
      return localizedJsonError(req, "badJson", 400);
    }
    const imageUrls = serializeComicDocument(next);
    const saved = await saveStoryboardRevision({ id, ownerKey, imageUrls, expectedUpdatedAt: expectedUpdatedAt! });
    if (!saved) return localizedJsonError(req, "storyboardConflict", 409);
    return NextResponse.json({ ok: true, pages: next.pages, imageUrls, ...saved });
  }

  const storyboardMove =
    typeof body === "object" &&
    body !== null &&
    "storyboardMovePanel" in body &&
    typeof (body as { storyboardMovePanel?: unknown }).storyboardMovePanel === "object" &&
    (body as { storyboardMovePanel?: unknown }).storyboardMovePanel !== null
      ? (body as {
          storyboardMovePanel: {
            fromPageIndex?: unknown;
            fromPanelIndex?: unknown;
            toPageIndex?: unknown;
            toPanelIndex?: unknown;
          };
        }).storyboardMovePanel
      : null;

  if (storyboardMove) {
    if (!hasValidRevisionToken) return localizedJsonError(req, "storyboardRevisionRequired", 400);
    const fromPageIndex = Number(storyboardMove.fromPageIndex);
    const fromPanelIndex = Number(storyboardMove.fromPanelIndex);
    const toPageIndex = Number(storyboardMove.toPageIndex);
    const toPanelIndex = Number(storyboardMove.toPanelIndex);
    if (
      !Number.isFinite(fromPageIndex) ||
      !Number.isFinite(fromPanelIndex) ||
      !Number.isFinite(toPageIndex) ||
      !Number.isFinite(toPanelIndex)
    ) {
      return localizedJsonError(req, "badJson", 400);
    }
    const doc = parseComicDocument(row.imageUrls);
    const next = moveComicPanel(doc, fromPageIndex, fromPanelIndex, toPageIndex, toPanelIndex);
    if (!next) {
      return localizedJsonError(req, "badJson", 400);
    }
    const imageUrls = serializeComicDocument(next);
    const saved = await saveStoryboardRevision({ id, ownerKey, imageUrls, expectedUpdatedAt: expectedUpdatedAt! });
    if (!saved) return localizedJsonError(req, "storyboardConflict", 409);
    return NextResponse.json({ ok: true, pages: next.pages, imageUrls, ...saved });
  }

  const storyboardAdd =
    typeof body === "object" &&
    body !== null &&
    "storyboardAddPanel" in body &&
    typeof (body as { storyboardAddPanel?: unknown }).storyboardAddPanel === "object" &&
    (body as { storyboardAddPanel?: unknown }).storyboardAddPanel !== null
      ? (body as { storyboardAddPanel: { pageIndex?: unknown; afterPanelIndex?: unknown } })
          .storyboardAddPanel
      : null;

  if (storyboardAdd) {
    if (!hasValidRevisionToken) return localizedJsonError(req, "storyboardRevisionRequired", 400);
    const pageIndex = Number(storyboardAdd.pageIndex);
    const afterPanelIndex =
      storyboardAdd.afterPanelIndex !== undefined
        ? Number(storyboardAdd.afterPanelIndex)
        : undefined;
    if (!Number.isFinite(pageIndex)) {
      return localizedJsonError(req, "badJson", 400);
    }
    const doc = parseComicDocument(row.imageUrls);
    const next = addComicPanel(
      doc,
      pageIndex,
      afterPanelIndex !== undefined && Number.isFinite(afterPanelIndex) ? afterPanelIndex : undefined,
    );
    if (!next) {
      return localizedJsonError(req, "badJson", 400);
    }
    const imageUrls = serializeComicDocument(next);
    const saved = await saveStoryboardRevision({ id, ownerKey, imageUrls, expectedUpdatedAt: expectedUpdatedAt! });
    if (!saved) return localizedJsonError(req, "storyboardConflict", 409);
    return NextResponse.json({ ok: true, pages: next.pages, imageUrls, ...saved });
  }

  const storyboardRemove =
    typeof body === "object" &&
    body !== null &&
    "storyboardRemovePanel" in body &&
    typeof (body as { storyboardRemovePanel?: unknown }).storyboardRemovePanel === "object" &&
    (body as { storyboardRemovePanel?: unknown }).storyboardRemovePanel !== null
      ? (body as { storyboardRemovePanel: { pageIndex?: unknown; panelIndex?: unknown } })
          .storyboardRemovePanel
      : null;

  if (storyboardRemove) {
    if (!hasValidRevisionToken) return localizedJsonError(req, "storyboardRevisionRequired", 400);
    const pageIndex = Number(storyboardRemove.pageIndex);
    const panelIndex = Number(storyboardRemove.panelIndex);
    if (!Number.isFinite(pageIndex) || !Number.isFinite(panelIndex)) {
      return localizedJsonError(req, "badJson", 400);
    }
    const doc = parseComicDocument(row.imageUrls);
    const next = removeComicPanel(doc, pageIndex, panelIndex);
    if (!next) {
      return localizedJsonError(req, "storyboardRemoveBlocked", 400);
    }
    const imageUrls = serializeComicDocument(next);
    const saved = await saveStoryboardRevision({ id, ownerKey, imageUrls, expectedUpdatedAt: expectedUpdatedAt! });
    if (!saved) return localizedJsonError(req, "storyboardConflict", 409);
    return NextResponse.json({ ok: true, pages: next.pages, imageUrls, ...saved });
  }

  const storyboardUpdate =
    typeof body === "object" &&
    body !== null &&
    "storyboardUpdatePanel" in body &&
    typeof (body as { storyboardUpdatePanel?: unknown }).storyboardUpdatePanel === "object" &&
    (body as { storyboardUpdatePanel?: unknown }).storyboardUpdatePanel !== null
      ? (body as {
          storyboardUpdatePanel: {
            pageIndex?: unknown;
            panelIndex?: unknown;
            fields?: unknown;
          };
        }).storyboardUpdatePanel
      : null;

  const storyboardAddPage =
    typeof body === "object" &&
    body !== null &&
    "storyboardAddPage" in body &&
    typeof (body as { storyboardAddPage?: unknown }).storyboardAddPage === "object" &&
    (body as { storyboardAddPage?: unknown }).storyboardAddPage !== null
      ? (body as { storyboardAddPage: { afterPageIndex?: unknown } }).storyboardAddPage
      : null;

  if (storyboardAddPage) {
    if (!hasValidRevisionToken) return localizedJsonError(req, "storyboardRevisionRequired", 400);
    const afterPageIndex =
      storyboardAddPage.afterPageIndex !== undefined
        ? Number(storyboardAddPage.afterPageIndex)
        : undefined;
    const doc = parseComicDocument(row.imageUrls);
    const next = addComicPage(
      doc,
      afterPageIndex !== undefined && Number.isFinite(afterPageIndex) ? afterPageIndex : undefined,
    );
    if (!next) {
      return localizedJsonError(req, "storyboardAddPageBlocked", 400);
    }
    const imageUrls = serializeComicDocument(next);
    const saved = await saveStoryboardRevision({ id, ownerKey, imageUrls, expectedUpdatedAt: expectedUpdatedAt! });
    if (!saved) return localizedJsonError(req, "storyboardConflict", 409);
    return NextResponse.json({ ok: true, pages: next.pages, imageUrls, ...saved });
  }

  const storyboardMergePage =
    typeof body === "object" &&
    body !== null &&
    "storyboardMergePage" in body &&
    typeof (body as { storyboardMergePage?: unknown }).storyboardMergePage === "object" &&
    (body as { storyboardMergePage?: unknown }).storyboardMergePage !== null
      ? (body as { storyboardMergePage: { pageIndex?: unknown } }).storyboardMergePage
      : null;

  if (storyboardMergePage) {
    if (!hasValidRevisionToken) return localizedJsonError(req, "storyboardRevisionRequired", 400);
    const pageIndex = Number(storyboardMergePage.pageIndex);
    if (!Number.isFinite(pageIndex)) {
      return localizedJsonError(req, "badJson", 400);
    }
    const doc = parseComicDocument(row.imageUrls);
    const next = mergeComicPages(doc, pageIndex);
    if (!next) {
      return localizedJsonError(req, "storyboardMergeBlocked", 400);
    }
    const imageUrls = serializeComicDocument(next);
    const saved = await saveStoryboardRevision({ id, ownerKey, imageUrls, expectedUpdatedAt: expectedUpdatedAt! });
    if (!saved) return localizedJsonError(req, "storyboardConflict", 409);
    return NextResponse.json({ ok: true, pages: next.pages, imageUrls, ...saved });
  }

  if (storyboardUpdate) {
    if (!hasValidRevisionToken) return localizedJsonError(req, "storyboardRevisionRequired", 400);
    const pageIndex = Number(storyboardUpdate.pageIndex);
    const panelIndex = Number(storyboardUpdate.panelIndex);
    const rawFields = storyboardUpdate.fields;
    if (
      !Number.isFinite(pageIndex) ||
      !Number.isFinite(panelIndex) ||
      !rawFields ||
      typeof rawFields !== "object"
    ) {
      return localizedJsonError(req, "badJson", 400);
    }
    const f = rawFields as Record<string, unknown>;
    const fields: { speaker?: string; caption?: string; prompt?: string } = {};
    if (typeof f.speaker === "string") fields.speaker = f.speaker;
    if (typeof f.caption === "string") fields.caption = f.caption;
    if (typeof f.prompt === "string") fields.prompt = f.prompt;
    if (!Object.keys(fields).length) {
      return localizedJsonError(req, "badJson", 400);
    }
    const doc = parseComicDocument(row.imageUrls);
    const next = updateComicPanelFields(doc, pageIndex, panelIndex, fields);
    if (!next) {
      return localizedJsonError(req, "badJson", 400);
    }
    const imageUrls = serializeComicDocument(next);
    const saved = await saveStoryboardRevision({ id, ownerKey, imageUrls, expectedUpdatedAt: expectedUpdatedAt! });
    if (!saved) return localizedJsonError(req, "storyboardConflict", 409);
    return NextResponse.json({ ok: true, pages: next.pages, imageUrls, ...saved });
  }

  let shareCode = row.shareCode;
  if (ensureShareCode && !shareCode) {
    for (let attempt = 0; attempt < 14; attempt += 1) {
      const code = newShareCode();
      try {
        await prisma.comic.update({ where: { id }, data: { shareCode: code } });
        shareCode = code;
        break;
      } catch (e) {
        if (!isPrismaUniqueViolation(e)) throw e;
      }
    }
  }

  const fresh = await prisma.comic.findUnique({
    where: { id },
    select: { title: true, shareCode: true },
  });

  return NextResponse.json({
    comic: {
      id,
      title: fresh?.title ?? row.title,
      shareCode: fresh?.shareCode ?? shareCode,
    },
  });
}

export async function DELETE(req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const ownerKey = await getOwnerKey();
  if (!ownerKey && !isSuperAdmin(req)) {
    return localizedJsonError(req, "unauthorized", 401);
  }

  const row = await prisma.comic.findUnique({ where: { id } });
  if (!row) {
    return localizedJsonError(req, "notFound", 404);
  }
  if (!canDeleteOwnedResource(row.ownerKey, ownerKey, req)) {
    return localizedJsonError(req, "notFound", 404);
  }

  await deleteComicAssetFiles(row.id, row.imageUrls);
  await prisma.comic.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
