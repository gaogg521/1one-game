import { NextResponse } from "next/server";
import { requireAdmin, writeAdminAudit } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";
import { localizedJsonError } from "@/lib/api/localized-error";

export async function GET(req: Request) {
  const gate = await requireAdmin(req);
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
    playCount?: number;
    likeCount?: number;
  }> = [];

  const visFilter = visibility && ["public", "hidden", "pending_review"].includes(visibility)
    ? { visibility }
    : undefined;

  if (type === "all" || type === "game") {
    const rows = await prisma.project.findMany({
      where: {
        ...visFilter,
        ...(q ? { OR: [{ title: { contains: q } }, { prompt: { contains: q } }] } : {}),
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
        playCount: true,
        likeCount: true,
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
        playCount: r.playCount,
        likeCount: r.likeCount,
      })),
    );
  }

  if (type === "all" || type === "novel") {
    const rows = await prisma.novel.findMany({
      where: {
        ...visFilter,
        ...(q ? { OR: [{ title: { contains: q } }, { prompt: { contains: q } }] } : {}),
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
        playCount: true,
        likeCount: true,
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
        playCount: r.playCount,
        likeCount: r.likeCount,
      })),
    );
  }

  if (type === "all" || type === "comic") {
    const rows = await prisma.comic.findMany({
      where: {
        ...visFilter,
        ...(q ? { OR: [{ title: { contains: q } }, { prompt: { contains: q } }] } : {}),
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
        likeCount: true,
      },
    });
    items.push(
      ...rows.map((r) => ({
        type: "comic",
        id: r.id,
        title: r.title,
        ownerKey: r.ownerKey,
        visibility: r.visibility,
        featured: r.featured,
        createdAt: r.createdAt.toISOString(),
        likeCount: r.likeCount,
      })),
    );
  }

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json({ items: items.slice(0, limit) });
}

type ModerateItem = { type: string; id: string };

const VALID_WORK_TYPES = new Set(["game", "novel", "comic"]);

async function moderateOne(
  item: ModerateItem,
  data: { visibility?: string; featured?: boolean },
): Promise<void> {
  if (item.type === "game") await prisma.project.update({ where: { id: item.id }, data });
  else if (item.type === "novel") await prisma.novel.update({ where: { id: item.id }, data });
  else if (item.type === "comic") await prisma.comic.update({ where: { id: item.id }, data });
  else throw new Error(`unknown_type:${item.type}`);
}

export async function PATCH(req: Request) {
  const gate = await requireAdmin(req);
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
    if (!VALID_WORK_TYPES.has(item.type)) {
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
