import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOwnerKey } from "@/lib/owner";
import { pickLastRefinementEntry } from "@/lib/refinement-log";
import { fetchRefinementLogJsonBatch } from "@/lib/project-refinement-db";
import { prepareGameSpecForPersist } from "@/lib/spec-patch";
import { createProjectRecord } from "@/lib/project-create";
import {
  parseCreativeBriefBody,
  serializeCreativeBrief,
} from "@/lib/project-creative-brief-parse";
import { saveCreativeBriefJson } from "@/lib/project-creative-brief-db";
import { scheduleProjectAssetPipeline } from "@/lib/game-asset-pipeline";
import { buildFallbackAgenticModule, shouldUseAgenticRuntime, shouldUseDedicatedSceneForTemplateFirst } from "@/lib/agentic/game-module";
import { generateAgenticGameModule } from "@/lib/agentic/generate-game-module";
import { requiresBespokeRuntime } from "@/lib/game-runtime-policy";
import { PRODUCT } from "@/lib/product-config";
import { rateLimit } from "@/lib/rate-limit";
import { getThrottleKey } from "@/lib/request-key";
import { localizedJsonError, apiErrorFromUnknown } from "@/lib/api/localized-error";
import { assessGameCreatorQuality } from "@/lib/creator-quality";
import { resolveCreatorWorkStage } from "@/lib/creator-workflow";
import { defaultWorkVisibility } from "@/lib/auth/work-visibility";
import { visibilityWithQualityGuard } from "@/lib/creator-publication";
import { mirrorGameToCreatorCore } from "@/lib/creator-core/game-bridge";
import { enqueueGenerationJob } from "@/lib/creator-core/jobs";
import { recordCreatorFunnelEvent } from "@/lib/creator-funnel";
import { parseWorkGenerationFromUnknown } from "@/lib/work-generation-meta";
import { resolveRequestLocaleSync } from "@/lib/i18n/request-locale";

export async function GET(req: Request) {
  const ownerKey = await getOwnerKey();
  if (!ownerKey) {
    return localizedJsonError(req, "unauthorized", 401);
  }
  const projects = await prisma.project.findMany({
    where: { ownerKey },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      prompt: true,
      status: true,
      shareCode: true,
      coverPath: true,
      playCount: true,
      likeCount: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const logMap = await fetchRefinementLogJsonBatch(projects.map((p) => p.id));
  const projectsWithRefine = projects.map((p) => {
    const last = pickLastRefinementEntry(logMap.get(p.id));
    return last
      ? {
          ...p,
          lastRefinement: {
            mode: last.mode,
            instruction: last.instruction,
            at: last.at,
          },
        }
      : p;
  });
  return NextResponse.json({ projects: projectsWithRefine });
}

export async function POST(req: Request) {
  const ownerKey = await getOwnerKey();
  if (!ownerKey) {
    return localizedJsonError(req, "unauthorized", 401);
  }

  const throttleKey = await getThrottleKey("proj_post", ownerKey);
  if (!rateLimit(throttleKey, 40, 60_000)) {
    return localizedJsonError(req, "rateLimited", 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return localizedJsonError(req, "badJson", 400);
  }

  const prompt =
    typeof body === "object" && body !== null && "prompt" in body
      ? String((body as { prompt?: unknown }).prompt ?? "")
      : "";
  const specRaw =
    typeof body === "object" && body !== null && "spec" in body
      ? (body as { spec?: unknown }).spec
      : undefined;
  const briefRaw =
    typeof body === "object" && body !== null && "creativeBrief" in body
      ? (body as { creativeBrief?: unknown }).creativeBrief
      : undefined;

  const trimmed = prompt.trim();
  if (trimmed.length < 1) {
    return localizedJsonError(req, "missingPrompt", 400);
  }

  try {
    let spec = prepareGameSpecForPersist(specRaw, trimmed, resolveRequestLocaleSync(req));
    if (PRODUCT.game.agenticModuleEnabled && requiresBespokeRuntime(spec) && !shouldUseAgenticRuntime(spec)) {
      const generated = await generateAgenticGameModule(trimmed, { ...spec, agenticPlayRoute: "agentic" });
      if (!generated.ok) {
        return localizedJsonError(req, "gameRuntimeGenerationFailed", 422);
      }
      spec = { ...spec, agenticPlayRoute: "agentic", agenticModule: generated.module };
    } else if (
      PRODUCT.game.agenticModuleEnabled &&
      !shouldUseAgenticRuntime(spec) &&
      !shouldUseDedicatedSceneForTemplateFirst(spec)
    ) {
      spec = { ...spec, agenticModule: buildFallbackAgenticModule(spec.title, spec) };
    }
    const brief = briefRaw !== undefined ? parseCreativeBriefBody(briefRaw) : null;
    const briefJson = brief ? serializeCreativeBrief(brief) : null;
    const { report: quality } = assessGameCreatorQuality(spec, brief);
    const generation = parseWorkGenerationFromUnknown(body);
    const uiLocale = resolveRequestLocaleSync(req);
    const project = await createProjectRecord({
      ownerKey,
      title: spec.title,
      prompt: trimmed,
      specJson: JSON.stringify(spec),
      creativeBriefJson: briefJson,
      status: "ready",
      visibility: visibilityWithQualityGuard(defaultWorkVisibility(), quality),
      generationProvider: generation.generationProvider,
      generationModel: generation.generationModel,
    });
    await recordCreatorFunnelEvent({ event: "create", workType: "game" });
    if (briefJson && !project.creativeBriefJson) {
      await saveCreativeBriefJson(project.id, briefJson);
    }
    let core: { creativeProjectId: string; creativeRevisionId: string } | { status: "degraded" };
    let assetJob: { id: string; status: string } | undefined;
    try {
      core = await mirrorGameToCreatorCore({ project, cause: "generate", deferFinalization: true });
      const job = await enqueueGenerationJob({
        creativeProjectId: core.creativeProjectId,
        creativeRevisionId: core.creativeRevisionId,
        type: "game_production",
        idempotencyKey: `game-production:${project.id}:${core.creativeRevisionId}`,
        payload: { projectId: project.id, ownerKey, spec, brief, uiLocale },
      });
      assetJob = { id: job.id, status: job.status };
    } catch (error) {
      console.error("[game-core-mirror]", { projectId: project.id, error });
      core = { status: "degraded" };
      // Preserve the legacy non-blocking path only when Core persistence is unavailable.
      scheduleProjectAssetPipeline({ projectId: project.id, spec, brief, uiLocale });
    }
    return NextResponse.json({
      project: {
        id: project.id,
        title: project.title,
        shareCode: project.shareCode,
        workflow: { stage: resolveCreatorWorkStage({ status: project.status, visibility: project.visibility, quality }) },
        quality,
      },
      core,
      ...(assetJob ? { assetJob } : {}),
      ...(assetJob ? { productionJob: assetJob } : {}),
    });
  } catch (e) {
    return NextResponse.json({ error: apiErrorFromUnknown(req, e, "saveFailed") }, { status: 400 });
  }
}
