import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOwnerKey } from "@/lib/owner";
import { isPrismaUniqueViolation } from "@/lib/prisma-errors";
import { newShareCode } from "@/lib/share-code";
import { displayComicTitle } from "@/lib/comic-display";
import { countPanelsWithImages, parseComicDocument } from "@/lib/comic-panel-render";
import { normalizeNovelTitle } from "@/lib/novel-display";
import { canDeleteOwnedResource, isSuperAdmin } from "@/lib/super-admin";
import { localizedJsonError } from "@/lib/api/localized-error";
import { resolveRequestLocaleSync } from "@/lib/i18n/request-locale";

type RouteContext = { params: Promise<{ id: string }> };

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
  const doc = parseComicDocument(row.imageUrls);
  const panelStats = countPanelsWithImages(doc);

  const uiLocale = resolveRequestLocaleSync(req);

  return NextResponse.json({
    comic: {
      id: row.id,
      title: row.title,
      displayTitle: displayComicTitle(row.title, row.novel.title, row.prompt, uiLocale),
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
        displayTitle: normalizeNovelTitle(row.novel.title, row.prompt, undefined, uiLocale),
      },
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

  await prisma.comic.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
