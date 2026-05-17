import { NextResponse } from "next/server";
import { copyProjectCoverFile } from "@/lib/project-cover";
import { copyPublicCoverRel, duplicateTitle } from "@/lib/cover-file-copy";
import { persistNovelCoverPath } from "@/lib/cover-path-db";
import { persistNovelLengthTier } from "@/lib/novel-length-tier-db";
import { parseNovelLengthTier, type NovelLengthTier } from "@/lib/novel-length";
import { getOwnerKey } from "@/lib/owner";
import { isPrismaUniqueViolation } from "@/lib/prisma-errors";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getThrottleKey } from "@/lib/request-key";
import { newShareCode } from "@/lib/share-code";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: RouteContext) {
  const ownerKey = await getOwnerKey();
  if (!ownerKey) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const key = await getThrottleKey("dup", ownerKey);
  if (!rateLimit(key, 20, 60_000)) {
    return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
  }

  const { id } = await ctx.params;
  const source = await prisma.novel.findUnique({ where: { id } });
  if (!source || source.ownerKey !== ownerKey) {
    return NextResponse.json({ error: "未找到源作品" }, { status: 404 });
  }

  let lengthTier: NovelLengthTier = "medium";
  try {
    const rows = await prisma.$queryRaw<Array<{ lengthTier: string | null }>>`
      SELECT "lengthTier" FROM "Novel" WHERE "id" = ${id} LIMIT 1`;
    if (rows[0]?.lengthTier) lengthTier = parseNovelLengthTier(rows[0].lengthTier);
  } catch {
    /* 列不存在时忽略 */
  }

  const title = duplicateTitle(source.title, 80);
  let clone: { id: string; title: string; shareCode: string | null } | undefined;
  for (let attempt = 0; attempt < 14; attempt += 1) {
    try {
      clone = await prisma.novel.create({
        data: {
          ownerKey,
          title,
          prompt: source.prompt,
          content: source.content,
          summary: source.summary,
          status: source.status,
          shareCode: newShareCode(),
        },
      });
      break;
    } catch (e) {
      if (!isPrismaUniqueViolation(e)) throw e;
    }
  }
  if (!clone) {
    return NextResponse.json({ error: "无法分配短链，请重试" }, { status: 500 });
  }

  await persistNovelLengthTier(clone.id, lengthTier);

  let coverPath: string | null = null;
  const byId = await copyProjectCoverFile(source.id, clone.id);
  if (byId) {
    coverPath = byId;
  } else if (source.coverPath?.startsWith("/covers/")) {
    const destRel = `/covers/novel-dup-${clone.id}-${Date.now()}.jpg`;
    if (await copyPublicCoverRel(source.coverPath, destRel)) coverPath = destRel;
  }
  if (coverPath) await persistNovelCoverPath(clone.id, coverPath);

  return NextResponse.json({
    novel: { id: clone.id, title: clone.title, shareCode: clone.shareCode, coverPath },
  });
}
