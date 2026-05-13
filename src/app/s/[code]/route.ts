import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ code: string }> };

/** 短链跳转至标准试玩页（便于口头传播短 URL）。 */
export async function GET(request: NextRequest, ctx: Ctx) {
  const { code } = await ctx.params;
  const trimmed = code.trim();
  if (trimmed.length < 6) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const row = await prisma.project.findUnique({
    where: { shareCode: trimmed },
    select: { id: true },
  });

  if (!row) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.redirect(new URL(`/play/${row.id}`, request.url), 302);
}
