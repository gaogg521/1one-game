import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  try {
    await prisma.novel.updateMany({
      where: { id },
      data: { likeCount: { increment: 1 } },
    });
  } catch {
    // Silently ignore.
  }
  return NextResponse.json({ ok: true });
}
