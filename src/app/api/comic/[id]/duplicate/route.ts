import { NextResponse } from "next/server";
import { defaultWorkVisibility } from "@/lib/auth/work-visibility";
import { copyPublicCoverRel, duplicateTitle } from "@/lib/cover-file-copy";
import { persistComicCoverPath } from "@/lib/cover-path-db";
import { getOwnerKey } from "@/lib/owner";
import { isPrismaUniqueViolation } from "@/lib/prisma-errors";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getThrottleKey } from "@/lib/request-key";
import { newShareCode } from "@/lib/share-code";
import { localizedJsonError } from "@/lib/api/localized-error";
import { resolveRequestLocaleSync } from "@/lib/i18n/request-locale";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: RouteContext) {
  const ownerKey = await getOwnerKey();
  if (!ownerKey) {
    return localizedJsonError(req, "unauthorized", 401);
  }

  const key = await getThrottleKey("dup", ownerKey);
  if (!rateLimit(key, 20, 60_000)) {
    return localizedJsonError(req, "rateLimitedRetry", 429);
  }

  const { id } = await ctx.params;
  const source = await prisma.comic.findUnique({ where: { id } });
  if (!source || source.ownerKey !== ownerKey) {
    return localizedJsonError(req, "sourceNotFound", 404);
  }

  const title = duplicateTitle(source.title, resolveRequestLocaleSync(req), 80);
  let clone: { id: string; title: string; shareCode: string | null } | undefined;
  for (let attempt = 0; attempt < 14; attempt += 1) {
    try {
      clone = await prisma.comic.create({
        data: {
          ownerKey,
          novelId: source.novelId,
          title,
          prompt: source.prompt,
          imageUrls: source.imageUrls,
          status: source.status,
          visibility: defaultWorkVisibility(),
          shareCode: newShareCode(),
        },
      });
      break;
    } catch (e) {
      if (!isPrismaUniqueViolation(e)) throw e;
    }
  }
  if (!clone) {
    return localizedJsonError(req, "shareCodeFailed", 500);
  }

  if (source.coverPath?.startsWith("/covers/")) {
    const destRel = `/covers/comic-dup-${clone.id}-${Date.now()}.jpg`;
    if (await copyPublicCoverRel(source.coverPath, destRel)) {
      await persistComicCoverPath(clone.id, destRel);
    }
  }

  return NextResponse.json({
    comic: { id: clone.id, title: clone.title, shareCode: clone.shareCode },
  });
}
