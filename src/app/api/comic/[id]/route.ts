import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOwnerKey } from "@/lib/owner";
import { isPrismaUniqueViolation } from "@/lib/prisma-errors";
import { newShareCode } from "@/lib/share-code";
import { displayComicTitle } from "@/lib/comic-display";
import { countPanelsWithImages, parseComicDocument } from "@/lib/comic-panel-render";
import { normalizeNovelTitle } from "@/lib/novel-display";
import { canDeleteOwnedResource, isSuperAdmin } from "@/lib/super-admin";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const ownerKey = await getOwnerKey();

  const row = await prisma.comic.findUnique({
    where: { id },
    include: { novel: { select: { id: true, title: true } } },
  });
  if (!row) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }

  const isOwner = ownerKey && row.ownerKey === ownerKey;
  const canDelete = canDeleteOwnedResource(row.ownerKey, ownerKey, _req);
  const doc = parseComicDocument(row.imageUrls);
  const panelStats = countPanelsWithImages(doc);

  return NextResponse.json({
    comic: {
      id: row.id,
      title: row.title,
      displayTitle: displayComicTitle(row.title, row.novel.title, row.prompt),
      prompt: row.prompt,
      imageUrls: row.imageUrls,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      shareCode: row.shareCode,
      likeCount: row.likeCount,
      status: row.status,
      isOwner: Boolean(isOwner),
      canDelete,
      panelsWithImage: panelStats.withImage,
      panelsTotal: panelStats.total,
      novel: {
        ...row.novel,
        displayTitle: normalizeNovelTitle(row.novel.title, row.prompt),
      },
    },
  });
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const ownerKey = await getOwnerKey();
  if (!ownerKey) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const row = await prisma.comic.findUnique({ where: { id } });
  if (!row || row.ownerKey !== ownerKey) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的 JSON" }, { status: 400 });
  }

  const ensureShareCode =
    typeof body === "object" &&
    body !== null &&
    "ensureShareCode" in body &&
    Boolean((body as { ensureShareCode?: unknown }).ensureShareCode);

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
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const row = await prisma.comic.findUnique({ where: { id } });
  if (!row) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }
  if (!canDeleteOwnedResource(row.ownerKey, ownerKey, req)) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }

  await prisma.comic.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
