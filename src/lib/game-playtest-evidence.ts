import { assessGameCreatorQuality } from "@/lib/creator-quality";
import { parseGameSpec } from "@/lib/game-spec";
import type { GameplayEventPayload } from "@/lib/gameplay-telemetry";
import { isPrismaUniqueViolation } from "@/lib/prisma-errors";
import { prisma } from "@/lib/prisma";

export type GamePlaytestEvidenceResult = "recorded" | "already_recorded" | "not_applicable";

type FirstMinuteEvent = Pick<
  GameplayEventPayload,
  | "projectId"
  | "creativeRevisionId"
  | "templateId"
  | "event"
  | "elapsedMs"
  | "activeMs"
  | "actionCount"
  | "deviceClass"
  | "orientation"
  | "touchCapable"
  | "verticalSliceScore"
>;

/**
 * Turns an actual browser first-minute event into immutable revision evidence.
 * The evidence deliberately excludes session ids, prompts, player input and
 * identity data: those fields remain only in the aggregate telemetry table.
 */
export async function persistFirstMinutePlaytestEvidence(event: FirstMinuteEvent): Promise<GamePlaytestEvidenceResult> {
  if (event.event !== "first_minute" || !event.projectId || !event.creativeRevisionId) return "not_applicable";

  const core = await prisma.creativeProject.findUnique({
    where: { legacyType_legacyId: { legacyType: "project", legacyId: event.projectId } },
    select: {
      id: true,
      revisions: {
        where: { id: event.creativeRevisionId, status: "ready" },
        take: 1,
        select: {
          id: true,
          artifacts: {
            where: { kind: "game_spec", status: "ready" },
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { contentJson: true },
          },
        },
      },
    },
  });
  const revision = core?.revisions[0];
  if (!core || !revision) return "not_applicable";

  const specArtifact = revision.artifacts[0];
  if (!specArtifact?.contentJson) return "not_applicable";
  let spec;
  try {
    spec = parseGameSpec(JSON.parse(specArtifact.contentJson));
  } catch {
    return "not_applicable";
  }
  if (spec.templateId !== event.templateId) return "not_applicable";
  const quality = assessGameCreatorQuality(spec).report;
  const evidence = [
    ...quality.evidence,
    "playtest:first_minute_observed",
    `playtest_elapsed_ms:${event.elapsedMs ?? 60_000}`,
    `playtest_active_ms:${event.activeMs ?? 0}`,
    `playtest_action_count:${event.actionCount ?? 0}`,
    `playtest_device:${event.deviceClass ?? "unknown"}`,
    `playtest_touch:${event.touchCapable === true ? "yes" : "no"}`,
    `playtest_template:${event.templateId}`,
    ...(event.verticalSliceScore === undefined ? [] : [`playtest_vertical_slice_score:${event.verticalSliceScore}`]),
  ];
  const playtestReport = { ...quality, evidence };
  const artifactContent = {
    version: 2,
    event: "first_minute",
    templateId: event.templateId,
    elapsedMs: event.elapsedMs ?? 60_000,
    activeMs: event.activeMs ?? 0,
    actionCount: event.actionCount ?? 0,
    deviceClass: event.deviceClass ?? "unknown",
    orientation: event.orientation ?? "unknown",
    touchCapable: event.touchCapable === true,
    ...(event.verticalSliceScore === undefined ? {} : { verticalSliceScore: event.verticalSliceScore }),
  };

  const idempotencyKey = `game_playtest_first_minute:${revision.id}`;
  const existing = await prisma.creativeArtifact.findUnique({ where: { idempotencyKey }, select: { id: true } });
  if (existing) return "already_recorded";
  try {
    await prisma.$transaction(async (tx) => {
      await tx.creativeArtifact.create({
        data: {
          creativeProjectId: core.id,
          creativeRevisionId: revision.id,
          kind: "game_playtest_first_minute",
          mediaType: "report",
          contentJson: JSON.stringify(artifactContent),
          metadataJson: JSON.stringify({ source: "anonymous_runtime", templateId: event.templateId }),
          idempotencyKey,
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
    });
    return "recorded";
  } catch (error) {
    if (isPrismaUniqueViolation(error)) return "already_recorded";
    throw error;
  }
}

type DeliveryEvent = Pick<GameplayEventPayload, "projectId" | "creativeRevisionId" | "templateId" | "event" | "sessionId">;

/**
 * Promotes one anonymous session to publishable delivery evidence only after
 * the same immutable revision has a foreground mobile minute, meaningful
 * repeated input, and an explicit game outcome. The persisted artifact keeps
 * only coarse aggregates and deliberately drops the random session id.
 */
export async function persistGameDeliveryPlaytestEvidence(event: DeliveryEvent): Promise<GamePlaytestEvidenceResult> {
  if (!event.projectId || !event.creativeRevisionId || (event.event !== "first_minute" && event.event !== "end")) {
    return "not_applicable";
  }
  const core = await prisma.creativeProject.findUnique({
    where: { legacyType_legacyId: { legacyType: "project", legacyId: event.projectId } },
    select: {
      id: true,
      revisions: {
        where: { id: event.creativeRevisionId, status: "ready" },
        take: 1,
        select: { id: true },
      },
    },
  });
  const revision = core?.revisions[0];
  if (!core || !revision) return "not_applicable";

  const sessionEvents = await prisma.gameplayEvent.findMany({
    where: {
      projectId: event.projectId,
      creativeRevisionId: revision.id,
      sessionId: event.sessionId,
      event: { in: ["first_action", "first_minute", "end"] },
    },
    orderBy: { createdAt: "asc" },
    select: {
      event: true,
      elapsedMs: true,
      activeMs: true,
      actionCount: true,
      deviceClass: true,
      orientation: true,
      touchCapable: true,
      score: true,
      won: true,
      templateId: true,
    },
  });
  const firstAction = sessionEvents.find((entry) => entry.event === "first_action");
  const firstMinute = sessionEvents.find((entry) => entry.event === "first_minute");
  const outcome = [...sessionEvents].reverse().find((entry) => entry.event === "end" && typeof entry.won === "boolean");
  if (
    !firstAction ||
    !firstMinute ||
    !outcome ||
    firstMinute.templateId !== event.templateId ||
    (firstMinute.activeMs ?? 0) < 60_000 ||
    (firstMinute.actionCount ?? 0) < 3 ||
    firstMinute.deviceClass !== "mobile" ||
    firstMinute.touchCapable !== true
  ) {
    return "not_applicable";
  }

  const evidence = [
    "playtest:mobile_h5_delivery_observed",
    `playtest_active_ms:${firstMinute.activeMs}`,
    `playtest_action_count:${firstMinute.actionCount}`,
    `playtest_outcome:${outcome.won ? "won" : "lost"}`,
    `playtest_orientation:${firstMinute.orientation ?? "unknown"}`,
  ];
  const report = { verdict: "ready" as const, score: 100, evidence };
  const idempotencyKey = `game_playtest_delivery:${revision.id}`;
  const existing = await prisma.creativeArtifact.findUnique({ where: { idempotencyKey }, select: { id: true } });
  if (existing) return "already_recorded";
  try {
    await prisma.$transaction(async (tx) => {
      await tx.creativeArtifact.create({
        data: {
          creativeProjectId: core.id,
          creativeRevisionId: revision.id,
          kind: "game_playtest_delivery",
          mediaType: "report",
          contentJson: JSON.stringify({
            version: 1,
            templateId: event.templateId,
            activeMs: firstMinute.activeMs,
            actionCount: firstMinute.actionCount,
            deviceClass: firstMinute.deviceClass,
            orientation: firstMinute.orientation,
            touchCapable: true,
            outcome: outcome.won ? "won" : "lost",
            score: outcome.score,
            elapsedMs: outcome.elapsedMs,
          }),
          metadataJson: JSON.stringify({ source: "anonymous_runtime", templateId: event.templateId }),
          idempotencyKey,
        },
      });
      await tx.creativeEvaluation.create({
        data: {
          creativeProjectId: core.id,
          creativeRevisionId: revision.id,
          evaluator: "playtest",
          verdict: report.verdict,
          score: report.score,
          evidenceJson: JSON.stringify(report.evidence),
          reportJson: JSON.stringify(report),
        },
      });
    });
    return "recorded";
  } catch (error) {
    if (isPrismaUniqueViolation(error)) return "already_recorded";
    throw error;
  }
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

export async function persistGameDeliveryPlaytestEvidenceWithRetry(event: DeliveryEvent): Promise<GamePlaytestEvidenceResult> {
  const delaysMs = [0, 250, 750, 1_500, 3_000];
  let lastError: unknown;
  for (const delayMs of delaysMs) {
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    try {
      return await persistGameDeliveryPlaytestEvidence(event);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
