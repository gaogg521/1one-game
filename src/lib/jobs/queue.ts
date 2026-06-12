import { prisma } from "@/lib/prisma";

export type JobType = "novel_generate" | "comic_generate" | "cover_generate";

export type EnqueueOpts = {
  type: JobType;
  payload: Record<string, unknown>;
  runAfter?: Date;
};

/** 入队：始终落 SQLite；若配置 REDIS_URL 则同步镜像供多实例通知 */
export async function enqueueJob(opts: EnqueueOpts): Promise<string> {
  const payloadJson = JSON.stringify(opts.payload);
  const row = await prisma.jobQueueItem.create({
    data: {
      type: opts.type,
      payloadJson,
      runAfter: opts.runAfter ?? new Date(),
    },
  });
  const redisUrl = process.env.REDIS_URL?.trim();
  if (redisUrl) {
    try {
      const { default: Redis } = await import("ioredis");
      const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });
      await redis.connect();
      await redis.lpush(
        "1one:jobs",
        JSON.stringify({
          id: row.id,
          type: opts.type,
          payload: opts.payload,
          runAfter: opts.runAfter?.toISOString(),
        }),
      );
      await redis.quit();
    } catch {
      /* SQLite 为主存储，Redis 镜像失败不阻断 */
    }
  }
  return row.id;
}

export async function updateJobProgress(
  id: string,
  progress: { percent?: number; stage?: string; detail?: string },
): Promise<void> {
  const row = await prisma.jobQueueItem.findUnique({ where: { id } });
  if (!row) return;
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(row.payloadJson) as Record<string, unknown>;
  } catch {
    payload = {};
  }
  payload._progress = progress;
  await prisma.jobQueueItem.update({
    where: { id },
    data: { payloadJson: JSON.stringify(payload) },
  });
}

export async function getJobStatus(id: string) {
  const row = await prisma.jobQueueItem.findUnique({ where: { id } });
  if (!row) return null;
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(row.payloadJson) as Record<string, unknown>;
  } catch {
    payload = {};
  }
  const progress = payload._progress as { percent?: number; stage?: string; detail?: string } | undefined;
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    attempts: row.attempts,
    lastError: row.lastError,
    progress: progress ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function claimNextJob(): Promise<{
  id: string;
  type: string;
  payload: Record<string, unknown>;
} | null> {
  const row = await prisma.jobQueueItem.findFirst({
    where: { status: "pending", runAfter: { lte: new Date() } },
    orderBy: { runAfter: "asc" },
  });
  if (!row) return null;
  const updated = await prisma.jobQueueItem.updateMany({
    where: { id: row.id, status: "pending" },
    data: { status: "running", attempts: { increment: 1 } },
  });
  if (updated.count === 0) return null;
  return {
    id: row.id,
    type: row.type,
    payload: JSON.parse(row.payloadJson) as Record<string, unknown>,
  };
}

export async function completeJob(id: string): Promise<void> {
  await prisma.jobQueueItem.update({
    where: { id },
    data: { status: "done", lastError: null },
  });
}

export async function failJob(id: string, error: string): Promise<void> {
  await prisma.jobQueueItem.update({
    where: { id },
    data: { status: "failed", lastError: error.slice(0, 500) },
  });
}
