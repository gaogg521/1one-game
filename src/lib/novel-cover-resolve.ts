import { composeAndPersistNovelCoverFromBackground } from "@/lib/cover-generation";
import { comicCoverFromImageUrls } from "@/lib/comic-display";
import { prisma } from "@/lib/prisma";

export type NovelCoverFallbackInput = {
  id: string;
  title: string;
  summary?: string | null;
  prompt?: string | null;
};

/**
 * 无小说封面时：取最新漫画首格作底图，**叠加书名** 后落盘并返回 coverPath。
 */
export async function resolveNovelCoverFallbacks(
  novels: NovelCoverFallbackInput[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (novels.length === 0) return out;

  const ids = novels.map((n) => n.id);
  const meta = new Map(novels.map((n) => [n.id, n]));

  const comics = await prisma.comic.findMany({
    where: { novelId: { in: ids } },
    orderBy: { updatedAt: "desc" },
    select: { novelId: true, imageUrls: true },
  });

  for (const c of comics) {
    if (out.has(c.novelId)) continue;
    const panelUrl = comicCoverFromImageUrls(c.imageUrls);
    if (!panelUrl) continue;

    const novel = meta.get(c.novelId);
    if (!novel) continue;

    const coverPath = await composeAndPersistNovelCoverFromBackground(
      c.novelId,
      novel.title,
      panelUrl,
      novel.summary ?? undefined,
      novel.prompt ?? undefined,
    );
    if (coverPath) out.set(c.novelId, coverPath);
  }

  return out;
}
