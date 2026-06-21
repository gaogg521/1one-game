import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOwnerKey } from "@/lib/owner";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/** DELETE /api/comments/[id] — only the comment's ownerKey can delete */
export async function DELETE(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const ownerKey = await getOwnerKey();
  if (!ownerKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const row = await prisma.comment.findUnique({ where: { id }, select: { ownerKey: true } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.ownerKey !== ownerKey) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.comment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
