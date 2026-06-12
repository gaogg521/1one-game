import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOwnerKey } from "@/lib/owner";
import { parseGameSpec } from "@/lib/game-spec";
import { prepareGameSpecForPersist } from "@/lib/spec-patch";
import { isPrismaUniqueViolation } from "@/lib/prisma-errors";
import { newShareCode } from "@/lib/share-code";
import { deleteProjectCoverFile, saveProjectCoverJpeg } from "@/lib/project-cover";
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
import { localizedApiErrorText, localizedJsonError, apiErrorFromUnknown } from "@/lib/api/localized-error";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const ownerKey = await getOwnerKey();

  const row = await prisma.project.findUnique({ where: { id } });
  if (!row) {
    return localizedJsonError(req, "notFound", 404);
  }

  const isOwner = ownerKey && row.ownerKey === ownerKey;

  // Fetch likeCount via raw query (added after last prisma generate)
  let likeCount = 0;
  try {
    const rows = await prisma.$queryRaw<{ likeCount: number }[]>`SELECT likeCount FROM "Project" WHERE id = ${id}`;
    likeCount = rows[0]?.likeCount ?? 0;
  } catch {
    likeCount = 0;
  }

  try {
    const spec = parseGameSpec(JSON.parse(row.specJson));

    let refinementHistory: ReturnType<typeof parseRefinementLog> | undefined;
    let creativeBrief: ReturnType<typeof parseStoredCreativeBrief> = null;
    if (isOwner) {
      const logRaw = await fetchRefinementLogJson(id);
      refinementHistory = parseRefinementLog(logRaw).slice(-12);
      const briefRaw = await fetchCreativeBriefJson(id);
      creativeBrief = parseStoredCreativeBrief(briefRaw);
    }

    return NextResponse.json({
      project: {
        id: row.id,
        title: row.title,
        prompt: row.prompt,
        createdAt: row.createdAt,
        shareCode: row.shareCode,
        coverPath: row.coverPath,
        likeCount,
        isOwner: Boolean(isOwner),
        isSampleGallery: row.ownerKey === SAMPLE_GALLERY_OWNER,
      },
      spec,
      ...(creativeBrief ? { creativeBrief } : {}),
      ...(refinementHistory !== undefined ? { refinementHistory } : {}),
    });
  } catch {
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
    select: { title: true, shareCode: true, coverPath: true, prompt: true, status: true },
  });

  return NextResponse.json({
    project: {
      id,
      title: fresh?.title ?? row.title,
      prompt: fresh?.prompt ?? row.prompt,
      shareCode: fresh?.shareCode ?? shareCode,
      coverPath: fresh?.coverPath ?? row.coverPath,
      status: fresh?.status ?? row.status,
    },
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
  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
