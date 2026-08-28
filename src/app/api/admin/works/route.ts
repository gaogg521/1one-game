import { NextResponse } from "next/server";
import { requireAdminCapability, writeAdminAudit } from "@/lib/auth/admin";
import { attachWorkShareCounts } from "@/lib/admin/work-engagement";
import { deleteAdminWork, isAdminWorkType } from "@/lib/admin/delete-work";
import { prisma } from "@/lib/prisma";
import { localizedJsonError } from "@/lib/api/localized-error";
import { persistSanitizedComicCoverFromSource } from "@/lib/cover-generation";
import { resolveComicCoverPath } from "@/lib/comic-display";
import { formatWorkGenerationLabel } from "@/lib/work-generation-meta";
import { adminWorkSearchWhere } from "@/lib/admin/work-search";

export async function GET(req: Request) {
  const gate = await requireAdminCapability(req, "content");
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "all";
  const visibility = searchParams.get("visibility");
  const q = searchParams.get("q")?.trim();
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "40", 10) || 40, 100);

  const items: Array<{
    type: string;
    id: string;
    title: string;
    ownerKey: string;
    visibility: string;
    featured: boolean;
    createdAt: string;
    shareCode: string | null;
    playCount?: number;
    likeCount: number;
    coverPath?: string | null;
    novelId?: string | null;
    novelTitle?: string | null;
    generationProvider?: string | null;
    generationModel?: string | null;
    generationLabel?: string;
  }> = [];

  const visFilter = visibility && ["public", "hidden", "pending_review"].includes(visibility)
    ? { visibility }
    : undefined;
  const searchWhere = adminWorkSearchWhere(q);

  if (type === "all" || type === "game") {
    const rows = await prisma.project.findMany({
      where: {
        ...visFilter,
        ...searchWhere,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        ownerKey: true,
        visibility: true,
        featured: true,
        createdAt: true,
        shareCode: true,
        playCount: true,
        likeCount: true,
        coverPath: true,
        generationProvider: true,
        generationModel: true,
      },
    });
    items.push(
      ...rows.map((r) => ({
        type: "game",
        id: r.id,
        title: r.title,
        ownerKey: r.ownerKey,
        visibility: r.visibility,
        featured: r.featured,
        createdAt: r.createdAt.toISOString(),
        shareCode: r.shareCode,
        playCount: r.playCount,
        likeCount: r.likeCount,
        coverPath: r.coverPath,
        generationProvider: r.generationProvider,
        generationModel: r.generationModel,
        generationLabel: formatWorkGenerationLabel(r.generationProvider, r.generationModel),
      })),
    );
  }

  if (type === "all" || type === "novel") {
    const rows = await prisma.novel.findMany({
      where: {
        ...visFilter,
        ...searchWhere,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        ownerKey: true,
        visibility: true,
        featured: true,
        createdAt: true,
        shareCode: true,
        playCount: true,
        likeCount: true,
        coverPath: true,
        generationProvider: true,
        generationModel: true,
      },
    });
    items.push(
      ...rows.map((r) => ({
        type: "novel",
        id: r.id,
        title: r.title,
        ownerKey: r.ownerKey,
        visibility: r.visibility,
        featured: r.featured,
        createdAt: r.createdAt.toISOString(),
        shareCode: r.shareCode,
        playCount: r.playCount,
        likeCount: r.likeCount,
        coverPath: r.coverPath,
        generationProvider: r.generationProvider,
        generationModel: r.generationModel,
        generationLabel: formatWorkGenerationLabel(r.generationProvider, r.generationModel),
      })),
    );
  }

  if (type === "all" || type === "comic") {
    const rows = await prisma.comic.findMany({
      where: {
        ...visFilter,
        ...searchWhere,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        ownerKey: true,
        visibility: true,
        featured: true,
        createdAt: true,
        shareCode: true,
        likeCount: true,
        novelId: true,
        coverPath: true,
        generationProvider: true,
        generationModel: true,
      },
    });
    const novelIds = [...new Set(rows.map((r) => r.novelId).filter((id): id is string => Boolean(id)))];
    const novelTitleMap = new Map<string, string>();
    if (novelIds.length > 0) {
      const novels = await prisma.novel.findMany({
        where: { id: { in: novelIds } },
        select: { id: true, title: true },
      });
      for (const n of novels) novelTitleMap.set(n.id, n.title);
    }
    items.push(
      ...rows.map((r) => ({
        type: "comic",
        id: r.id,
        title: r.title,
        ownerKey: r.ownerKey,
        visibility: r.visibility,
        featured: r.featured,
        createdAt: r.createdAt.toISOString(),
        shareCode: r.shareCode,
        likeCount: r.likeCount,
        novelId: r.novelId,
        novelTitle: r.novelId ? novelTitleMap.get(r.novelId) ?? null : null,
        coverPath: r.coverPath,
        generationProvider: r.generationProvider,
        generationModel: r.generationModel,
        generationLabel: formatWorkGenerationLabel(r.generationProvider, r.generationModel),
      })),
    );
  }

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const enriched = await attachWorkShareCounts(items.slice(0, limit));
  return NextResponse.json({ items: enriched });
}

