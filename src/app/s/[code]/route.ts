import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { recordShareEvent } from "@/lib/auth/referral";
import { getOwnerKeyFromCookies } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ code: string }> };

/** 短链跳转至标准页面（便于口头传播短 URL）。 */
export async function GET(request: NextRequest, ctx: Ctx) {
  const { code } = await ctx.params;
  const trimmed = code.trim();
  if (trimmed.length < 6) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const ownerKey = await getOwnerKeyFromCookies();

  // 优先查找游戏
  const project = await prisma.project.findUnique({
    where: { shareCode: trimmed },
    select: { id: true },
  });
  if (project) {
    await recordShareEvent({
      shareCode: trimmed,
      workType: "game",
      workId: project.id,
      channel: "link",
      visitorOwnerKey: ownerKey,
    });
    return NextResponse.redirect(new URL(`/play/${project.id}`, request.url), 302);
  }

  // 查找小说
  const novel = await prisma.novel.findUnique({
    where: { shareCode: trimmed },
    select: { id: true },
  });
  if (novel) {
    await recordShareEvent({
      shareCode: trimmed,
      workType: "novel",
      workId: novel.id,
      channel: "link",
      visitorOwnerKey: ownerKey,
    });
    return NextResponse.redirect(new URL(`/novel/${novel.id}`, request.url), 302);
  }

  // 查找漫画
  const comic = await prisma.comic.findUnique({
    where: { shareCode: trimmed },
    select: { id: true },
  });
  if (comic) {
    await recordShareEvent({
      shareCode: trimmed,
      workType: "comic",
      workId: comic.id,
      channel: "link",
      visitorOwnerKey: ownerKey,
    });
    return NextResponse.redirect(new URL(`/comic/${comic.id}`, request.url), 302);
  }

  return NextResponse.redirect(new URL("/", request.url));
}
