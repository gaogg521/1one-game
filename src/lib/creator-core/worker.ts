import { ArtifactWritePayloadSchema, ComicPanelJobPayloadSchema } from "@/lib/creator-core/types";
import { createCreativeArtifact } from "@/lib/creator-core/repository";
import { mirrorComicToCreatorCore } from "@/lib/creator-core/comic-bridge";
import {
  claimGenerationJob,
  completeGenerationJob,
  failGenerationJob,
  heartbeatGenerationJob,
} from "@/lib/creator-core/jobs";
import { prisma } from "@/lib/prisma";
import {
  clearComicPanelImages,
  countPanelsWithImages,
  parseComicDocument,
  renderComicPanels,
  serializeComicPanels,
} from "@/lib/comic-panel-render";
import { resolveComicStoryContext } from "@/lib/comic-story-genre";

async function executeComicPanelJob(job: { id: string; payloadJson: string }, workerId: string) {
  const payload = ComicPanelJobPayloadSchema.parse(JSON.parse(job.payloadJson));
  const comic = await prisma.comic.findUnique({ where: { id: payload.comicId } });
  if (!comic || comic.ownerKey !== payload.ownerKey) throw new Error("comic_panel_owner_or_resource_missing");
  const doc = parseComicDocument(comic.imageUrls);
  if (!doc.pages.length) throw new Error("comic_panel_storyboard_missing");

  if (payload.regenerate) {
    const scope = payload.page ? { pageNumber: payload.page, ...(payload.panel ? { panelNumber: payload.panel } : {}) } : "all";
    clearComicPanelImages(doc, scope);
    await prisma.comic.update({ where: { id: comic.id }, data: { imageUrls: serializeComicPanels(doc) } });
  }
  const context = await resolveComicStoryContext(comic, payload.uiLocale as import("@/i18n/routing").AppLocale);
  const timer = setInterval(() => {
    void heartbeatGenerationJob(job.id, workerId, { percent: 5, stage: "rendering", detail: "waiting for image provider" });
  }, 25_000);
  try {
    const result = await renderComicPanels(doc, {
      onlyMissing: true,
      coverPath: comic.coverPath,
      storyGenre: context.genre,
      storyContext: { title: context.title, summary: context.summary },
      director: doc.director,
      characterSheetUrls: doc.characterSheetUrls,
      comicId: comic.id,
      uiLocale: payload.uiLocale as import("@/i18n/routing").AppLocale,
      onProgress: (event) => {
        if (event.type !== "panel_done") return;
        const percent = event.total > 0 ? 5 + (event.withImage / event.total) * 90 : 95;
        void prisma.comic.update({
          where: { id: comic.id },
          data: { imageUrls: event.imageUrls, status: event.withImage > 0 ? "ready" : comic.status },
        });
        void heartbeatGenerationJob(job.id, workerId, { percent, stage: "rendering", detail: `${event.withImage}/${event.total}` });
      },
    });
    const imageUrls = serializeComicPanels(result.doc);
    const stats = countPanelsWithImages(result.doc);
    const updated = await prisma.comic.update({
      where: { id: comic.id },
      data: { imageUrls, status: stats.withImage > 0 ? "ready" : comic.status },
    });
    await mirrorComicToCreatorCore({ comic: updated, cause: "refine" });
  } finally {
    clearInterval(timer);
  }
}

/**
 * Durable-job execution boundary. New job types are added here only after
 * their payload schema and idempotency behavior have an integration test.
 */
export async function processNextGenerationJob(workerId: string) {
  const job = await claimGenerationJob(workerId);
  if (!job) return null;
  try {
    if (job.type === "artifact_write") {
      const payload = ArtifactWritePayloadSchema.parse(JSON.parse(job.payloadJson));
      const artifact = await createCreativeArtifact({
        creativeProjectId: job.creativeProjectId,
        creativeRevisionId: job.creativeRevisionId ?? undefined,
        artifact: payload.artifact,
      });
      await completeGenerationJob(job.id, artifact.id);
      return { id: job.id, type: job.type, status: "completed" as const, outputArtifactId: artifact.id };
    }
    if (job.type === "comic_panel") {
      await executeComicPanelJob(job, workerId);
      await completeGenerationJob(job.id);
      return { id: job.id, type: job.type, status: "completed" as const };
    }
    throw new Error(`unsupported_generation_job:${job.type}`);
  } catch (error) {
    const failed = await failGenerationJob(job.id, error);
    return { id: job.id, type: job.type, status: failed.status as "retrying" | "failed" };
  }
}
