import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/** Anonymous read counter — no auth required. */
export async function POST(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  try {
    await prisma.novel.updateMany({
      where: { id },
      data: { playCount: { increment: 1 } },
    });
  } catch {
    // Silently ignore failures.
  }
  return NextResponse.json({ ok: true });
}
