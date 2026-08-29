import type { WorkVisibility } from "@/lib/auth/work-visibility";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assessComicCreatorQuality, assessGameCreatorQuality, assessNovelCreatorQuality } from "@/lib/creator-quality";
import { parseGameSpec } from "@/lib/game-spec";
import { parseStoredCreativeBrief } from "@/lib/project-creative-brief-db";
import { assessGameAssetReadiness } from "@/lib/game-asset-readiness";
import { parseNovelGenerationMeta } from "@/lib/novel-long-pipeline-types";
import type { CreatorQualityReport } from "@/lib/creator-workflow";

export type PublishableWorkType = "game" | "novel" | "comic";

export class CreatorPublicationError extends Error {
  constructor(public readonly code: "not_found" | "not_owner" | "not_ready" | "quality_blocked" | "revision_not_ready") {
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
 * bridge. Publishing changes visibility and records the author's selected
 * immutable revision; it never overwrites the revision itself.
 */
export async function setCreatorWorkPublication(input: {
  type: PublishableWorkType;
  id: string;
  ownerKey: string;
  action: "publish" | "unpublish";
  revisionId?: string;
}): Promise<{ visibility: WorkVisibility; quality: CreatorQualityReport }> {
  if (input.type === "game") {
    const row = await prisma.project.findUnique({ where: { id: input.id } });
    if (!row) throw new CreatorPublicationError("not_found");
    if (row.ownerKey !== input.ownerKey) throw new CreatorPublicationError("not_owner");
    if (row.status !== "ready") throw new CreatorPublicationError("not_ready");
    const core = await prisma.creativeProject.findUnique({
      where: { legacyType_legacyId: { legacyType: "project", legacyId: row.id } },
      select: { id: true, revisions: { where: { status: "ready" }, orderBy: { sequence: "desc" }, take: 1, select: { id: true } } },
    });
    const candidateRevisionId = input.revisionId ?? core?.revisions[0]?.id;
    const artifacts = core && candidateRevisionId
      ? await prisma.creativeArtifact.findMany({
          where: {
            creativeProjectId: core.id,
            creativeRevisionId: candidateRevisionId,
            kind: { in: ["game_spec", "asset_manifest", "game_production_pipeline", "game_production_candidate", "game_delivery_preflight", "game_playtest_delivery", "bgm", "bgm_notes"] },
            status: "ready",
          },
          orderBy: { createdAt: "asc" },
          select: { kind: true, contentJson: true, storageUri: true },
        })
      : [];
    const artifact = (kind: string) => artifacts.find((entry) => entry.kind === kind);
    const asset = artifact("asset_manifest") ?? null;
    let assetContent: unknown = null;
    try { assetContent = asset?.contentJson ? JSON.parse(asset.contentJson) : null; } catch { /* corrupted artifact fails closed */ }
    let candidateSpec: unknown = null;
    try { candidateSpec = artifact("game_spec")?.contentJson ? JSON.parse(artifact("game_spec")!.contentJson!) : null; } catch { /* corrupted artifact fails closed */ }
    const baseQuality = assessGameCreatorQuality(
      parseGameSpec(candidateSpec ?? JSON.parse(row.specJson)),
      parseStoredCreativeBrief(row.creativeBriefJson),
      assessGameAssetReadiness(assetContent),
    ).report;
    const deliveryIssues: string[] = [];
    let preflight: { verdict?: unknown } | null = null;
    try { preflight = artifact("game_delivery_preflight")?.contentJson ? JSON.parse(artifact("game_delivery_preflight")!.contentJson!) : null; } catch { /* corrupted artifact fails closed */ }
    let pipeline: { preflightVerdict?: unknown } | null = null;
    try { pipeline = artifact("game_production_pipeline")?.contentJson ? JSON.parse(artifact("game_production_pipeline")!.contentJson!) : null; } catch { /* corrupted artifact fails closed */ }
    let productionCandidate: { decision?: unknown } | null = null;
    try { productionCandidate = artifact("game_production_candidate")?.contentJson ? JSON.parse(artifact("game_production_candidate")!.contentJson!) : null; } catch { /* corrupted artifact fails closed */ }
    let playtest: { activeMs?: unknown; actionCount?: unknown; deviceClass?: unknown; touchCapable?: unknown; outcome?: unknown } | null = null;
    try { playtest = artifact("game_playtest_delivery")?.contentJson ? JSON.parse(artifact("game_playtest_delivery")!.contentJson!) : null; } catch { /* corrupted artifact fails closed */ }
    if (!candidateRevisionId) deliveryIssues.push("publication_revision_missing");
    if (!artifact("game_spec")) deliveryIssues.push("publication_game_spec_missing");
    if (pipeline?.preflightVerdict !== "ready") deliveryIssues.push("publication_production_pipeline_not_ready");
    if (productionCandidate?.decision !== "ready_for_playtest") deliveryIssues.push("publication_production_candidate_not_ready");
    if (!preflight || (preflight.verdict !== "ready" && preflight.verdict !== "needs_review")) {
      deliveryIssues.push("publication_delivery_preflight_not_ready");
    }
    if (
      playtest?.deviceClass !== "mobile" ||
      playtest.touchCapable !== true ||
      typeof playtest.activeMs !== "number" || playtest.activeMs < 60_000 ||
      typeof playtest.actionCount !== "number" || playtest.actionCount < 3 ||
      (playtest.outcome !== "won" && playtest.outcome !== "lost")
    ) deliveryIssues.push("publication_mobile_playtest_delivery_missing");
    if (!artifact("bgm")?.storageUri && !artifact("bgm_notes")?.contentJson) deliveryIssues.push("publication_bgm_missing");
    const quality: CreatorQualityReport = deliveryIssues.length > 0
      ? { ...baseQuality, verdict: "blocked", evidence: [...baseQuality.evidence, ...deliveryIssues] }
      : baseQuality;
    return persistPublication({
      input,
      selectedRevisionId: candidateRevisionId,
      quality,
      legacyType: "project",
      publicationDisplay: { title: row.title, prompt: row.prompt, coverPath: row.coverPath },
      update: (tx, visibility) => tx.project.update({ where: { id: row.id }, data: { visibility } }),
    });
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
    return persistPublication({
      input,
      quality,
      legacyType: "novel",
      publicationDisplay: {
        title: row.title,
        prompt: row.prompt,
        summary: row.summary,
        lengthTier: row.lengthTier,
        coverPath: row.coverPath,
      },
      update: (tx, visibility) => tx.novel.update({ where: { id: row.id }, data: { visibility } }),
    });
  }

  const row = await prisma.comic.findUnique({ where: { id: input.id }, include: { novel: { select: { title: true, content: true } } } });
  if (!row) throw new CreatorPublicationError("not_found");
  if (row.ownerKey !== input.ownerKey) throw new CreatorPublicationError("not_owner");
  if (row.status !== "ready") throw new CreatorPublicationError("not_ready");
  const quality = assessComicCreatorQuality(row.imageUrls, { sourceContent: row.novel?.content }).report;
  return persistPublication({
    input,
    quality,
    legacyType: "comic",
    publicationDisplay: {
      title: row.title,
      prompt: row.prompt,
      coverPath: row.coverPath,
      novelTitle: row.novel?.title ?? null,
    },
    update: (tx, visibility) => tx.comic.update({ where: { id: row.id }, data: { visibility } }),
  });
}

async function persistPublication(input: {
  input: { type: PublishableWorkType; id: string; ownerKey: string; action: "publish" | "unpublish"; revisionId?: string };
  quality: CreatorQualityReport;
  legacyType: string;
  publicationDisplay: Record<string, string | null>;
  update: (tx: Prisma.TransactionClient, visibility: WorkVisibility) => Promise<unknown>;
  selectedRevisionId?: string;
}): Promise<{ visibility: WorkVisibility; quality: CreatorQualityReport }> {
  if (input.input.action === "publish" && input.quality.verdict === "blocked") {
    throw new CreatorPublicationError("quality_blocked");
  }
  const visibility: WorkVisibility = input.input.action === "publish" ? "public" : "hidden";
  await prisma.$transaction(async (tx) => {
    await input.update(tx, visibility);
    const core = await tx.creativeProject.findFirst({
      where: { ownerKey: input.input.ownerKey, legacyType: input.legacyType, legacyId: input.input.id },
      select: { id: true, acceptedRevisionId: true },
    });
    if (!core) return;
    let revisionId = input.input.action === "unpublish"
      ? core.acceptedRevisionId
      : input.selectedRevisionId ?? (await tx.creativeRevision.findFirst({
        where: { creativeProjectId: core.id, status: "ready" },
        orderBy: { sequence: "desc" },
        select: { id: true },
      }))?.id;
    let displayJson = JSON.stringify(input.publicationDisplay);
    let writeDisplaySnapshot = input.input.action === "publish";
    if (input.input.action === "publish" && input.input.revisionId) {
      const requested = await tx.creativeRevision.findFirst({
        where: { id: input.input.revisionId, creativeProjectId: core.id, status: "ready" },
        select: { id: true },
      });
      if (!requested) throw new CreatorPublicationError("revision_not_ready");
      const latest = await tx.creativeRevision.findFirst({
        where: { creativeProjectId: core.id, status: "ready" },
        orderBy: { sequence: "desc" },
        select: { id: true },
      });
      const display = await tx.creativeArtifact.findFirst({
        where: { creativeProjectId: core.id, creativeRevisionId: requested.id, kind: "publication_display", status: "ready" },
        orderBy: { createdAt: "asc" },
        select: { contentJson: true },
      });
      // A historical version must carry its own immutable reader-facing
      // metadata. The latest ready revision is the one exception: its snapshot
      // is created by this first explicit publish decision.
      if (!display?.contentJson && requested.id !== latest?.id) throw new CreatorPublicationError("revision_not_ready");
      revisionId = requested.id;
      if (display?.contentJson) {
        displayJson = display.contentJson;
        writeDisplaySnapshot = false;
      }
    }
    // Publishing is the author's explicit confirmation of this immutable
    // revision. A later generate/refine creates a new revision but never
    // changes the accepted pointer behind the author's back.
    if (input.input.action === "publish") {
      if (!revisionId) throw new CreatorPublicationError("not_ready");
      await tx.creativeProject.update({ where: { id: core.id }, data: { acceptedRevisionId: revisionId } });
      // Capture reader-facing metadata at the same explicit author decision as
      // the accepted revision. This prevents an unconfirmed legacy draft from
      // changing public title, prompt, synopsis, tier or cover presentation.
      if (writeDisplaySnapshot) {
        await tx.creativeArtifact.create({
          data: {
            creativeProjectId: core.id,
            creativeRevisionId: revisionId,
            kind: "publication_display",
            mediaType: "json",
            contentJson: displayJson,
          },
        });
      }
    }
    await tx.creativeProject.update({
      where: { id: core.id },
      data: { visibility, status: visibility === "public" ? "published" : "ready" },
    });
    await tx.creativePublication.create({
      data: {
        creativeProjectId: core.id,
        creativeRevisionId: revisionId,
        action: input.input.action,
        visibility,
        decision: "approved",
        qualityVerdict: input.quality.verdict,
        qualityScore: input.quality.score,
        reasonJson: JSON.stringify({ evidence: input.quality.evidence }),
      },
    });
  });
  return { visibility, quality: input.quality };
}