type ModerateItem = { type: string; id: string };

async function moderateOne(
  item: ModerateItem,
  data: { visibility?: string; featured?: boolean },
): Promise<void> {
  if (item.type === "game") await prisma.project.update({ where: { id: item.id }, data });
  else if (item.type === "novel") await prisma.novel.update({ where: { id: item.id }, data });
  else if (item.type === "comic") {
    await prisma.comic.update({ where: { id: item.id }, data });
    if (data.featured === true) {
      const row = await prisma.comic.findUnique({
        where: { id: item.id },
        select: { coverPath: true, imageUrls: true },
      });
      const src = row ? resolveComicCoverPath(row.imageUrls, row.coverPath) : null;
      if (src) {
        await persistSanitizedComicCoverFromSource(item.id, src).catch((e) => {
          console.warn("[admin-works] sanitize featured comic cover failed", item.id, e);
        });
      }
    }
  } else throw new Error(`unknown_type:${item.type}`);
}

export async function PATCH(req: Request) {
  const gate = await requireAdminCapability(req, "content");
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = (await req.json()) as {
    type?: string;
    id?: string;
    batch?: ModerateItem[];
    visibility?: string;
    featured?: boolean;
  };

  const data: { visibility?: string; featured?: boolean } = {};
  if (body.visibility && ["public", "hidden", "pending_review"].includes(body.visibility)) {
    data.visibility = body.visibility;
  }
  if (typeof body.featured === "boolean") data.featured = body.featured;
  if (!Object.keys(data).length) return localizedJsonError(req, "adminNoValidFields", 400);

  const items: ModerateItem[] = Array.isArray(body.batch)
    ? body.batch.filter((b) => b?.type && b?.id)
    : body.type && body.id
      ? [{ type: body.type, id: body.id }]
      : [];
  if (!items.length) return localizedJsonError(req, "adminMissingTypeId", 400);

  for (const item of items) {
    if (!isAdminWorkType(item.type)) {
      return localizedJsonError(req, "adminUnknownWorkType", 400, { params: { type: item.type } });
    }
    await moderateOne(item, data);
    await writeAdminAudit({
      req,
      action: items.length > 1 ? "work_moderate_batch" : "work_moderate",
      targetType: item.type,
      targetId: item.id,
      detail: data,
      actorUserId: gate.user?.id,
      actorOwnerKey: gate.ownerKey,
    });
  }

  return NextResponse.json({ ok: true, count: items.length });
}

type DeleteBody = { action?: string; type?: string; id?: string; batch?: ModerateItem[] };

