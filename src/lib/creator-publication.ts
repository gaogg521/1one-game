import type { WorkVisibility } from "@/lib/auth/work-visibility";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assessComicCreatorQuality, assessGameCreatorQuality, assessNovelCreatorQuality } from "@/lib/creator-quality";
import { parseGameSpec } from "@/lib/game-spec";
import { parseStoredCreativeBrief } from "@/lib/project-creative-brief-db";
import { parseNovelGenerationMeta } from "@/lib/novel-long-pipeline-types";
import type { CreatorQualityReport } from "@/lib/creator-workflow";

export type PublishableWorkType = "game" | "novel" | "comic";

export class CreatorPublicationError extends Error {
  constructor(public readonly code: "not_found" | "not_owner" | "not_ready" | "quality_blocked") {
    super(code);
    this.name = "CreatorPublicationError";
  }
}

/**
 * Keep the configured default visibility unless automated evidence says the
 * work is unfit for public discovery. "needs_polish" remains publishable:
 * it is a creator-facing improvement signal, not a calibrated rejection.
 */
export function visibilityWithQualityGuard(
  visibility: WorkVisibility | string,
  quality: CreatorQualityReport,
): WorkVisibility {
  const configured: WorkVisibility = visibility === "hidden" || visibility === "pending_review" || visibility === "public"
    ? visibility
    : "public";
  return configured === "public" && quality.verdict === "blocked"
    ? "pending_review"
    : configured;
}

/**
 * The only unified author-facing publish transition during the legacy/core
 * bridge. Publishing changes visibility, never mutates an immutable revision.
 */
export async function setCreatorWorkPublication(input: {
  type: PublishableWorkType;
  id: string;
  ownerKey: string;
  action: "publish" | "unpublish";
}): Promise<{ visibility: WorkVisibility; quality: CreatorQualityReport }> {
  if (input.type === "game") {
    const row = await prisma.project.findUnique({ where: { id: input.id } });
    if (!row) throw new CreatorPublicationError("not_found");
    if (row.ownerKey !== input.ownerKey) throw new CreatorPublicationError("not_owner");
    if (row.status !== "ready") throw new CreatorPublicationError("not_ready");
    const quality = assessGameCreatorQuality(
      parseGameSpec(JSON.parse(row.specJson)),
      parseStoredCreativeBrief(row.creativeBriefJson),
    ).report;
    return persistPublication({ input, quality, legacyType: "project", update: (tx, visibility) => tx.project.update({ where: { id: row.id }, data: { visibility } }) });
  }

  if (input.type === "novel") {
    const row = await prisma.novel.findUnique({ where: { id: input.id } });
    if (!row) throw new CreatorPublicationError("not_found");
    if (row.ownerKey !== input.ownerKey) throw new CreatorPublicationError("not_owner");
    if (row.status !== "ready") throw new CreatorPublicationError("not_ready");
    const quality = assessNovelCreatorQuality({
      content: row.content,
      prompt: row.prompt,
      lengthTier: row.lengthTier,
      generationMeta: parseNovelGenerationMeta(row.generationMetaJson),
    }).report;
    return persistPublication({ input, quality, legacyType: "novel", update: (tx, visibility) => tx.novel.update({ where: { id: row.id }, data: { visibility } }) });
  }

  const row = await prisma.comic.findUnique({ where: { id: input.id } });
  if (!row) throw new CreatorPublicationError("not_found");
  if (row.ownerKey !== input.ownerKey) throw new CreatorPublicationError("not_owner");
  if (row.status !== "ready") throw new CreatorPublicationError("not_ready");
  const quality = assessComicCreatorQuality(row.imageUrls).report;
  return persistPublication({ input, quality, legacyType: "comic", update: (tx, visibility) => tx.comic.update({ where: { id: row.id }, data: { visibility } }) });
}

async function persistPublication(input: {
  input: { type: PublishableWorkType; id: string; ownerKey: string; action: "publish" | "unpublish" };
  quality: CreatorQualityReport;
  legacyType: string;
  update: (tx: Prisma.TransactionClient, visibility: WorkVisibility) => Promise<unknown>;
}): Promise<{ visibility: WorkVisibility; quality: CreatorQualityReport }> {
  if (input.input.action === "publish" && input.quality.verdict === "blocked") {
    throw new CreatorPublicationError("quality_blocked");
  }
  const visibility: WorkVisibility = input.input.action === "publish" ? "public" : "hidden";
  await prisma.$transaction(async (tx) => {
    await input.update(tx, visibility);
    await tx.creativeProject.updateMany({
      where: { ownerKey: input.input.ownerKey, legacyType: input.legacyType, legacyId: input.input.id },
      data: { visibility, status: visibility === "public" ? "published" : "ready" },
    });
  });
  return { visibility, quality: input.quality };
}
