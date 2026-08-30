import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { SAMPLE_GALLERY_OWNER } from "@/lib/sample-gallery";
import { enqueueGenerationJob } from "@/lib/creator-core/jobs";

export type GameRetentionBucket = "exit_0_10s" | "exit_10_30s" | "exit_30_60s" | "play_1_2m" | "play_2_5m" | "play_5m_plus";

export type GameDistributionDecision = {
  version: 1;
  kind: "game_distribution_decision";
  decision: "collect_samples" | "iterate" | "promote" | "retire";
  sampleSize: number;
  effectivePlayRate: number;
  firstActionRate: number;
  firstMinuteRate: number;
  retryRate: number;
  buckets: Record<GameRetentionBucket, number>;
  diagnoses: string[];
  revisionTargets: Array<"loading" | "onboarding" | "controls" | "difficulty" | "core_loop" | "progression" | "game_feel">;
  eligibleForGallery: boolean;
  evidence: string[];
};

export type DistributionGameplayEvent = {
  sessionId: string;
  event: string;
  elapsedMs: number | null;
  activeMs?: number | null;
};

const rate = (part: number, total: number) => total > 0 ? Math.round((part / total) * 1_000) / 10 : 0;

/**
 * Evaluates only observed sessions. Missing samples result in collection, not
 * an optimistic quality verdict. Thresholds are intentionally conservative
 * until production cohorts are large enough to calibrate them.
 */
export function evaluateGameDistribution(events: DistributionGameplayEvent[]): GameDistributionDecision {
  const sessions = new Map<string, DistributionGameplayEvent[]>();
  for (const event of events) {
    const list = sessions.get(event.sessionId) ?? [];
    list.push(event);
    sessions.set(event.sessionId, list);
  }
  const started = [...sessions.values()].filter((list) => list.some((event) => event.event === "start"));
  const sampleSize = started.length;
  let firstActions = 0;
  let firstMinutes = 0;
  let retries = 0;
  let effectivePlays = 0;
  const buckets: GameDistributionDecision["buckets"] = {
    exit_0_10s: 0,
    exit_10_30s: 0,
    exit_30_60s: 0,
    play_1_2m: 0,
    play_2_5m: 0,
    play_5m_plus: 0,
  };

  for (const list of started) {
    if (list.some((event) => event.event === "first_action")) firstActions += 1;
    if (list.some((event) => event.event === "first_minute")) firstMinutes += 1;
    retries += list.filter((event) => event.event === "retry").length;
    const observedMs = Math.max(0, ...list.map((event) => Math.max(event.elapsedMs ?? 0, event.activeMs ?? 0)));
    if (observedMs >= 30_000) effectivePlays += 1;
    if (observedMs < 10_000) buckets.exit_0_10s += 1;
    else if (observedMs < 30_000) buckets.exit_10_30s += 1;
    else if (observedMs < 60_000) buckets.exit_30_60s += 1;
    else if (observedMs < 120_000) buckets.play_1_2m += 1;
    else if (observedMs < 300_000) buckets.play_2_5m += 1;
    else buckets.play_5m_plus += 1;
  }

  const effectivePlayRate = rate(effectivePlays, sampleSize);
  const firstActionRate = rate(firstActions, sampleSize);
  const firstMinuteRate = rate(firstMinutes, sampleSize);
  const retryRate = rate(retries, sampleSize);
  const longPlayRate = rate(buckets.play_2_5m + buckets.play_5m_plus, sampleSize);
  const diagnoses: string[] = [];
  const targets = new Set<GameDistributionDecision["revisionTargets"][number]>();
  if (rate(buckets.exit_0_10s, sampleSize) >= 25) { diagnoses.push("loading_or_first_frame_loss"); targets.add("loading"); }
  if (firstActionRate < 65) { diagnoses.push("first_action_friction"); targets.add("onboarding"); targets.add("controls"); }
  if (rate(buckets.exit_30_60s, sampleSize) >= 25 || firstMinuteRate < 40) { diagnoses.push("first_minute_core_loop_loss"); targets.add("difficulty"); targets.add("core_loop"); targets.add("game_feel"); }
  if (longPlayRate < 15) { diagnoses.push("missing_two_minute_progression"); targets.add("progression"); }

  let decision: GameDistributionDecision["decision"] = "collect_samples";
  if (sampleSize >= 20) {
    const healthy = effectivePlayRate >= 65 && firstActionRate >= 75 && firstMinuteRate >= 45 && longPlayRate >= 15;
    const clearlyWeak = effectivePlayRate < 35 || firstActionRate < 45 || firstMinuteRate < 20;
    decision = healthy ? "promote" : sampleSize >= 40 && clearlyWeak ? "retire" : "iterate";
  }
  return {
    version: 1,
    kind: "game_distribution_decision",
    decision,
    sampleSize,
    effectivePlayRate,
    firstActionRate,
    firstMinuteRate,
    retryRate,
    buckets,
    diagnoses,
    revisionTargets: [...targets],
    eligibleForGallery: decision === "promote",
    evidence: [
      `observed_sessions:${sampleSize}`,
      `effective_play_rate:${effectivePlayRate}`,
      `first_action_rate:${firstActionRate}`,
      `first_minute_rate:${firstMinuteRate}`,
      `two_minute_rate:${longPlayRate}`,
    ],
  };
}