function parseWorkItems(body: DeleteBody): ModerateItem[] {
  return Array.isArray(body.batch)
    ? body.batch.filter((b) => b?.type && b?.id)
    : body.type && body.id
      ? [{ type: body.type, id: body.id }]
      : [];
}

async function deleteWorksFromBody(
  req: Request,
  body: DeleteBody,
  actor: { userId?: string; ownerKey?: string },
) {
  const items = parseWorkItems(body);
  if (!items.length) return localizedJsonError(req, "adminMissingTypeId", 400);

  let deleted = 0;
  const missing: ModerateItem[] = [];
  for (const item of items) {
    if (!isAdminWorkType(item.type)) {
      return localizedJsonError(req, "adminUnknownWorkType", 400, { params: { type: item.type } });
    }
    let ok = false;
    try {
      ok = await deleteAdminWork(item.type, item.id);
    } catch (e) {
      console.error("[admin-works] delete failed", item, e);
      return localizedJsonError(req, "adminDeleteFailed", 500, {
        params: { detail: e instanceof Error ? e.message : "error" },
      });
    }
    if (!ok) {
      missing.push(item);
      continue;
    }
    deleted += 1;
    await writeAdminAudit({
      req,
      action: items.length > 1 ? "work_delete_batch" : "work_delete",
      targetType: item.type,
      targetId: item.id,
      detail: { titleHidden: true },
      actorUserId: actor.userId,
      actorOwnerKey: actor.ownerKey,
    });
  }

  if (deleted === 0) return localizedJsonError(req, "notFound", 404);
  return NextResponse.json({ ok: true, deleted, missing: missing.length });
}

/** 部分网关会丢掉 DELETE body，删除走 POST { action: "delete" }。 */
export async function POST(req: Request) {
  const gate = await requireAdminCapability(req, "content");
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  let body: DeleteBody;
  try {
    body = (await req.json()) as DeleteBody;
  } catch {
    return localizedJsonError(req, "badJson", 400);
  }
  if (body.action !== "delete") {
    return localizedJsonError(req, "adminNoValidFields", 400);
  }
  return deleteWorksFromBody(req, body, { userId: gate.user?.id, ownerKey: gate.ownerKey });
}

export async function DELETE(req: Request) {
  const gate = await requireAdminCapability(req, "content");
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  let body: { type?: string; id?: string; batch?: ModerateItem[] };
  try {
    body = (await req.json()) as { type?: string; id?: string; batch?: ModerateItem[] };
  } catch {
    return localizedJsonError(req, "badJson", 400);
  }

  const items: ModerateItem[] = Array.isArray(body.batch)
    ? body.batch.filter((b) => b?.type && b?.id)
    : body.type && body.id
      ? [{ type: body.type, id: body.id }]
      : [];
  if (!items.length) return localizedJsonError(req, "adminMissingTypeId", 400);

  let deleted = 0;
  const missing: ModerateItem[] = [];
  for (const item of items) {
    if (!isAdminWorkType(item.type)) {
      return localizedJsonError(req, "adminUnknownWorkType", 400, { params: { type: item.type } });
    }
    let ok = false;
    try {
      ok = await deleteAdminWork(item.type, item.id);
    } catch (e) {
      console.error("[admin-works] delete failed", item, e);
      return localizedJsonError(req, "adminDeleteFailed", 500, {
        params: { detail: e instanceof Error ? e.message : "error" },
      });
    }
    if (!ok) {
      missing.push(item);
      continue;
    }
    deleted += 1;
    await writeAdminAudit({
      req,
      action: items.length > 1 ? "work_delete_batch" : "work_delete",
      targetType: item.type,
      targetId: item.id,
      detail: { titleDeleted: true },
      actorUserId: gate.user?.id,
      actorOwnerKey: gate.ownerKey,
    });
  }

  if (deleted === 0) return localizedJsonError(req, "notFound", 404);
  return NextResponse.json({ ok: true, deleted, missing: missing.length });
}
