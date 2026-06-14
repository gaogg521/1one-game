import { NextResponse } from "next/server";
import { generationErrorCodes } from "@/lib/api/json-error-response";
import { localizedApiErrorPayload } from "@/lib/api/localized-error";
import { newGenerateRequestId, ridHeaders } from "@/lib/api/request-id";
import { ensureComicCoverAfterCreate } from "@/lib/cover-generation";
import { resolveComicStoryContext } from "@/lib/comic-story-genre";
import { gateGenerationQuota } from "@/lib/commerce/generation-gate";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/** 为已有漫画补生成封面（广场/列表无封面时可用） */
export async function POST(req: Request, ctx: RouteContext) {
  const codes = generationErrorCodes();
  const requestId = newGenerateRequestId();
  const { id } = await ctx.params;
  const force = new URL(req.url).searchParams.get("force") === "1";

  const row = await prisma.comic.findUnique({ where: { id } });
  if (!row) {
    return NextResponse.json(
      localizedApiErrorPayload(req, "notFound", { code: codes.BAD_REQUEST, requestId }),
      { status: 404, headers: ridHeaders(requestId) },
    );
  }

  if (row.coverPath && !force) {
    return NextResponse.json(
      { ok: true, coverPath: row.coverPath, comic: { id: row.id, coverPath: row.coverPath } },
      { headers: ridHeaders(requestId) },
    );
  }

  const quotaBlock = await gateGenerationQuota("cover", { refId: id });
  if (quotaBlock) {
    const body = await quotaBlock.json();
    return NextResponse.json(body, { status: 402, headers: ridHeaders(requestId) });
  }

  const ctxStory = await resolveComicStoryContext(row);
  const storyHint = row.prompt?.trim() || ctxStory.summary.slice(0, 800);

  const coverPath = await ensureComicCoverAfterCreate(
    row.id,
    ctxStory.title,
    ctxStory.summary,
    storyHint,
    600_000,
    ctxStory.genre,
  );

  if (!coverPath) {
    return NextResponse.json(
      localizedApiErrorPayload(req, "coverGenFailed", { code: codes.LLM_FAILED, requestId }),
      { status: 502, headers: ridHeaders(requestId) },
    );
  }

  const fresh = await prisma.comic.findUnique({
    where: { id },
    select: { id: true, title: true, coverPath: true },
  });

  return NextResponse.json({ ok: true, coverPath, comic: fresh }, { headers: ridHeaders(requestId) });
}
