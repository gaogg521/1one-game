import fs from "node:fs/promises";
import path from "node:path";
import { deleteProjectCoverFile } from "@/lib/project-cover";

/** 删除漫画关联的本地静态资源（封面 + imageUrls 中的 /covers/ 路径） */
export async function deleteComicAssetFiles(comicId: string, imageUrlsJson?: string | null): Promise<void> {
  await deleteProjectCoverFile(comicId).catch(() => {});
  if (!imageUrlsJson?.trim()) return;
  try {
    const doc = JSON.parse(imageUrlsJson) as {
      panels?: { imageUrl?: string }[];
      pages?: { panels?: { imageUrl?: string }[] }[];
    };
    const urls: string[] = [];
    for (const p of doc.panels ?? []) {
      if (p.imageUrl) urls.push(p.imageUrl);
    }
    for (const page of doc.pages ?? []) {
      for (const p of page.panels ?? []) {
        if (p.imageUrl) urls.push(p.imageUrl);
      }
    }
    for (const url of urls) {
      if (!url.startsWith("/covers/") && !url.startsWith("/comic-panels/")) continue;
      const abs = path.join(process.cwd(), "public", url.replace(/^\//, ""));
      await fs.unlink(abs).catch(() => {});
    }
  } catch {
    /* ignore malformed json */
  }
}
