import type { Novel } from "@prisma/client";
import {
  type NovelBible,
  type NovelChapterPlan,
  type NovelGenerationMeta,
} from "@/lib/novel-long-pipeline-types";
import { loadNovelGenerationMeta, persistNovelGenerationMeta } from "@/lib/novel-pipeline-meta-db";
import { mirrorNovelToCreatorCore, type NovelCoreMirror } from "@/lib/creator-core/novel-bridge";

export class NovelStoryPlanError extends Error {
  constructor(public readonly code: "unavailable" | "generating") {
    super(`novel_story_plan_${code}`);
  }
}

/**
 * Changes to story facts are a new revision, never an in-place rewrite of the
 * creator core. The legacy meta remains the temporary source for the current
 * novel generator until its reader fully consumes core artifacts.
 */
export async function reviseNovelStoryPlan(input: {
  novel: Pick<Novel, "id" | "ownerKey" | "title" | "prompt" | "content" | "summary" | "lengthTier">;
  bible: NovelBible;
  chapterPlan: NovelChapterPlan;
}): Promise<{ meta: NovelGenerationMeta; core: NovelCoreMirror }> {
  const previous = await loadNovelGenerationMeta(input.novel.id);
  if (!previous) throw new NovelStoryPlanError("unavailable");
  if (previous.generating) throw new NovelStoryPlanError("generating");

  const meta: NovelGenerationMeta = {
    ...previous,
    bible: input.bible,
    chapterPlan: input.chapterPlan,
  };
  await persistNovelGenerationMeta(input.novel.id, meta);
  const core = await mirrorNovelToCreatorCore({ novel: input.novel, meta, cause: "refine" });
  return { meta, core };
}
