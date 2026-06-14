import { prisma } from "@/lib/prisma";

export async function persistComicPanelsDb(
  comicId: string,
  imageUrls: string,
  status: string,
): Promise<void> {
  try {
    await prisma.comic.update({
      where: { id: comicId },
      data: { imageUrls, status },
    });
  } catch {
    /* ignore */
  }
}
