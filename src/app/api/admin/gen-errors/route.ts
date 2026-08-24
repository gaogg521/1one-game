import { NextResponse } from "next/server";
import { requireAdminCapability } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const gate = await requireAdminCapability(req, "platform_ops");
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "50", 10) || 50));
  const contentType = url.searchParams.get("contentType")?.trim();
  const errorType = url.searchParams.get("errorType")?.trim();
  const sinceDays = Number.parseInt(url.searchParams.get("sinceDays") ?? "7", 10);

  const where: Record<string, unknown> = {};
  if (contentType) where.contentType = contentType;
  if (errorType) where.errorType = errorType;
  if (Number.isFinite(sinceDays) && sinceDays > 0) {
    where.createdAt = { gte: new Date(Date.now() - sinceDays * 86_400_000) };
  }

  const [errors, total, jobGroups, jobs] = await Promise.all([
    prisma.generationError.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        contentType: true,
        errorType: true,
        errorMessage: true,
        promptSnippet: true,
        ownerKey: true,
        createdAt: true,
      },
    }),
    prisma.generationError.count({ where }),
    prisma.generationJob.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.generationJob.findMany({
      where: { status: { in: ["queued", "running", "retrying", "failed"] } },
      orderBy: { updatedAt: "desc" },
      take: 80,
      select: {
        id: true, type: true, status: true, attempts: true, maxAttempts: true, lastErrorCode: true,
        lastErrorDetail: true, progressJson: true, createdAt: true, updatedAt: true, runAfter: true, creativeRevisionId: true,
        project: { select: { kind: true, title: true } },
      },
    }),
  ]);

  return NextResponse.json({
    errors,
    total,
    limit,
    jobSummary: Object.fromEntries(jobGroups.map((item) => [item.status, item._count._all])),
    jobs: jobs.map((job) => ({
      ...job,
      progress: (() => { try { return job.progressJson ? JSON.parse(job.progressJson) : null; } catch { return null; } })(),
      progressJson: undefined,
      // A GenerationJob currently has no FK to ProviderUsage. Do not imply an
      // estimated cost until usage is correlated at job execution time.
      costStatus: "not_recorded" as const,
    })),
  });
}
