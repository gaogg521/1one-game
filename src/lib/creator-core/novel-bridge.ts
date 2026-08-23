import type { Novel } from "@prisma/client";
import { parseNovelChapters } from "@/lib/novel-chapters";
import type { NovelGenerationMeta } from "@/lib/novel-long-pipeline-types";
import { assessNovelCreatorQuality } from "@/lib/creator-quality";
import {
  createCreativeArtifact,
  createCreativeRevision,
  ensureLegacyCreativeProject,
  finalizeCreativeRevision,
  recordCreativeEvaluation,
} from "@/lib/creator-core/repository";

export type NovelCoreMirror = { creativeProjectId: string; creativeRevisionId: string };

/**
 * Writes a complete immutable representation of a legacy Novel into the new
 * core. It intentionally never mutates the legacy row: rollout is dual-write
 * until the reader/editor can consume core artifacts directly.
 */
export async function mirrorNovelToCreatorCore(input: {
  novel: Pick<Novel, "id" | "ownerKey" | "title" | "prompt" | "content" | "summary" | "lengthTier">;
  meta?: NovelGenerationMeta | null;
  cause?: "generate" | "refine" | "import";
}): Promise<NovelCoreMirror> {
  const project = await ensureLegacyCreativeProject({
    ownerKey: input.novel.ownerKey,
    kind: "novel",
    title: input.novel.title,
    legacyType: "novel",
    legacyId: input.novel.id,
  });
  const revision = await createCreativeRevision(project.id, {
    cause: input.cause ?? "generate",
    intent: {
      prompt: input.novel.prompt,
      title: input.novel.title,
      lengthTier: input.novel.lengthTier,
      legacyNovelId: input.novel.id,
    },
    summary: input.novel.summary ?? undefined,
  });
  const revisionInput = { creativeProjectId: project.id, creativeRevisionId: revision.id };
  const quality = assessNovelCreatorQuality({
    content: input.novel.content,
    prompt: input.novel.prompt,
    lengthTier: input.novel.lengthTier,
    generationMeta: input.meta ?? null,
  }).report;

  await createCreativeArtifact({
    ...revisionInput,
    artifact: {
      kind: "manuscript",
      mediaType: "text",
      textContent: input.novel.content,
      metadata: { title: input.novel.title, summary: input.novel.summary, lengthTier: input.novel.lengthTier },
    },
  });
  if (input.meta?.bible) {
    await createCreativeArtifact({
      ...revisionInput,
      artifact: { kind: "story_bible", mediaType: "json", content: input.meta.bible },
    });
  }
  if (input.meta?.chapterPlan) {
    await createCreativeArtifact({
      ...revisionInput,
      artifact: { kind: "outline", mediaType: "json", content: input.meta.chapterPlan },
    });
  }
  const chapters = parseNovelChapters(input.novel.content);
  for (const chapter of chapters) {
    await createCreativeArtifact({
      ...revisionInput,
      artifact: {
        kind: "scene",
        mediaType: "text",
        textContent: chapter.body,
        metadata: { chapter: chapter.num, title: chapter.title, source: "legacy_novel" },
      },
    });
  }
  await recordCreativeEvaluation({
    creativeProjectId: project.id,
    creativeRevisionId: revision.id,
    report: quality,
  });
  await finalizeCreativeRevision(revision.id, input.novel.summary ?? undefined);
  return { creativeProjectId: project.id, creativeRevisionId: revision.id };
}
