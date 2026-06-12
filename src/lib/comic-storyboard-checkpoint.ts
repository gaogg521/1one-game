import type { ComicChapterScope } from "@/lib/comic-chapter-scope";
import { chapterScopeEquals } from "@/lib/comic-chapter-adaptation";
import {
  parseComicImageUrls,
  serializeComicDocument,
  type ComicDocument,
  type ComicPage,
} from "@/lib/comic-format";
import type { ComicDirectorPack } from "@/lib/comic-director-types";
import type { ComicStylePresetId } from "@/lib/comic-style-presets";
import type { ComicReadMode } from "@/lib/comic-format";
import type { ComicLayoutId } from "@/lib/comic-layout";
import { defaultWorkVisibility } from "@/lib/auth/work-visibility";
import { prisma } from "@/lib/prisma";

export const COMIC_STATUS_DRAFT_STORYBOARD = "draft_storyboard";

export type StoryboardCheckpointMeta = {
  chunkIndex: number;
  chunkCount: number;
  phase: "storyboard";
};

export function buildPartialComicDoc(opts: {
  pages: ComicPage[];
  stylePreset: ComicStylePresetId;
  layoutId: ComicLayoutId;
  readMode: ComicReadMode;
  chapterScopeLabel?: string;
  chapterScope?: ComicChapterScope | null;
  director?: ComicDirectorPack | null;
  progress: StoryboardCheckpointMeta;
}): ComicDocument {
  return {
    formatVersion: opts.director ? 3 : 2,
    pageCount: opts.pages.length,
    pages: opts.pages,
    stylePreset: opts.stylePreset,
    layoutId: opts.layoutId,
    readMode: opts.readMode,
    chapterScopeLabel: opts.chapterScopeLabel,
    ...(opts.chapterScope ? { chapterScope: opts.chapterScope } : {}),
    ...(opts.director ? { director: opts.director, pipeline: "long_director" as const } : {}),
    generationProgress: opts.progress,
  };
}

export async function findDraftStoryboardComic(
  ownerKey: string,
  novelId: string,
  chapterScope: ComicChapterScope | null | undefined,
): Promise<{ id: string; doc: ComicDocument } | null> {
  const rows = await prisma.comic.findMany({
    where: { ownerKey, novelId, status: COMIC_STATUS_DRAFT_STORYBOARD },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: { id: true, imageUrls: true },
  });
  for (const row of rows) {
    const doc = parseComicImageUrls(row.imageUrls);
    const docScope = doc.chapterScope ?? null;
    if (!chapterScopeEquals(docScope, chapterScope ?? null)) continue;
    if (!doc.pages.length) continue;
    return { id: row.id, doc };
  }
  return null;
}

export async function upsertStoryboardDraftComic(opts: {
  comicId?: string;
  ownerKey: string;
  novelId: string;
  title: string;
  prompt: string;
  doc: ComicDocument;
}): Promise<string> {
  const imageUrls = serializeComicDocument(opts.doc);
  if (opts.comicId) {
    await prisma.comic.update({
      where: { id: opts.comicId },
      data: { imageUrls, status: COMIC_STATUS_DRAFT_STORYBOARD },
    });
    return opts.comicId;
  }
  const comic = await prisma.comic.create({
    data: {
      ownerKey: opts.ownerKey,
      novelId: opts.novelId,
      title: opts.title,
      prompt: opts.prompt.slice(0, 200),
      imageUrls,
      status: COMIC_STATUS_DRAFT_STORYBOARD,
      visibility: defaultWorkVisibility(),
    },
  });
  return comic.id;
}

export function resumeChunkIndexFromDoc(
  doc: ComicDocument,
  opts?: { chunkSize?: number; pageCount?: number },
): number {
  const chunkSize = Math.max(1, opts?.chunkSize ?? 4);
  const pageCount = opts?.pageCount ?? doc.pageCount ?? doc.pages.length;
  const chunkCount = Math.max(1, Math.ceil(pageCount / chunkSize));
  const prog = doc.generationProgress;
  if (prog?.phase === "storyboard" && prog.chunkIndex > 0) {
    const done = prog.chunkCount ?? chunkCount;
    if (prog.chunkIndex >= done) return chunkCount;
    return prog.chunkIndex;
  }
  if (doc.pages.length >= pageCount) return chunkCount;
  return Math.min(chunkCount, Math.floor(doc.pages.length / chunkSize));
}
