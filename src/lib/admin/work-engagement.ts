import { prisma } from "@/lib/prisma";

/** 批量附加作品分享次数（ShareEvent 累计） */
export async function attachWorkShareCounts<
  T extends { type: string; id: string },
>(items: T[]): Promise<Array<T & { shareCount: number }>> {
  if (items.length === 0) return [];

  const byType = new Map<string, string[]>();
  for (const item of items) {
    const list = byType.get(item.type) ?? [];
    list.push(item.id);
    byType.set(item.type, list);
  }

  const orFilters = [...byType.entries()]
    .filter(([, ids]) => ids.length > 0)
    .map(([workType, workId]) => ({ workType, workId: { in: workId } }));

  const shareGroups =
    orFilters.length === 0
      ? []
      : await prisma.shareEvent.groupBy({
          by: ["workType", "workId"],
          where: { OR: orFilters },
          _count: { id: true },
        });

  const shareMap = new Map(
    shareGroups.map((g) => [`${g.workType}:${g.workId}`, g._count.id]),
  );

  return items.map((item) => ({
    ...item,
    shareCount: shareMap.get(`${item.type}:${item.id}`) ?? 0,
  }));
}
