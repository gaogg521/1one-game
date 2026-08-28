import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOwnerKey } from "@/lib/owner";
import { parseGameSpec } from "@/lib/game-spec";
import { normalizeAstrocadePlaySpec } from "@/lib/astrocade-play-spec";
import { prepareGameSpecForPersist } from "@/lib/spec-patch";
import { parseWorkGenerationFromUnknown } from "@/lib/work-generation-meta";
import { isPrismaUniqueViolation } from "@/lib/prisma-errors";
import { newShareCode } from "@/lib/share-code";
import { deleteProjectCoverFile, saveProjectCoverJpeg } from "@/lib/project-cover";
import { deleteGameAssetFiles } from "@/lib/game-assets-gc";
import { canDeleteOwnedResource, isSuperAdmin } from "@/lib/super-admin";
import { SAMPLE_GALLERY_OWNER } from "@/lib/sample-gallery";
import { rateLimit } from "@/lib/rate-limit";
import { getThrottleKey } from "@/lib/request-key";
import { parseRefinementLog } from "@/lib/refinement-log";
import { fetchRefinementLogJson } from "@/lib/project-refinement-db";
import {
  fetchCreativeBriefJson,
  parseStoredCreativeBrief,
  saveCreativeBriefJson,
} from "@/lib/project-creative-brief-db";
import {
  parseCreativeBriefBody,
  serializeCreativeBrief,
} from "@/lib/project-creative-brief-parse";
import { localizedJsonError, apiErrorFromUnknown } from "@/lib/api/localized-error";
import { canInspectAnyWork } from "@/lib/auth/admin";
import { assessGameCreatorQuality, withCreatorEngagementQuality } from "@/lib/creator-quality";
import { resolveCreatorWorkStage } from "@/lib/creator-workflow";
import { getAcceptedLegacyArtifact, getAcceptedLegacyPublicationDisplay, getLegacyCreativeProjectSnapshot } from "@/lib/creator-core/repository";
import { mirrorGameToCreatorCore } from "@/lib/creator-core/game-bridge";
import { buildGamePlaytestAdvice } from "@/lib/game-playtest-advice";
import { canAccessWorkByDirectLink } from "@/lib/literary-safety";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const ownerKey = await getOwnerKey();

  const row = await prisma.project.findUnique({ where: { id } });
  if (!row) {
    return localizedJsonError(req, "notFound", 404);
  }

  const isOwner = ownerKey && row.ownerKey === ownerKey;
  if (!isOwner && !(await canInspectAnyWork(req, ownerKey)) && !canAccessWorkByDirectLink(row)) {
    return localizedJsonError(req, "notFound", 404);
  }
  const likeCount = row.likeCount ?? 0;

  try {
    // A public reader must play exactly the revision the author confirmed at
    // publish time. Owners continue to see their current editable draft.
    const [acceptedGameSpec, acceptedDisplay] = !isOwner
      ? await Promise.all([
          getAcceptedLegacyArtifact({ legacyType: "project", legacyId: id, kind: "game_spec" }),
          getAcceptedLegacyPublicationDisplay({ legacyType: "project", legacyId: id }),
        ])
      : [null, null];
    const storedSpec = acceptedGameSpec?.content && typeof acceptedGameSpec.content === "object"
      ? acceptedGameSpec.content
      : JSON.parse(row.specJson);
    const spec = normalizeAstrocadePlaySpec(parseGameSpec(storedSpec));

    let refinementHistory: ReturnType<typeof parseRefinementLog> | undefined;
    let creativeBrief: ReturnType<typeof parseStoredCreativeBrief> = null;
    const core = isOwner
      ? await getLegacyCreativeProjectSnapshot({ ownerKey: ownerKey!, legacyType: "project", legacyId: id })
      : null;
    const playRevisionId = isOwner ? core?.revision?.id ?? null : acceptedGameSpec?.creativeRevisionId ?? null;
    const assetJob = isOwner && core
      ? await prisma.generationJob.findFirst({
          where: {
            creativeProjectId: core.project.id,
            type: "game_asset",
            status: { in: ["queued", "running", "retrying"] },
          },
          orderBy: { createdAt: "desc" },
          select: { id: true, status: true, attempts: true, maxAttempts: true, progressJson: true },
        })
      : null;
    let assetJobProgress: unknown = null;
    if (assetJob?.progressJson) {
      try { assetJobProgress = JSON.parse(assetJob.progressJson); } catch { /* corrupted progress stays hidden */ }
    }
    if (isOwner) {
      const logRaw = await fetchRefinementLogJson(id);
      refinementHistory = parseRefinementLog(logRaw).slice(-12);
      const briefRaw = await fetchCreativeBriefJson(id);
      creativeBrief = parseStoredCreativeBrief(briefRaw);
    }

    // A Windows process can retain a Prisma Client generated before the
    // GameplayEvent migration. Do not make an otherwise playable work appear
    // corrupt while that process is waiting for a safe restart/regeneration.
    const gameplayEvents = prisma.gameplayEvent
      ? await prisma.gameplayEvent.findMany({
          where: { projectId: id, ...(playRevisionId ? { creativeRevisionId: playRevisionId } : {}) },
          select: { event: true, sessionId: true, elapsedMs: true, won: true },
        })
      : [];
    const startedSessions = new Set(gameplayEvents.filter((event) => event.event === "start").map((event) => event.sessionId));
    const firstActionSessions = new Set(gameplayEvents.filter((event) => event.event === "first_action").map((event) => event.sessionId));
    const firstMinuteSessions = new Set(gameplayEvents.filter((event) => event.event === "first_minute").map((event) => event.sessionId));
    const retries = gameplayEvents.filter((event) => event.event === "retry").length;
    const failedEnds = gameplayEvents.filter((event) => event.event === "end" && event.won === false);
    const sampleSize = startedSessions.size;
    const baseQuality = assessGameCreatorQuality(spec, creativeBrief).report;
    const quality = withCreatorEngagementQuality(baseQuality, {
      sampleSize,
      starts: sampleSize,
      ...(sampleSize > 0 ? { firstActionRate: Math.round((firstActionSessions.size / sampleSize) * 1000) / 10 } : {}),
      ...(sampleSize > 0 ? { firstMinuteRate: Math.round((firstMinuteSessions.size / sampleSize) * 1000) / 10 } : {}),
      ...(sampleSize > 0 ? { retryRate: Math.round((retries / sampleSize) * 1000) / 10 } : {}),
      ...(failedEnds.length > 0
        ? { averageFailureSec: Math.round(failedEnds.reduce((sum, event) => sum + (event.elapsedMs ?? 0), 0) / failedEnds.length / 1000) }
        : {}),
    });
    return NextResponse.json({
      project: {
        id: row.id,
        title: acceptedDisplay?.title?.trim() || row.title,
        prompt: acceptedDisplay?.prompt?.trim() || row.prompt,
        createdAt: row.createdAt,
        shareCode: row.shareCode,
        coverPath: acceptedDisplay?.coverPath?.trim() || row.coverPath,
        likeCount,
        playCount: row.playCount,
        status: row.status,
        visibility: row.visibility,
        workflow: { stage: resolveCreatorWorkStage({ status: row.status, visibility: row.visibility, quality }) },
        quality,
        isOwner: Boolean(isOwner),
        isSampleGallery: row.ownerKey === SAMPLE_GALLERY_OWNER,
        ...(isOwner
          ? {
              generationProvider: row.generationProvider,
              generationModel: row.generationModel,
            }
          : {}),
      },
      spec,
      ...(playRevisionId ? { playRevisionId } : {}),
      ...(creativeBrief ? { creativeBrief } : {}),
      ...(refinementHistory !== undefined ? { refinementHistory } : {}),
      ...(core ? { core } : {}),
      ...(assetJob ? { assetJob: { id: assetJob.id, status: assetJob.status, attempts: assetJob.attempts, maxAttempts: assetJob.maxAttempts, progress: assetJobProgress } } : {}),
      ...(isOwner ? { playtestAdvice: buildGamePlaytestAdvice(quality.engagement ?? { sampleSize: 0 }) } : {}),
    });
  } catch (error) {
    console.error("[GET /api/projects/:id]", error);
    return localizedJsonError(req, "corruptWork", 500);
  }
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const ownerKey = await getOwnerKey();
  if (!ownerKey) {
    return localizedJsonError(req, "unauthorized", 401);
  }

  const throttleKey = await getThrottleKey("proj_patch", ownerKey);
  if (!rateLimit(throttleKey, 60, 60_000)) {
    return localizedJsonError(req, "rateLimited", 429);
  }

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return localizedJsonError(req, "badJson", 400);
  }

  const row = await prisma.project.findUnique({ where: { id } });
  if (!row || row.ownerKey !== ownerKey) {
    return localizedJsonError(req, "notFound", 404);
  }

  const coverJpegBase64 =
    typeof body === "object" && body !== null && "coverJpegBase64" in body
      ? String((body as { coverJpegBase64?: unknown }).coverJpegBase64 ?? "")
      : undefined;

  if (coverJpegBase64 !== undefined && coverJpegBase64.length > 0) {
    try {
      const rel = await saveProjectCoverJpeg(id, coverJpegBase64);
      await prisma.project.update({ where: { id }, data: { coverPath: rel } });
    } catch (e) {
      return NextResponse.json({ error: apiErrorFromUnknown(req, e, "coverSaveFailed") }, { status: 400 });
    }
  }

  const titleRaw =
    typeof body === "object" && body !== null && "title" in body
      ? String((body as { title?: unknown }).title ?? "")
      : undefined;
  const ensureShareCode =
    typeof body === "object" &&
    body !== null &&
    "ensureShareCode" in body &&
    Boolean((body as { ensureShareCode?: unknown }).ensureShareCode);
  const promptRaw =
    typeof body === "object" && body !== null && "prompt" in body
      ? String((body as { prompt?: unknown }).prompt ?? "")
      : undefined;
  const specRaw =
    typeof body === "object" && body !== null && "spec" in body
      ? (body as { spec?: unknown }).spec
      : undefined;
  const briefRaw =
    typeof body === "object" && body !== null && "creativeBrief" in body
      ? (body as { creativeBrief?: unknown }).creativeBrief
      : undefined;

  if (titleRaw !== undefined) {
    const t = titleRaw.trim().slice(0, 80);
    if (t.length < 1) {
      return localizedJsonError(req, "titleEmpty", 400);
    }
    await prisma.project.update({ where: { id }, data: { title: t } });
  }

  if (promptRaw !== undefined || specRaw !== undefined) {
    const updateData: {
      prompt?: string;
      title?: string;
      specJson?: string;
      status?: string;
      generationProvider?: string | null;
      generationModel?: string | null;
    } = {};

    if (promptRaw !== undefined) {
      const nextPrompt = promptRaw.trim().slice(0, 4000);
      if (nextPrompt.length < 1) {
        return localizedJsonError(req, "promptEmpty", 400);
      }
      updateData.prompt = nextPrompt;
    }

    if (specRaw !== undefined) {
      try {
        const spec = prepareGameSpecForPersist(
          specRaw,
          typeof promptRaw === "string" ? promptRaw.trim() : "",
        );
        updateData.specJson = JSON.stringify(spec);
        updateData.title = spec.title;
        updateData.status = "ready";
        const generation = parseWorkGenerationFromUnknown(body);
        if (generation.generationModel || generation.generationProvider) {
          updateData.generationProvider = generation.generationProvider;
          updateData.generationModel = generation.generationModel;
        }
      } catch {
        return localizedJsonError(req, "specSaveInvalid", 400);
      }
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.project.update({ where: { id }, data: updateData });
    }
  }

  if (briefRaw !== undefined) {
    const brief = parseCreativeBriefBody(briefRaw);
    if (!brief) {
      return localizedJsonError(req, "briefInvalid", 400);
    }
    await saveCreativeBriefJson(id, serializeCreativeBrief(brief));
  }

  let shareCode = row.shareCode;
  if (ensureShareCode && !shareCode) {
    for (let attempt = 0; attempt < 14; attempt += 1) {
      const code = newShareCode();
      try {
        await prisma.project.update({
          where: { id },
          data: { shareCode: code },
        });
        shareCode = code;
        break;
      } catch (e) {
        if (!isPrismaUniqueViolation(e)) throw e;
      }
    }
  }

  const fresh = await prisma.project.findUnique({
    where: { id },
    select: { id: true, ownerKey: true, title: true, shareCode: true, coverPath: true, prompt: true, status: true, specJson: true, visibility: true, creativeBriefJson: true },
  });
  let core: { creativeProjectId: string; creativeRevisionId: string } | { status: "degraded" } | undefined;
  // Cover/background delivery is an asset mutation on the current gameplay
  // revision, not a new gameplay design. Creating a revision for cover-only
  // updates races active playtests and strands their exact-revision evidence.
  if (fresh && (titleRaw !== undefined || promptRaw !== undefined || specRaw !== undefined || briefRaw !== undefined)) {
    try {
      core = await mirrorGameToCreatorCore({ project: fresh, cause: "refine" });
    } catch (error) {
      console.error("[game-core-mirror]", { projectId: id, error });
      core = { status: "degraded" };
    }
  }

  return NextResponse.json({
    project: {
      id,
      title: fresh?.title ?? row.title,
      prompt: fresh?.prompt ?? row.prompt,
      shareCode: fresh?.shareCode ?? shareCode,
      coverPath: fresh?.coverPath ?? row.coverPath,
      status: fresh?.status ?? row.status,
    },
    ...(core ? { core } : {}),
  });
}

export async function DELETE(req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const ownerKey = await getOwnerKey();
  if (!ownerKey && !isSuperAdmin(req)) {
    return localizedJsonError(req, "unauthorized", 401);
  }

  const row = await prisma.project.findUnique({ where: { id } });
  if (!row) {
    return localizedJsonError(req, "notFound", 404);
  }
  if (!canDeleteOwnedResource(row.ownerKey, ownerKey, req)) {
    return localizedJsonError(req, "notFound", 404);
  }

  await deleteProjectCoverFile(id);
  await deleteGameAssetFiles(id);
  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
