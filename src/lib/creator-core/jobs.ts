import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendMilestone, parseJobProgress, type ProgressMilestone } from "@/lib/creator-core/progress-milestones";

export type NewGenerationJob = {
  creativeProjectId: string;
  creativeRevisionId?: string;
  type: "artifact_write" | "novel_plan" | "novel_scene" | "novel_continue" | "comic_panel" | "game_build" | "game_asset" | "game_production" | "game_preflight_iteration" | "game_iteration" | "evaluation";
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  maxAttempts?: number;
  runAfter?: Date;
};

export async function enqueueGenerationJob(input: NewGenerationJob) {
  if (input.idempotencyKey) {
    const existing = await prisma.generationJob.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return existing;
  }
  try {
    return await prisma.generationJob.create({
      data: {
        creativeProjectId: input.creativeProjectId,
        creativeRevisionId: input.creativeRevisionId,
        type: input.type,
        payloadJson: JSON.stringify(input.payload),
        idempotencyKey: input.idempotencyKey,
        maxAttempts: Math.max(1, Math.min(8, input.maxAttempts ?? 3)),
        runAfter: input.runAfter ?? new Date(),
      },
    });
  } catch (error) {
    if (input.idempotencyKey && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.generationJob.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) return existing;
    }
    throw error;
  }
}

export async function claimGenerationJob(workerId: string, leaseMs = 90_000, preferredJobId?: string) {
  const now = new Date();
  const eligible: Prisma.GenerationJobWhereInput = {
    OR: [
      { status: { in: ["queued", "retrying"] }, runAfter: { lte: now } },
      { status: "running", leaseExpiresAt: { lt: now } },
    ],
  };
  // Exhausted abandoned leases are terminal, and must not monopolize FIFO.
  const exhaustedWhere = { ...eligible, attempts: { gte: prisma.generationJob.fields.maxAttempts }, ...(preferredJobId ? { id: preferredJobId } : {}) };
  const exhausted = await prisma.generationJob.findMany({ where: exhaustedWhere, take: 100, select: { id: true, type: true, creativeRevisionId: true } });
  for (const item of exhausted) await prisma.$transaction(async tx => {
    const updated = await tx.generationJob.updateMany({
      where: { ...exhaustedWhere, id: item.id },
      data: { status: "failed", leaseExpiresAt: null, workerId: null, lastErrorCode: "attempt_limit_exhausted", lastErrorDetail: "The worker lease expired after the final allowed attempt.", progressJson: JSON.stringify({ percent: 0, stage: "failed" }) },
    });
    if (updated.count && item.type === "game_production" && item.creativeRevisionId) await tx.creativeRevision.updateMany({ where: { id: item.creativeRevisionId, status: { in: ["preparing", "generating"] } }, data: { status: "failed", summary: "generation attempt limit exhausted", finalizedAt: now } });
  });
  return prisma.$transaction(async (tx) => {
  const configured = Number(process.env.GENERATION_WORKER_CONCURRENCY ?? 2);
  const limit = Number.isInteger(configured) ? Math.max(1, Math.min(4, configured)) : 2;
  const active = { status: "running", leaseExpiresAt: { gte: now } };
  if (await tx.generationJob.count({ where: active }) >= limit) return null;
  const candidate = await tx.generationJob.findFirst({
    where: {
      ...eligible,
      attempts: { lt: prisma.generationJob.fields.maxAttempts },
      project: { jobs: { none: active } },
      ...(preferredJobId ? { id: preferredJobId } : {}),
    },
    orderBy: { runAfter: "asc" },
  });
  if (!candidate) return null;
  const claimed = await tx.generationJob.updateMany({
    where: {
      id: candidate.id,
      attempts: candidate.attempts,
      ...eligible,
    },
    data: {
      status: "running",
      workerId,
      leaseExpiresAt: new Date(now.getTime() + leaseMs),
      attempts: { increment: 1 },
      progressJson: JSON.stringify({ percent: 1, stage: "claimed" }),
    },
  });
  if (claimed.count === 0) return null;
  return tx.generationJob.findUniqueOrThrow({ where: { id: candidate.id } });
  });
}

