import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveComicCoverPath } from "@/lib/comic-display";

const comicListSelect = {
  id: true,
  title: true,
  prompt: true,
  imageUrls: true,
  likeCount: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  shareCode: true,
  novel: { select: { title: true } },
} as const;

export type ComicListRow = {
  id: string;
  title: string;
  prompt: string;
  imageUrls: string;
  likeCount: number;
  createdAt: Date;
  updatedAt: Date;
  status: string;
  shareCode: string | null;
  novel: { title: string };
};

export type ComicListItem = Omit<ComicListRow, "imageUrls"> & {
  coverPath: string | null;
  /** 发现页等仍可按分镜解析；列表页可忽略 */
  imageUrls: string;
};

/** 绕过过期 Prisma Client 对 `Comic.coverPath` 的校验，从库中批量读取封面路径。 */
async function loadStoredComicCoverPaths(ids: string[]): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (ids.length === 0) return map;
  try {
    const rows = await prisma.$queryRaw<Array<{ id: string; coverPath: string | null }>>(
      Prisma.sql`SELECT id, "coverPath" FROM "Comic" WHERE id IN (${Prisma.join(ids)})`,
    );
    for (const row of rows) {
      map.set(row.id, row.coverPath);
    }
  } catch {
    // 旧库无 coverPath 列时忽略
  }
  return map;
}

export function toComicListItems(rows: ComicListRow[], storedCovers: Map<string, string | null>): ComicListItem[] {
  return rows.map((row) => ({
    ...row,
    coverPath: resolveComicCoverPath(row.imageUrls, storedCovers.get(row.id)),
  }));
}

export async function queryComicList(opts: {
  where: { ownerKey?: string };
  orderBy: { likeCount: "desc" } | { createdAt: "desc" };
  skip: number;
  take: number;
}): Promise<{ comics: ComicListItem[]; total: number }> {
  const [rows, total] = await Promise.all([
    prisma.comic.findMany({
      where: opts.where,
      orderBy: opts.orderBy,
      skip: opts.skip,
      take: opts.take,
      select: comicListSelect,
    }),
    prisma.comic.count({ where: opts.where }),
  ]);

  const storedCovers = await loadStoredComicCoverPaths(rows.map((r) => r.id));
  return { comics: toComicListItems(rows, storedCovers), total };
}
