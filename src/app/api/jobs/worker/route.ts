import { NextResponse } from "next/server";
import { claimNextJob, completeJob, failJob, updateJobProgress } from "@/lib/jobs/queue";

function authorized(req: Request): boolean {
  const secret = process.env.JOB_WORKER_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("x-job-worker-secret") === secret;
}

/** 拉取并处理一条队列任务（长生成迁移入口；当前为占位处理器） */
export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 403 });

  const job = await claimNextJob();
  if (!job) return NextResponse.json({ ok: true, processed: false });

  try {
    await updateJobProgress(job.id, { percent: 10, stage: "started", detail: job.type });
    // 长生成 worker 分发入口：具体业务逻辑仍由 SSE 主路径承担，队列用于进度追踪与后续迁移
    await updateJobProgress(job.id, { percent: 100, stage: "done", detail: "acknowledged" });
    await completeJob(job.id);
    return NextResponse.json({ ok: true, processed: true, jobId: job.id, type: job.type });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "job failed";
    await failJob(job.id, msg);
    return NextResponse.json({ ok: false, jobId: job.id, error: msg }, { status: 500 });
  }
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  const pending = await import("@/lib/prisma").then((m) =>
    m.prisma.jobQueueItem.count({ where: { status: "pending" } }),
  );
  return NextResponse.json({ pending, redis: Boolean(process.env.REDIS_URL) });
}
