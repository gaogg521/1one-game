import { NextResponse } from "next/server";
import { requireAdminCapability } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";
import { getEffectiveRoutes, loadRuntimeConfig, type ProviderPricingRule } from "@/lib/runtime-config";
import { getEffectiveProviders, routeModelCascade, type RuntimeSceneKey } from "@/lib/runtime-providers";

function sceneForJob(type: string): RuntimeSceneKey | null {
  if (type === "game_asset" || type === "game_build") return "game_text";
  if (type === "novel_continue" || type === "novel_plan" || type === "novel_scene") return "novel";
  if (type === "comic_panel") return "comic_image_openai";
  return null;
}

function configuredEstimateMicros(
  pricing: ProviderPricingRule[],
  provider: string,
  model: string,
  modality: ProviderPricingRule["modality"],
  operation: ProviderPricingRule["operation"],
) {
  const normalizedProvider = provider.toLowerCase();
  const normalizedModel = model.toLowerCase();
  return pricing.find((rule) => rule.provider === normalizedProvider && rule.model === normalizedModel && rule.modality === modality && rule.operation === operation)
    ?? pricing.find((rule) => rule.provider === "*" && rule.model === "*" && rule.modality === modality && rule.operation === operation)
    ?? null;
}

export async function GET(req: Request) {
  const gate = await requireAdminCapability(req, "platform_ops");
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "50", 10) || 50));
  const contentType = url.searchParams.get("contentType")?.trim();
  const errorType = url.searchParams.get("errorType")?.trim();
  const sinceDays = Number.parseInt(url.searchParams.get("sinceDays") ?? "7", 10);
  const jobContentType = url.searchParams.get("jobContentType")?.trim();
  const requestedJobStatus = url.searchParams.get("jobStatus")?.trim();
  const activeJobStatuses = ["queued", "running", "retrying", "failed"];
  const jobStatus = requestedJobStatus && activeJobStatuses.includes(requestedJobStatus) ? requestedJobStatus : undefined;

  const where: Record<string, unknown> = {};
  if (contentType) where.contentType = contentType;
  if (errorType) where.errorType = errorType;
  if (Number.isFinite(sinceDays) && sinceDays > 0) {
    where.createdAt = { gte: new Date(Date.now() - sinceDays * 86_400_000) };
  }
  const jobsWhere = {
    status: jobStatus ?? { in: activeJobStatuses },
    ...(jobContentType ? { project: { kind: jobContentType } } : {}),
  };

  const [errors, total, jobGroups, jobs, runtime] = await Promise.all([
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
      where: jobsWhere,
      orderBy: { updatedAt: "desc" },
      take: 80,
      select: {
        id: true, type: true, status: true, attempts: true, maxAttempts: true, lastErrorCode: true,
        lastErrorDetail: true, progressJson: true, createdAt: true, updatedAt: true, runAfter: true, creativeRevisionId: true,
        project: { select: { kind: true, title: true } },
      },
    }),
    loadRuntimeConfig(),
  ]);

  const routes = getEffectiveRoutes(runtime.payload);
  const providers = getEffectiveProviders(runtime.payload);
  const pricing = runtime.payload.providerPricing ?? [];
  const usageRows = jobs.length
    ? await prisma.providerUsageEvent.findMany({
        where: { generationJobId: { in: jobs.map((job) => job.id) } },
        select: { generationJobId: true, provider: true, model: true, status: true, durationMs: true, estimatedCostMicros: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const usageByJob = new Map<string, typeof usageRows>();
  for (const usage of usageRows) {
    if (!usage.generationJobId) continue;
    const current = usageByJob.get(usage.generationJobId) ?? [];
    current.push(usage);
    usageByJob.set(usage.generationJobId, current);
  }

  return NextResponse.json({
    errors,
    total,
    limit,
    jobSummary: Object.fromEntries(jobGroups.map((item) => [item.status, item._count._all])),
    jobs: jobs.map((job) => {
      const scene = sceneForJob(job.type);
      const route = scene ? routes.find((item) => item.scene === scene) : undefined;
      const provider = route ? providers.find((item) => item.id === route.providerId) : undefined;
      const model = route ? routeModelCascade(route)[0] : undefined;
      const modality = scene === "comic_image_openai" ? "image" as const : "llm" as const;
      const operation = modality === "image" ? "image" as const : "text" as const;
      const estimate = provider && model ? configuredEstimateMicros(pricing, provider.protocol, model, modality, operation) : null;
      const usage = usageByJob.get(job.id) ?? [];
      const actualCostMicros = usage.reduce((sum, item) => sum + (item.estimatedCostMicros ?? 0), 0);
      const hasRecordedCost = usage.some((item) => item.estimatedCostMicros != null);
      const usageDurationMs = usage.reduce((sum, item) => sum + item.durationMs, 0);
      const successfulUsage = usage.filter((item) => item.status === "succeeded").length;
      const lastUsage = usage.at(-1);
      return ({
      ...job,
      progress: (() => { try { return job.progressJson ? JSON.parse(job.progressJson) : null; } catch { return null; } })(),
      progressJson: undefined,
      route: provider && model ? { scene, provider: provider.name, model } : null,
      usage: usage.length ? {
        calls: usage.length,
        succeeded: successfulUsage,
        durationMs: usageDurationMs,
        costMicros: hasRecordedCost ? actualCostMicros : null,
        provider: lastUsage?.provider ?? "unknown",
        model: lastUsage?.model ?? "unknown",
      } : null,
      cost: usage.length
        ? { estimatedMicros: hasRecordedCost ? actualCostMicros : null, status: "usage_ledger" as const }
        : estimate ? { estimatedMicros: estimate.estimatedCostMicros, status: "configured_estimate" as const }
        : { estimatedMicros: null, status: "not_configured" as const },
    });
    }),
  });
}
