import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOwnerKey } from "@/lib/owner";
import { isPrismaUniqueViolation } from "@/lib/prisma-errors";
import { newShareCode } from "@/lib/share-code";
import { deleteNovelCoverFile } from "@/lib/novel-cover-persist";
import { deleteComicAssetFiles } from "@/lib/comic-assets-gc";
import { parseNovelChapters, serializeNovelChapters } from "@/lib/novel-chapters";
import { validateNovelTitleInput } from "@/lib/novel-display";
import { defaultChapterTitle } from "@/lib/i18n/chapter-labels";
import { resolveRequestLocaleSync } from "@/lib/i18n/request-locale";
import { buildNovelSynopsisHeuristic } from "@/lib/novel-synopsis";
import { NOVEL_CONTINUE_CHAPTER_PRESETS } from "@/lib/novel-continue-options";
import { assessNovelContinuation } from "@/lib/novel-long-continue";
import { PRODUCT } from "@/lib/product-config";
import { loadNovelGenerationMeta } from "@/lib/novel-pipeline-meta-db";
import { loadCreativeBriefForNovel } from "@/lib/novel-creative-brief-db";
import { buildChapterAdaptationProgress } from "@/lib/comic-chapter-adaptation";
import { isChildrenFormattedNovelContent } from "@/lib/children-comic-sections";
import { isChildrenNovelTier } from "@/lib/novel-length";
import type { NovelLengthTier } from "@/lib/novel-length";
import { loadNovelCharacterRoster } from "@/lib/novel-character-roster-db";
import { canDeleteOwnedResource, isSuperAdmin } from "@/lib/super-admin";
import { localizedJsonError } from "@/lib/api/localized-error";
import { canAccessWorkByDirectLink } from "@/lib/literary-safety";
import { assessNovelCreatorQuality, withCreatorEngagementQuality } from "@/lib/creator-quality";
import { resolveCreatorWorkStage } from "@/lib/creator-workflow";
import { getAcceptedLegacyArtifact, getAcceptedLegacyPublicationDisplay, getLegacyCreativeProjectSnapshot } from "@/lib/creator-core/repository";
import { mirrorNovelToCreatorCore } from "@/lib/creator-core/novel-bridge";
import { checkSegmentConsistency } from "@/lib/novel-long-consistency";
import { summarizeLiteraryEngagement } from "@/lib/literary-engagement";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const ownerKey = await getOwnerKey();

  const row = await prisma.novel.findUnique({
    where: { id },
    include: {
      comics: {
        select: { id: true, title: true, createdAt: true, imageUrls: true, status: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!row) {
    return localizedJsonError(req, "notFound", 404);
  }

  const isOwner = ownerKey && row.ownerKey === ownerKey;
  const canDelete = canDeleteOwnedResource(row.ownerKey, ownerKey, req);
  if (!isOwner && !isSuperAdmin(req, ownerKey) && !canAccessWorkByDirectLink(row)) {
    return localizedJsonError(req, "notFound", 404);
  }
  const [acceptedManuscript, acceptedDisplay] = !isOwner
    ? await Promise.all([
        getAcceptedLegacyArtifact({ legacyType: "novel", legacyId: id, kind: "manuscript" }),
        getAcceptedLegacyPublicationDisplay({ legacyType: "novel", legacyId: id }),
      ])
    : [null, null];
  // Readers must consume the manuscript the author explicitly confirmed,
  // while owners can keep editing a newer legacy draft before republishing.
  const visibleContent = acceptedManuscript?.textContent?.trim() || row.content;
  const pipelineMeta = await loadNovelGenerationMeta(id);
  const literaryEngagement = await summarizeLiteraryEngagement({
    workType: "novel",
    workId: id,
    unitCount: Math.max(1, parseNovelChapters(visibleContent, resolveRequestLocaleSync(req)).length),
  });
  const creativeBrief = isOwner ? await loadCreativeBriefForNovel(id) : null;
  const briefKind =
    creativeBrief && isChildrenNovelTier(row.lengthTier as NovelLengthTier)
      ? ("children" as const)
      : creativeBrief
        ? ("novel" as const)
        : null;
  const uiLocale = resolveRequestLocaleSync(req);
  const continuity =
    isOwner && pipelineMeta
      ? checkSegmentConsistency({
          bible: pipelineMeta.bible,
          expectedChapters: pipelineMeta.chapterPlan.chapters,
          segmentText: row.content,
          previousContent: "",
          uiLocale,
        })
      : null;
  const continuation = assessNovelContinuation({
    lengthTier: row.lengthTier,
    content: visibleContent,
    meta: pipelineMeta,
    uiLocale,
  });
  const characterRoster = isOwner ? await loadNovelCharacterRoster(id) : null;
  const creatorCore = isOwner
    ? await getLegacyCreativeProjectSnapshot({ ownerKey, legacyType: "novel", legacyId: id })
    : null;
  const activeContinueJob = isOwner
    ? await prisma.generationJob.findFirst({
        where: {
          type: "novel_continue",
          status: { in: ["queued", "running", "retrying"] },
          project: { ownerKey, legacyType: "novel", legacyId: id },
        },
        orderBy: { createdAt: "desc" },
      })
    : null;
  let continueJob: { id: string; status: string; attempts: number; maxAttempts: number; progress: unknown } | null = null;
  if (activeContinueJob) {
    try {
      const payload = JSON.parse(activeContinueJob.payloadJson) as { novelId?: unknown };
      if (payload.novelId === id) {
        let progress: unknown = null;
        try { progress = JSON.parse(activeContinueJob.progressJson ?? "null"); } catch { /* keep corrupt progress private */ }
        continueJob = {
          id: activeContinueJob.id,
          status: activeContinueJob.status,
          attempts: activeContinueJob.attempts,
          maxAttempts: activeContinueJob.maxAttempts,
          progress,
        };
      }
    } catch {
      // A malformed legacy payload must not make the owner detail unreadable.
    }
  }
  const baseQuality = assessNovelCreatorQuality({
    content: visibleContent,
    prompt: row.prompt,
    lengthTier: row.lengthTier,
    generationMeta: pipelineMeta,
  }).report;
  const quality = withCreatorEngagementQuality(baseQuality, {
    sampleSize: literaryEngagement.sampleSize,
    reads: row.playCount,
    likes: row.likeCount,
    starts: literaryEngagement.starts,
    completed: literaryEngagement.completed,
    completionRate: literaryEngagement.completionRate,
    averageProgressRate: literaryEngagement.averageProgressRate,
    unitViews: literaryEngagement.unitViews,
    literaryHealth: literaryEngagement.health.status,
    literaryAlertCodes: literaryEngagement.health.alerts.map((alert) => alert.code),
  });
  return NextResponse.json({
    novel: {
      id: row.id,
      title: acceptedDisplay?.title?.trim() || row.title,
      prompt: acceptedDisplay?.prompt?.trim() || row.prompt,
      content: visibleContent,
      summary: acceptedDisplay?.summary?.trim() || row.summary,
      lengthTier: acceptedDisplay?.lengthTier?.trim() || row.lengthTier,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      shareCode: row.shareCode,
      /** 仅使用小说专属封面，禁止用漫画首格顶替（避免玄幻配图污染小说封面） */
      coverPath: acceptedDisplay?.coverPath?.trim() || row.coverPath?.trim() || null,
      playCount: row.playCount,
      likeCount: row.likeCount,
      status: row.status,
      visibility: row.visibility,
      workflow: { stage: resolveCreatorWorkStage({ status: row.status, visibility: row.visibility, quality }) },
      quality,
      ...(isOwner ? { literaryEngagement } : {}),
      isOwner: Boolean(isOwner),
      ...(isOwner
        ? {
            generationProvider: row.generationProvider,
            generationModel: row.generationModel,
          }
        : {}),
      canDelete,
      canContinue: Boolean(isOwner) && continuation.canContinue,
      continuationReason: continuation.reason,
      remainingChapterCount: continuation.remainingChapterCount,
      charsRemaining: continuation.charsRemaining,
      hasPipelineMeta: Boolean(pipelineMeta),
      ...(isOwner && pipelineMeta ? { storyPlan: { bible: pipelineMeta.bible, chapterPlan: pipelineMeta.chapterPlan } } : {}),
      continueChapterPresets: NOVEL_CONTINUE_CHAPTER_PRESETS,
      continueDefaultMaxChapters: PRODUCT.novel.longSegmented.continueDefaultMaxChapters,
      polishDefault: PRODUCT.novel.longSegmented.polishAfterSegment,
      ...(isOwner ? { continueJob } : {}),
      comics: row.comics.map((c) => ({
        id: c.id,
        title: c.title,
        createdAt: c.createdAt,
        status: c.status,
      })),
      ...(isOwner
        ? {
            chapterAdaptation: buildChapterAdaptationProgress(
              row.content,
              row.comics.filter((c) => c.status !== "draft_storyboard"),
              {
                isChildren: isChildrenFormattedNovelContent(row.content),
                uiLocale: resolveRequestLocaleSync(req),
              },
            ),
            draftStoryboardComics: row.comics
              .filter((c) => c.status === "draft_storyboard")
              .map((c) => ({ id: c.id, title: c.title, createdAt: c.createdAt })),
            characterRoster,
            creatorCore,
            continuity,
          }
        : {}),
    },
    ...(creativeBrief ? { creativeBrief, briefKind } : {}),
  });
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const ownerKey = await getOwnerKey();
  if (!ownerKey) {
    return localizedJsonError(req, "unauthorized", 401);
  }

  const { id } = await ctx.params;
  const row = await prisma.novel.findUnique({ where: { id } });
  if (!row || row.ownerKey !== ownerKey) {
    return localizedJsonError(req, "notFound", 404);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return localizedJsonError(req, "badJson", 400);
  }

  const payload = body as {
    ensureShareCode?: boolean;
    title?: string;
    content?: string;
    chapters?: Array<{ num?: number; title?: string; body?: string }>;
  };

  const data: { title?: string; content?: string; summary?: string; shareCode?: string } = {};
  const uiLocale = resolveRequestLocaleSync(req);

  if (payload.title !== undefined) {
    const v = validateNovelTitleInput(String(payload.title));
    if (!v.ok) {
      return localizedJsonError(req, v.errorKey, 400, { params: { max: 15 } });
    }
    data.title = v.value;
  }

  if (Array.isArray(payload.chapters) && payload.chapters.length > 0) {
    const normalized = payload.chapters.map((ch, i) => ({
      num: typeof ch.num === "number" && ch.num > 0 ? ch.num : i + 1,
      title: String(ch.title ?? "").trim() || defaultChapterTitle(uiLocale, i + 1),
      body: String(ch.body ?? "").trim(),
    }));
    if (normalized.some((ch) => !ch.body)) {
      return localizedJsonError(req, "chapterEmpty", 400);
    }
    const content = serializeNovelChapters(normalized);
    data.content = content;
    const titleForSummary = data.title ?? row.title;
    data.summary = buildNovelSynopsisHeuristic(content, row.prompt, titleForSummary, uiLocale);
  } else if (payload.content !== undefined) {
    const content = String(payload.content).trim();
    if (content.length < 10) {
      return localizedJsonError(req, "contentTooShort", 400);
    }
    data.content = content;
    const titleForSummary = data.title ?? row.title;
    data.summary = buildNovelSynopsisHeuristic(content, row.prompt, titleForSummary, uiLocale);
  }

  const ensureShareCode = Boolean(payload.ensureShareCode);
  let shareCode = row.shareCode;
  if (ensureShareCode && !shareCode) {
    for (let attempt = 0; attempt < 14; attempt += 1) {
      const code = newShareCode();
      try {
        await prisma.novel.update({ where: { id }, data: { shareCode: code } });
        shareCode = code;
        break;
      } catch (e) {
        if (!isPrismaUniqueViolation(e)) throw e;
      }
    }
  }

  if (Object.keys(data).length > 0) {
    await prisma.novel.update({ where: { id }, data });
  }

  const fresh = await prisma.novel.findUnique({
    where: { id },
    select: {
      id: true,
      ownerKey: true,
      title: true,
      prompt: true,
      content: true,
      summary: true,
      lengthTier: true,
      shareCode: true,
      coverPath: true,
    },
  });

  let core: { creativeProjectId: string; creativeRevisionId: string } | { status: "degraded" } | undefined;
  if (fresh && Object.keys(data).length > 0) {
    try {
      const meta = await loadNovelGenerationMeta(id);
      core = await mirrorNovelToCreatorCore({ novel: fresh, meta, cause: "refine" });
    } catch (error) {
      console.error("[novel-core-mirror]", { novelId: id, error });
      core = { status: "degraded" };
    }
  }

  return NextResponse.json({
    novel: {
      id,
      title: fresh?.title ?? row.title,
      content: fresh?.content ?? row.content,
      summary: fresh?.summary ?? row.summary,
      shareCode: fresh?.shareCode ?? shareCode,
      coverPath: fresh?.coverPath ?? row.coverPath,
    },
    ...(core ? { core } : {}),
  });
}

export async function DELETE(req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const ownerKey = await getOwnerKey();
  if (!ownerKey && !isSuperAdmin(req)) {
    return localizedJsonError(req, "unauthorized", 401);
  }

  const row = await prisma.novel.findUnique({ where: { id } });
  if (!row) {
    return localizedJsonError(req, "notFound", 404);
  }
  if (!canDeleteOwnedResource(row.ownerKey, ownerKey, req)) {
    return localizedJsonError(req, "notFound", 404);
  }

  const linkedComics = await prisma.comic.findMany({ where: { novelId: id }, select: { id: true, imageUrls: true } });
  for (const comic of linkedComics) await deleteComicAssetFiles(comic.id, comic.imageUrls);
  await prisma.novel.delete({ where: { id } });
  await deleteNovelCoverFile(id);
  return NextResponse.json({ ok: true });
}
