import { NextResponse } from "next/server";
import { getJobStatus } from "@/lib/jobs/queue";
import { getOwnerKey } from "@/lib/owner";

type RouteContext = { params: Promise<{ id: string }> };

/** 查询异步任务进度（ownerKey 须与 payload.ownerKey 一致） */
export async function GET(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const job = await getJobStatus(id);
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });

  const ownerKey = await getOwnerKey();
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
