import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  try {
    await prisma.project.update({
      where: { id },
      data: { likeCount: { increment: 1 } },
    });
  } catch {
    // silently ignore — fire-and-forget
  }
  return NextResponse.json({ ok: true });
}
