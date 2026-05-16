import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOwnerKey } from "@/lib/owner";

const VALID_SORTS = new Set(["playCount", "likeCount", "createdAt"]);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sortParam = searchParams.get("sort") ?? "createdAt";
  const sort = VALID_SORTS.has(sortParam) ? sortParam : "createdAt";
  const limitRaw = parseInt(searchParams.get("limit") ?? "24", 10);
  const limit = Math.min(Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 24), 96);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const skip = (page - 1) * limit;
  const mine = searchParams.get("mine") === "1";
  const ownerKey = mine ? await getOwnerKey() : null;

  if (mine && !ownerKey) {
    return NextResponse.json({ novels: [], total: 0, page, limit });
  }

  const where = mine && ownerKey ? { ownerKey } : {};

  const orderBy =
    sort === "likeCount"
      ? { likeCount: "desc" as const }
      : sort === "createdAt"
        ? { createdAt: "desc" as const }
        : { playCount: "desc" as const };

  const [novels, total] = await Promise.all([
    prisma.novel.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      select: {
        id: true,
        title: true,
        summary: true,
        prompt: true,
        coverPath: true,
        playCount: true,
        likeCount: true,
        createdAt: true,
        updatedAt: true,
        status: true,
        shareCode: true,
      },
    }),
    prisma.novel.count({ where }),
  ]);

  return NextResponse.json({ novels, total, page, limit });
}
