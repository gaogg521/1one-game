import { NextResponse } from "next/server";
import { getJobStatus } from "@/lib/jobs/queue";
import { getOwnerKey } from "@/lib/owner";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/** 查询异步任务进度（ownerKey 须与 payload.ownerKey 一致） */
export async function GET(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const ownerKey = await getOwnerKey();
  const coreJob = await prisma.generationJob.findUnique({
    where: { id },
    include: { project: { select: { ownerKey: true } } },
  });
  if (coreJob) {
    if (!ownerKey || coreJob.project.ownerKey !== ownerKey) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    let progress: unknown = null;
    try { progress = JSON.parse(coreJob.progressJson ?? "null"); } catch { /* corrupt progress stays null */ }
    return NextResponse.json({
      id: coreJob.id,
      type: coreJob.type,
      status: coreJob.status,
      attempts: coreJob.attempts,
      maxAttempts: coreJob.maxAttempts,
      runAfter: coreJob.runAfter,
      completedAt: coreJob.completedAt,
      progress,
      error: coreJob.lastErrorCode ? { code: coreJob.lastErrorCode, detail: coreJob.lastErrorDetail } : null,
    });
  }
  const job = await getJobStatus(id);
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });

  let payloadOwner: string | undefined;
  try {
    const row = await import("@/lib/prisma").then((m) =>
      m.prisma.jobQueueItem.findUnique({ where: { id }, select: { payloadJson: true } }),
    );
    if (row) {
      const p = JSON.parse(row.payloadJson) as { ownerKey?: string };
      payloadOwner = p.ownerKey;
    }
  } catch {
    /* ignore */
  }
  if (payloadOwner && ownerKey !== payloadOwner) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json(job);
}
