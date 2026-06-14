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
import { generateGameSprites } from "@/lib/game-sprite-gen";
import { generateGameBackground } from "@/lib/game-background-gen";
import { buildFallbackAgenticModule, shouldUseAgenticRuntime, shouldUseDedicatedSceneForTemplateFirst } from "@/lib/agentic/game-module";
import { PRODUCT } from "@/lib/product-config";
import { rateLimit } from "@/lib/rate-limit";
import { getThrottleKey } from "@/lib/request-key";
import { localizedJsonError, apiErrorFromUnknown } from "@/lib/api/localized-error";

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
    let spec = prepareGameSpecForPersist(specRaw, trimmed);
    if (
      PRODUCT.game.agenticModuleEnabled &&
      !shouldUseAgenticRuntime(spec) &&
      !shouldUseDedicatedSceneForTemplateFirst(spec)
    ) {
      spec = { ...spec, agenticModule: buildFallbackAgenticModule(spec.title, spec) };
    }
    const brief = briefRaw !== undefined ? parseCreativeBriefBody(briefRaw) : null;
    const briefJson = brief ? serializeCreativeBrief(brief) : null;
    const project = await createProjectRecord({
      ownerKey,
      title: spec.title,
      prompt: trimmed,
      specJson: JSON.stringify(spec),
      creativeBriefJson: briefJson,
      status: "ready",
    });
    if (briefJson && !project.creativeBriefJson) {
      await saveCreativeBriefJson(project.id, briefJson);
    }
    // 后台静默触发精灵/背景生成（不阻塞响应；服务端已有缓存检查，重复无害）
    void generateGameSprites(project.id, spec).catch(() => {});
    void generateGameBackground(project.id, spec).catch(() => {});
    return NextResponse.json({
      project: { id: project.id, title: project.title, shareCode: project.shareCode },
    });
  } catch (e) {
    return NextResponse.json({ error: apiErrorFromUnknown(req, e, "saveFailed") }, { status: 400 });
  }
}
