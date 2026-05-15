import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/** Anonymous play counter — no auth required. Fire-and-forget from client. */
export async function POST(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  try {
    await prisma.project.updateMany({
      where: { id },
      data: { playCount: { increment: 1 } },
    });
  } catch {
    // Silently ignore failures so a broken counter never breaks the play page.
  }
  return NextResponse.json({ ok: true });
}
