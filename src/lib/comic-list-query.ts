import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveComicCoverPath } from "@/lib/comic-display";

type PrismaComicOrderBy = Prisma.ComicOrderByWithRelationInput | Prisma.ComicOrderByWithRelationInput[];

const comicListSelect = {
  id: true,
  ownerKey: true,
  title: true,
  prompt: true,
  imageUrls: true,
  coverPath: true,
  likeCount: true,
  featured: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  shareCode: true,
  novel: { select: { id: true, title: true } },
} as const;

export type ComicListRow = {
  id: string;
  ownerKey: string;
  title: string;
  prompt: string;
  imageUrls: string;
  coverPath: string | null;
  likeCount: number;
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
  status: string;
  shareCode: string | null;
  novel: { id: string; title: string } | null;
};

export type ComicListItem = Omit<ComicListRow, "imageUrls"> & {
  coverPath: string | null;
  featured: boolean;
  /** 发现页等仍可按分镜解析；列表页可忽略 */
  imageUrls: string;
};

export type ComicListWhere =
  | { ownerKey: string }
  | { visibility: "public"; featured?: boolean };

export type ComicListOrderBy = PrismaComicOrderBy;

export function toComicListItems(rows: ComicListRow[]): ComicListItem[] {
  return rows.map((row) => ({
    ...row,
    featured: row.featured ?? false,
    coverPath: resolveComicCoverPath(row.imageUrls, row.coverPath),
  }));
}

export async function queryComicList(opts: {
  where: ComicListWhere;
  orderBy: ComicListOrderBy;
  skip: number;
  take: number;
}): Promise<{ comics: ComicListItem[]; total: number }> {
  const orderBy: PrismaComicOrderBy = Array.isArray(opts.orderBy) ? [...opts.orderBy] : opts.orderBy;

  const [rows, total] = await Promise.all([
    prisma.comic.findMany({
      where: opts.where,
      orderBy,
      skip: opts.skip,
      take: opts.take,
      select: comicListSelect,
    }),
    prisma.comic.count({ where: opts.where }),
  ]);

  return { comics: toComicListItems(rows), total };
}
