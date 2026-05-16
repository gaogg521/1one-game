"use server";

import { prisma } from "./prisma";
import { generateImage } from "./image-generation";

export interface CoverGenOptions {
  title: string;
  summary?: string;
  genre?: "fantasy" | "scifi" | "romance" | "mystery" | "general";
  type: "novel" | "comic";
}

function buildCoverPrompt(opts: CoverGenOptions): string {
  const { title, summary = "", genre = "general", type } = opts;

  const genreStyle: Record<string, string> = {
    fantasy: "fantasy art style, magical atmosphere, epic landscape, rich colors, detailed illustration",
    scifi: "futuristic sci-fi style, neon accents, sleek technology, cinematic lighting",
    romance: "soft romantic watercolor style, warm pastel tones, delicate flowers, dreamy atmosphere",
    mystery: "dark noir style, moody shadows, rain-slicked streets, suspenseful atmosphere",
    general: "modern book cover illustration style, clean composition, vibrant colors, professional design",
  };

  const typeHint =
    type === "comic"
      ? "manga/comic cover style, dynamic composition, bold lines, expressive characters"
      : "novel book cover style, elegant typography space, atmospheric, literary feel";

  const base = genreStyle[genre] ?? genreStyle.general;

  return `Create a stunning ${type === "comic" ? "manga/comic" : "book"} cover for "${title}". ${summary.slice(0, 200)}. ${base}. ${typeHint}. High quality, detailed, no text in image, central composition, suitable for a cover thumbnail.`;
}

/**
 * 生成封面图并返回 URL
 */
export async function generateCover(opts: CoverGenOptions): Promise<string | null> {
  try {
    const prompt = buildCoverPrompt(opts);
    const result = await generateImage(prompt, { size: "1024x1024", quality: "high" });
    return result?.url ?? null;
  } catch {
    return null;
  }
}

/**
 * 尝试为 Novel 生成封面并更新数据库
 */
export async function generateNovelCover(novelId: string, title: string, summary?: string): Promise<string | null> {
  const coverUrl = await generateCover({ title, summary: summary ?? "", type: "novel" });
  if (!coverUrl) return null;

  await prisma.novel.update({
    where: { id: novelId },
    data: { coverPath: coverUrl },
  });

  return coverUrl;
}

/**
 * 尝试为 Comic 生成封面并更新数据库
 */
export async function generateComicCover(comicId: string, title: string, summary?: string): Promise<string | null> {
  const coverUrl = await generateCover({ title, summary: summary ?? "", type: "comic", genre: "fantasy" });
  if (!coverUrl) return null;

  await prisma.comic.update({
    where: { id: comicId },
    data: { coverPath: coverUrl },
  });

  return coverUrl;
}
