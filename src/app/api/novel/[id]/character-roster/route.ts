import { NextResponse } from "next/server";
import { getOwnerKey } from "@/lib/owner";
import { prisma } from "@/lib/prisma";
import {
  emptyComicCharacterRoster,
  parseComicCharacterRoster,
  type ComicCharacterRoster,
} from "@/lib/comic-character-roster";
import { loadNovelCharacterRoster, saveNovelCharacterRoster } from "@/lib/novel-character-roster-db";
import { localizedJsonError } from "@/lib/api/localized-error";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  const ownerKey = await getOwnerKey();
  if (!ownerKey) {
    return localizedJsonError(_req, "unauthorized", 401);
  }

  const { id } = await ctx.params;
  const row = await prisma.novel.findUnique({ where: { id }, select: { ownerKey: true } });
  if (!row || row.ownerKey !== ownerKey) {
    return localizedJsonError(_req, "notFound", 404);
  }

  const roster = (await loadNovelCharacterRoster(id)) ?? emptyComicCharacterRoster();
  return NextResponse.json({ roster });
}

export async function PUT(req: Request, ctx: RouteContext) {
  const ownerKey = await getOwnerKey();
  if (!ownerKey) {
    return localizedJsonError(req, "unauthorized", 401);
  }

  const { id } = await ctx.params;
  const row = await prisma.novel.findUnique({ where: { id }, select: { ownerKey: true } });
  if (!row || row.ownerKey !== ownerKey) {
    return localizedJsonError(req, "notFound", 404);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return localizedJsonError(req, "badJson", 400);
  }

  const payload = body as { roster?: unknown };
  let roster: ComicCharacterRoster | null = null;
  if (payload.roster != null) {
    roster = parseComicCharacterRoster(payload.roster);
    if (!roster) {
      return localizedJsonError(req, "badJson", 400);
    }
  }

  await saveNovelCharacterRoster(id, roster);
  return NextResponse.json({ ok: true, roster: roster ?? emptyComicCharacterRoster() });
}
