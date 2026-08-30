import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type NewGenerationJob = {
  creativeProjectId: string;
  creativeRevisionId?: string;
  type: "artifact_write" | "novel_plan" | "novel_scene" | "novel_continue" | "comic_panel" | "game_build" | "game_asset" | "game_production" | "game_iteration" | "evaluation";
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

export async function claimGenerationJob(workerId: string, leaseMs = 90_000) {
  const now = new Date();
  const candidate = await prisma.generationJob.findFirst({
    where: {
      OR: [
        { status: { in: ["queued", "retrying"] }, runAfter: { lte: now } },
        { status: "running", leaseExpiresAt: { lt: now } },
      ],
    },
    orderBy: { runAfter: "asc" },
  });
  if (!candidate) return null;
  const claimed = await prisma.generationJob.updateMany({
    where: {
      id: candidate.id,
      OR: [
        { status: { in: ["queued", "retrying"] }, runAfter: { lte: now } },
        { status: "running", leaseExpiresAt: { lt: now } },
      ],
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
  return prisma.generationJob.findUniqueOrThrow({ where: { id: candidate.id } });
}

export async function completeGenerationJob(id: string, outputArtifactId?: string) {
  return prisma.generationJob.update({
    where: { id },
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

/** Extends a long-running worker lease and exposes coarse, owner-safe progress. */
export async function heartbeatGenerationJob(
  id: string,
  workerId: string,
  progress: { percent: number; stage: string; detail?: string },
  leaseMs = 90_000,
) {
  const result = await prisma.generationJob.updateMany({
    where: { id, status: "running", workerId },
    data: {
      leaseExpiresAt: new Date(Date.now() + leaseMs),
      progressJson: JSON.stringify({
        percent: Math.max(1, Math.min(99, Math.round(progress.percent))),
        stage: progress.stage.slice(0, 96),
        ...(progress.detail ? { detail: progress.detail.slice(0, 400) } : {}),
      }),
    },
  });
  return result.count === 1;
}

export async function failGenerationJob(
  id: string,
  error: unknown,
  options?: { retry?: boolean; errorCode?: string },
) {
  const current = await prisma.generationJob.findUniqueOrThrow({ where: { id } });
  const detail = error instanceof Error ? error.message : String(error);
  const retry = options?.retry ?? current.attempts < current.maxAttempts;
  const backoffMs = Math.min(5 * 60_000, 2 ** Math.max(0, current.attempts - 1) * 5_000);
  return prisma.generationJob.update({
    where: { id },
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
