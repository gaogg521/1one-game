import { assessGameCreatorQuality } from "@/lib/creator-quality";
import { parseGameSpec } from "@/lib/game-spec";
import type { GameplayEventPayload } from "@/lib/gameplay-telemetry";
import { prisma } from "@/lib/prisma";

export type GamePlaytestEvidenceResult = "recorded" | "already_recorded" | "not_applicable";

type FirstMinuteEvent = Pick<GameplayEventPayload, "projectId" | "templateId" | "event" | "elapsedMs" | "verticalSliceScore">;

/**
 * Turns an actual browser first-minute event into immutable revision evidence.
 * The evidence deliberately excludes session ids, prompts, player input and
 * identity data: those fields remain only in the aggregate telemetry table.
 */
export async function persistFirstMinutePlaytestEvidence(event: FirstMinuteEvent): Promise<GamePlaytestEvidenceResult> {
  if (event.event !== "first_minute" || !event.projectId) return "not_applicable";

  const project = await prisma.project.findUnique({
    where: { id: event.projectId },
    select: { specJson: true },
  });
  if (!project) return "not_applicable";

  const core = await prisma.creativeProject.findUnique({
    where: { legacyType_legacyId: { legacyType: "project", legacyId: event.projectId } },
    select: {
      id: true,
      revisions: {
        where: { status: "ready" },
        orderBy: { sequence: "desc" },
        take: 1,
        select: { id: true },
      },
    },
  });
  const revision = core?.revisions[0];
  if (!core || !revision) return "not_applicable";

  let spec;
  try {
    spec = parseGameSpec(JSON.parse(project.specJson));
  } catch {
    return "not_applicable";
  }
  const quality = assessGameCreatorQuality(spec).report;
  const evidence = [
    ...quality.evidence,
    "playtest:first_minute_observed",
    `playtest_elapsed_ms:${event.elapsedMs ?? 60_000}`,
    `playtest_template:${event.templateId}`,
    ...(event.verticalSliceScore === undefined ? [] : [`playtest_vertical_slice_score:${event.verticalSliceScore}`]),
  ];
  const playtestReport = { ...quality, evidence };
  const artifactContent = {
    version: 1,
    event: "first_minute",
    templateId: event.templateId,
    elapsedMs: event.elapsedMs ?? 60_000,
    ...(event.verticalSliceScore === undefined ? {} : { verticalSliceScore: event.verticalSliceScore }),
  };

  return prisma.$transaction(async (tx) => {
    const existing = await tx.creativeArtifact.findFirst({
      where: {
        creativeProjectId: core.id,
        creativeRevisionId: revision.id,
        kind: "game_playtest_first_minute",
        status: "ready",
      },
      select: { id: true },
    });
    if (existing) return "already_recorded";
    await tx.creativeArtifact.create({
      data: {
        creativeProjectId: core.id,
        creativeRevisionId: revision.id,
        kind: "game_playtest_first_minute",
        mediaType: "report",
        contentJson: JSON.stringify(artifactContent),
        metadataJson: JSON.stringify({ source: "anonymous_runtime", templateId: event.templateId }),
      },
    });
    await tx.creativeEvaluation.create({
      data: {
        creativeProjectId: core.id,
        creativeRevisionId: revision.id,
        evaluator: "playtest",
        verdict: playtestReport.verdict,
        score: Math.round(playtestReport.score ?? 0),
        evidenceJson: JSON.stringify(playtestReport.evidence),
        reportJson: JSON.stringify(playtestReport),
      },
    });
    return "recorded";
  });
}

/**
 * SQLite asset workers can briefly hold the write lock just as a first-minute
 * event arrives. Retry the non-critical Core evidence write within the same
 * short observation window; callers still must not await this during play.
 */
export async function persistFirstMinutePlaytestEvidenceWithRetry(event: FirstMinuteEvent): Promise<GamePlaytestEvidenceResult> {
  const delaysMs = [0, 250, 750, 1_500, 3_000];
  let lastError: unknown;
  for (const delayMs of delaysMs) {
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    try {
      return await persistFirstMinutePlaytestEvidence(event);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
