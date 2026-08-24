import { NextResponse } from "next/server";
import { requireAdminCapability } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";
import { getEffectiveRoutes, loadRuntimeConfig } from "@/lib/runtime-config";
import { getEffectiveProviders, routeModelCascade, type RuntimeSceneKey } from "@/lib/runtime-providers";

function sceneForJob(type: string): RuntimeSceneKey | null {
  if (type === "game_asset" || type === "game_build") return "game_text";
  if (type === "novel_continue" || type === "novel_plan" || type === "novel_scene") return "novel";
  if (type === "comic_panel") return "comic_image_openai";
  return null;
}

function configuredEstimateMicros(
  pricing: { provider: string; model: string; modality: "llm" | "image"; operation: "json" | "text" | "image" | "image_batch"; estimatedCostMicros: number }[],
  provider: string,
  model: string,
  modality: "llm" | "image",
  operation: "json" | "text" | "image" | "image_batch",
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

  const where: Record<string, unknown> = {};
  if (contentType) where.contentType = contentType;
  if (errorType) where.errorType = errorType;
  if (Number.isFinite(sinceDays) && sinceDays > 0) {
    where.createdAt = { gte: new Date(Date.now() - sinceDays * 86_400_000) };
  }

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
      where: { status: { in: ["queued", "running", "retrying", "failed"] } },
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
      const estimate = provider && model ? configuredEstimateMicros(pricing, provider.name, model, modality, operation) : null;
      return ({
      ...job,
      progress: (() => { try { return job.progressJson ? JSON.parse(job.progressJson) : null; } catch { return null; } })(),
      progressJson: undefined,
      route: provider && model ? { scene, provider: provider.name, model } : null,
      cost: estimate ? { estimatedMicros: estimate.estimatedCostMicros, status: "configured_estimate" as const } : { estimatedMicros: null, status: "not_configured" as const },
    });
    }),
  });
}
