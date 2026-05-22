import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOwnerKey } from "@/lib/owner";
import { isPrismaUniqueViolation } from "@/lib/prisma-errors";
import { newShareCode } from "@/lib/share-code";
import { deleteNovelCoverFile } from "@/lib/novel-cover-persist";
import { serializeNovelChapters } from "@/lib/novel-chapters";
import { validateNovelTitleInput } from "@/lib/novel-display";
import { buildNovelSynopsisHeuristic } from "@/lib/novel-synopsis";
import { NOVEL_CONTINUE_CHAPTER_PRESETS } from "@/lib/novel-continue-options";
import { assessNovelContinuation } from "@/lib/novel-long-continue";
import { PRODUCT } from "@/lib/product-config";
import { loadNovelGenerationMeta } from "@/lib/novel-pipeline-meta-db";
import { loadCreativeBriefForNovel } from "@/lib/novel-creative-brief-db";
import { isChildrenNovelTier } from "@/lib/novel-length";
import type { NovelLengthTier } from "@/lib/novel-length";
import { canDeleteOwnedResource, isSuperAdmin } from "@/lib/super-admin";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const ownerKey = await getOwnerKey();

  const row = await prisma.novel.findUnique({
    where: { id },
    include: { comics: { select: { id: true, title: true, createdAt: true } } },
  });
  if (!row) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }

  const isOwner = ownerKey && row.ownerKey === ownerKey;
  const canDelete = canDeleteOwnedResource(row.ownerKey, ownerKey, _req);
  const pipelineMeta = await loadNovelGenerationMeta(id);
  const creativeBrief = isOwner ? await loadCreativeBriefForNovel(id) : null;
  const briefKind =
    creativeBrief && isChildrenNovelTier(row.lengthTier as NovelLengthTier)
      ? ("children" as const)
      : creativeBrief
        ? ("novel" as const)
        : null;
  const continuation = assessNovelContinuation({
    lengthTier: row.lengthTier,
    content: row.content,
    meta: pipelineMeta,
  });
  return NextResponse.json({
    novel: {
      id: row.id,
      title: row.title,
      prompt: row.prompt,
      content: row.content,
      summary: row.summary,
      lengthTier: row.lengthTier,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      shareCode: row.shareCode,
      /** 仅使用小说专属封面，禁止用漫画首格顶替（避免玄幻配图污染小说封面） */
      coverPath: row.coverPath?.trim() || null,
      playCount: row.playCount,
      likeCount: row.likeCount,
      status: row.status,
      isOwner: Boolean(isOwner),
      canDelete,
      canContinue: Boolean(isOwner) && continuation.canContinue,
      continuationReason: continuation.reason,
      remainingChapterCount: continuation.remainingChapterCount,
      charsRemaining: continuation.charsRemaining,
      hasPipelineMeta: Boolean(pipelineMeta),
      continueChapterPresets: NOVEL_CONTINUE_CHAPTER_PRESETS,
      continueDefaultMaxChapters: PRODUCT.novel.longSegmented.continueDefaultMaxChapters,
      polishDefault: PRODUCT.novel.longSegmented.polishAfterSegment,
      comics: row.comics,
    },
    ...(creativeBrief ? { creativeBrief, briefKind } : {}),
  });
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const ownerKey = await getOwnerKey();
  if (!ownerKey) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const row = await prisma.novel.findUnique({ where: { id } });
  if (!row || row.ownerKey !== ownerKey) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的 JSON" }, { status: 400 });
  }

  const payload = body as {
    ensureShareCode?: boolean;
    title?: string;
    content?: string;
    chapters?: Array<{ num?: number; title?: string; body?: string }>;
  };

  const data: { title?: string; content?: string; summary?: string; shareCode?: string } = {};

  if (payload.title !== undefined) {
    const v = validateNovelTitleInput(String(payload.title));
    if (!v.ok) {
      return NextResponse.json({ error: v.error }, { status: 400 });
    }
    data.title = v.value;
  }

  if (Array.isArray(payload.chapters) && payload.chapters.length > 0) {
    const normalized = payload.chapters.map((ch, i) => ({
      num: typeof ch.num === "number" && ch.num > 0 ? ch.num : i + 1,
      title: String(ch.title ?? "").trim() || `第${i + 1}章`,
      body: String(ch.body ?? "").trim(),
    }));
    if (normalized.some((ch) => !ch.body)) {
      return NextResponse.json({ error: "章节正文不能为空" }, { status: 400 });
    }
    const content = serializeNovelChapters(normalized);
    data.content = content;
    const titleForSummary = data.title ?? row.title;
    data.summary = buildNovelSynopsisHeuristic(content, row.prompt, titleForSummary);
  } else if (payload.content !== undefined) {
    const content = String(payload.content).trim();
    if (content.length < 10) {
      return NextResponse.json({ error: "正文过短" }, { status: 400 });
    }
    data.content = content;
    const titleForSummary = data.title ?? row.title;
    data.summary = buildNovelSynopsisHeuristic(content, row.prompt, titleForSummary);
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
    select: { title: true, content: true, summary: true, shareCode: true, coverPath: true },
  });

  return NextResponse.json({
    novel: {
      id,
      title: fresh?.title ?? row.title,
      content: fresh?.content ?? row.content,
      summary: fresh?.summary ?? row.summary,
      shareCode: fresh?.shareCode ?? shareCode,
      coverPath: fresh?.coverPath ?? row.coverPath,
    },
  });
}

export async function DELETE(req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const ownerKey = await getOwnerKey();
  if (!ownerKey && !isSuperAdmin(req)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const row = await prisma.novel.findUnique({ where: { id } });
  if (!row) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }
  if (!canDeleteOwnedResource(row.ownerKey, ownerKey, req)) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }

  await prisma.novel.delete({ where: { id } });
  void deleteNovelCoverFile(id);
  return NextResponse.json({ ok: true });
}
