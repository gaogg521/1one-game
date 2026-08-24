import { NextResponse } from "next/server";
import { requireSuperAdmin, writeAdminAudit } from "@/lib/auth/admin";
import { requeueFailedGenerationJob } from "@/lib/creator-core/jobs";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/** A credit-consuming operator action: explicit client confirmation + super-admin only. */
export async function POST(req: Request, ctx: RouteContext) {
  const gate = await requireSuperAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const body = await req.json().catch(() => ({})) as { confirmation?: string };
  if (body.confirmation !== "REQUEUE_FAILED_GENERATION") {
    return NextResponse.json({ error: "confirmation_required" }, { status: 400 });
  }
  const { id } = await ctx.params;
  const job = await prisma.generationJob.findUnique({
    where: { id }, select: { id: true, type: true, status: true, creativeProjectId: true, creativeRevisionId: true },
  });
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (job.status !== "failed") return NextResponse.json({ error: "job_not_failed" }, { status: 409 });
  if (!await requeueFailedGenerationJob(id)) return NextResponse.json({ error: "job_state_changed" }, { status: 409 });
  await writeAdminAudit({
    req,
    action: "generation_job_requeued",
    targetType: "generation_job",
    targetId: id,
    detail: { type: job.type, creativeProjectId: job.creativeProjectId, creativeRevisionId: job.creativeRevisionId },
    actorUserId: gate.user?.id,
    actorOwnerKey: gate.ownerKey,
  });
  return NextResponse.json({ ok: true, id, status: "queued" });
}