export async function completeGenerationJob(id: string, outputArtifactId?: string, workerId?: string) {
  return prisma.generationJob.update({
    where: { id, ...(workerId ? { workerId, status: "running", leaseExpiresAt: { gt: new Date() } } : {}) },
    data: {
      status: "completed",
      outputArtifactId,
      progressJson: JSON.stringify({ percent: 100, stage: "completed" }),
      leaseExpiresAt: null,
      completedAt: new Date(),
      lastErrorCode: null,
      lastErrorDetail: null,
    },
  });
}

export async function renewGenerationJobLease(id: string, workerId: string, leaseMs = 90_000) {
  const result = await prisma.generationJob.updateMany({
    where: { id, workerId, status: "running", leaseExpiresAt: { gt: new Date() } },
    data: { leaseExpiresAt: new Date(Date.now() + leaseMs) },
  });
  return result.count === 1;
}

export async function assertGenerationJobLease(id: string, workerId: string) {
  if (!await prisma.generationJob.count({ where: { id, workerId, status: "running", leaseExpiresAt: { gt: new Date() } } })) throw new Error("generation_job_lease_lost");
}

/**
 * Extends a long-running worker lease and exposes owner-safe progress.
 *
 * `milestone` carries the artefact the pipeline just produced — the design
 * document, a finished module, a rendered image — so a creator watching a
 * multi-minute build sees the work appear instead of a percentage. Milestones
 * accumulate across heartbeats; the caller only ever sends the new one.
 */
export async function heartbeatGenerationJob(
  id: string,
  workerId: string,
  progress: { percent: number; stage: string; detail?: string; milestone?: ProgressMilestone },
  leaseMs = 90_000,
) {
  const current = await prisma.generationJob.findUnique({ where: { id }, select: { progressJson: true } });
  const existing = parseJobProgress(current?.progressJson)?.milestones ?? [];
  const milestones = progress.milestone ? appendMilestone(existing, progress.milestone) : existing;

  const result = await prisma.generationJob.updateMany({
    where: { id, status: "running", workerId, leaseExpiresAt: { gt: new Date() } },
    data: {
      leaseExpiresAt: new Date(Date.now() + leaseMs),
      progressJson: JSON.stringify({
        percent: Math.max(1, Math.min(99, Math.round(progress.percent))),
        stage: progress.stage.slice(0, 96),
        ...(progress.detail ? { detail: progress.detail.slice(0, 400) } : {}),
        milestones,
      }),
    },
  });
  return result.count === 1;
}

export async function failGenerationJob(
  id: string,
  error: unknown,
  options?: { retry?: boolean; errorCode?: string; workerId?: string },
) {
  const current = await prisma.generationJob.findUniqueOrThrow({ where: { id } });
  const detail = error instanceof Error ? error.message : String(error);
  const retry = options?.retry !== false && current.attempts < current.maxAttempts;
  const backoffMs = Math.min(5 * 60_000, 2 ** Math.max(0, current.attempts - 1) * 5_000);
  return prisma.generationJob.update({
    where: { id, ...(options?.workerId ? { workerId: options.workerId, status: "running", leaseExpiresAt: { gt: new Date() } } : {}) },
    data: {
      status: retry ? "retrying" : "failed",
      runAfter: retry ? new Date(Date.now() + backoffMs) : current.runAfter,
      leaseExpiresAt: null,
      lastErrorCode: options?.errorCode ?? "execution_failed",
      lastErrorDetail: detail.slice(0, 1200),
      progressJson: JSON.stringify({ percent: 0, stage: retry ? "retrying" : "failed" }),
    },
  });
}

/**
 * Operator-initiated recovery is intentionally narrower than worker retries:
 * only a terminal failed job can be requeued, its immutable payload/revision is
 * retained, and the worker will claim it normally. This avoids double-running
 * an in-flight task or silently mutating creator input.
 */
export async function requeueFailedGenerationJob(id: string) {
  const updated = await prisma.generationJob.updateMany({
    where: { id, status: "failed" },
    data: {
      status: "queued",
      attempts: 0,
      runAfter: new Date(),
      leaseExpiresAt: null,
      workerId: null,
      lastErrorCode: null,
      lastErrorDetail: null,
      progressJson: JSON.stringify({ percent: 0, stage: "operator_requeued" }),
      completedAt: null,
    },
  });
  return updated.count === 1;
}
