import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  try {
    // Raw SQL because likeCount was added after last prisma generate (binary locked by dev server)
    await prisma.$executeRaw`UPDATE "Project" SET "likeCount" = "likeCount" + 1 WHERE "id" = ${id}`;
  } catch {
    // silently ignore — fire-and-forget
  }
  return NextResponse.json({ ok: true });
}