/** Persist a new decision only when its material result changes. */
export async function evaluateAndPersistGameDistribution(input: { projectId: string; creativeRevisionId: string }) {
  const core = await prisma.creativeProject.findUnique({
    where: { legacyType_legacyId: { legacyType: "project", legacyId: input.projectId } },
    select: { id: true },
  });
  if (!core) return null;
  const events = await prisma.gameplayEvent.findMany({
    where: { projectId: input.projectId, creativeRevisionId: input.creativeRevisionId },
    select: { sessionId: true, event: true, elapsedMs: true, activeMs: true },
  });
  const decision = evaluateGameDistribution(events);
  const fingerprint = createHash("sha256").update(JSON.stringify({
    decision: decision.decision,
    sampleSize: decision.sampleSize,
    rates: [decision.effectivePlayRate, decision.firstActionRate, decision.firstMinuteRate, decision.retryRate],
    buckets: decision.buckets,
  })).digest("hex").slice(0, 20);
  const idempotencyKey = `game_distribution_decision:${input.creativeRevisionId}:${fingerprint}`;
  const existing = await prisma.creativeArtifact.findUnique({ where: { idempotencyKey }, select: { id: true } });
  if (existing) return decision;

  let shouldIterate = false;
  await prisma.$transaction(async (tx) => {
    await tx.creativeArtifact.create({ data: {
      creativeProjectId: core.id,
      creativeRevisionId: input.creativeRevisionId,
      kind: "game_distribution_decision",
      mediaType: "report",
      contentJson: JSON.stringify(decision),
      metadataJson: JSON.stringify({ source: "anonymous_runtime_aggregate", fingerprint }),
      idempotencyKey,
    } });
    await tx.creativeEvaluation.create({ data: {
      creativeProjectId: core.id,
      creativeRevisionId: input.creativeRevisionId,
      evaluator: "playtest",
      verdict: decision.decision === "promote" ? "ready" : decision.decision === "collect_samples" ? "needs_polish" : "blocked",
      score: Math.round(decision.firstMinuteRate),
      evidenceJson: JSON.stringify(decision.evidence),
      reportJson: JSON.stringify(decision),
    } });
    const legacy = await tx.project.findUnique({ where: { id: input.projectId }, select: { visibility: true, ownerKey: true } });
    if (legacy?.visibility === "public" && legacy.ownerKey !== SAMPLE_GALLERY_OWNER) {
      if (decision.decision === "promote") await tx.project.update({ where: { id: input.projectId }, data: { featured: true } });
      if (decision.decision === "retire") await tx.project.update({ where: { id: input.projectId }, data: { featured: false } });
    }
    if (decision.decision === "iterate" && legacy && legacy.ownerKey !== SAMPLE_GALLERY_OWNER) {
      const automaticRounds = await tx.creativeRevision.count({
        where: { creativeProjectId: core.id, cause: "refine", intentJson: { contains: "automaticIteration" } },
      });
      shouldIterate = automaticRounds < 5;
    }
  });
  if (shouldIterate) {
    await enqueueGenerationJob({
      creativeProjectId: core.id,
      creativeRevisionId: input.creativeRevisionId,
      type: "game_iteration",
      idempotencyKey: `game-iteration:${input.creativeRevisionId}`,
      maxAttempts: 2,
      payload: {
        projectId: input.projectId,
        ownerKey: (await prisma.project.findUniqueOrThrow({ where: { id: input.projectId }, select: { ownerKey: true } })).ownerKey,
        sourceRevisionId: input.creativeRevisionId,
        diagnoses: decision.diagnoses,
        revisionTargets: decision.revisionTargets,
        uiLocale: "zh-Hans",
      },
    });
  }
  return decision;
}
