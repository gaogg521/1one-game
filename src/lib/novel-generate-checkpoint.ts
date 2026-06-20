import { planLongNovelSegments, type LongNovelSegmentPlan } from "@/lib/novel-long-config";
import {
  type NovelBible,
  type NovelChapterPlan,
  type NovelGenerateCheckpointMeta,
  type NovelGenerationMeta,
  serializeNovelGenerationMeta,
} from "@/lib/novel-long-pipeline-types";
import { persistNovelGenerationMeta, loadNovelGenerationMeta } from "@/lib/novel-pipeline-meta-db";
import type { NovelLengthTier } from "@/lib/novel-length";
import { prisma } from "@/lib/prisma";

export const NOVEL_STATUS_DRAFT_GENERATING = "draft_generating";

export type NovelGenerationResumeState = {
  bible: NovelBible;
  chapterPlan: NovelChapterPlan;
  checkpoint: NovelGenerateCheckpointMeta;
};

export function buildCheckpointMeta(
  base: Omit<NovelGenerationMeta, "generating">,
  checkpoint: NovelGenerateCheckpointMeta,
): NovelGenerationMeta {
  return { ...base, generating: checkpoint };
}

export async function createDraftGeneratingNovel(opts: {
  ownerKey: string;
  title: string;
  prompt: string;
}): Promise<{ id: string }> {
  const row = await prisma.novel.create({
    data: {
      ownerKey: opts.ownerKey,
      title: opts.title.trim() || "生成中…",
      prompt: opts.prompt,
      content: "",
      status: NOVEL_STATUS_DRAFT_GENERATING,
      visibility: "hidden",
    },
  });
  return { id: row.id };
}

export async function updateDraftNovelContent(novelId: string, content: string): Promise<void> {
  await prisma.novel.update({
    where: { id: novelId },
    data: { content, updatedAt: new Date() },
  });
}

export async function saveNovelGenerateCheckpoint(
  novelId: string,
  meta: NovelGenerationMeta,
  checkpoint: NovelGenerateCheckpointMeta,
): Promise<void> {
  const merged = buildCheckpointMeta(
    {
      version: meta.version,
      bible: meta.bible,
      chapterPlan: meta.chapterPlan,
      segmentCount: meta.segmentCount,
      createdAt: meta.createdAt,
    },
    { ...checkpoint, updatedAt: new Date().toISOString() },
  );
  await persistNovelGenerationMeta(novelId, merged);
}

/** 原子化：同时保存正文进度和 checkpoint，避免两次写入之间断连导致不一致。 */
export async function saveNovelCheckpointAndContent(
  novelId: string,
  content: string,
  meta: NovelGenerationMeta,
  checkpoint: NovelGenerateCheckpointMeta,
): Promise<void> {
  const merged = buildCheckpointMeta(
    {
      version: meta.version,
      bible: meta.bible,
      chapterPlan: meta.chapterPlan,
      segmentCount: meta.segmentCount,
      createdAt: meta.createdAt,
    },
    { ...checkpoint, updatedAt: new Date().toISOString() },
  );
  const json = serializeNovelGenerationMeta(merged);
  await prisma.novel.update({
    where: { id: novelId },
    data: { content, updatedAt: new Date(), generationMetaJson: json },
  });
}

export async function loadNovelGenerationResumeState(
  novelId: string,
): Promise<NovelGenerationResumeState | null> {
  const row = await prisma.novel.findUnique({
    where: { id: novelId },
    select: { content: true, prompt: true, title: true, lengthTier: true },
  });
  const meta = await loadNovelGenerationMeta(novelId);
  if (!meta?.bible || !meta.chapterPlan) return null;
  if (meta.generating) {
    return {
      bible: meta.bible,
      chapterPlan: meta.chapterPlan,
      checkpoint: meta.generating,
    };
  }
  const lengthTier = (row?.lengthTier as NovelLengthTier) || "long";
  return {
    bible: meta.bible,
    chapterPlan: meta.chapterPlan,
    checkpoint: {
      completedSegmentIndex: -1,
      partialContent: row?.content?.trim() ?? "",
      prompt: row?.prompt ?? "",
      title: row?.title ?? undefined,
      lengthTier,
      polish: true,
      plan: planLongNovelSegments(lengthTier),
      updatedAt: new Date().toISOString(),
    },
  };
}

export async function finalizeDraftNovel(
  novelId: string,
  data: {
    title: string;
    content: string;
    summary: string | null;
    pipelineMeta: NovelGenerationMeta;
  },
): Promise<void> {
  await prisma.novel.update({
    where: { id: novelId },
    data: {
      title: data.title,
      content: data.content,
      summary: data.summary,
      status: "ready",
    },
  });
  const { generating: _g, ...cleanMeta } = data.pipelineMeta;
  await persistNovelGenerationMeta(novelId, cleanMeta);
}

