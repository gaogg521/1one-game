import { NextResponse } from "next/server";
import { generationErrorCodes } from "@/lib/api/json-error-response";
import { newGenerateRequestId, ridHeaders } from "@/lib/api/request-id";
import { ensureNovelCoverAfterCreate } from "@/lib/cover-generation";
import { resolveNovelCoverGenre } from "@/lib/cover-genre";
import { inferNovelGenreTagFromStoredPrompt } from "@/lib/novel-genre-tags";
import { deleteNovelCoverFile } from "@/lib/novel-cover-persist";
import { persistNovelCoverPath } from "@/lib/cover-path-db";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/** 为已有小说补生成封面（广场/列表无封面时可用） */
export async function POST(req: Request, ctx: RouteContext) {
  const codes = generationErrorCodes();
  const requestId = newGenerateRequestId();
  const { id } = await ctx.params;
  const force = new URL(req.url).searchParams.get("force") === "1";

  const row = await prisma.novel.findUnique({ where: { id } });
  if (!row) {
    return NextResponse.json(
      { error: "小说不存在", code: codes.BAD_REQUEST, requestId },
      { status: 404, headers: ridHeaders(requestId) },
    );
  }

  if (row.coverPath && !force) {
    return NextResponse.json(
      { ok: true, coverPath: row.coverPath, novel: { id: row.id, coverPath: row.coverPath } },
      { headers: ridHeaders(requestId) },
    );
  }

  if (force && row.coverPath) {
    await deleteNovelCoverFile(row.id);
    await persistNovelCoverPath(id, null);
  }

  const storyHint = [row.prompt, row.content?.slice(0, 800)]
    .filter(Boolean)
    .join(" ")
    .trim();
  const tagFromPrompt = inferNovelGenreTagFromStoredPrompt(row.prompt);
  const genre = resolveNovelCoverGenre({
    genreTagCoverGenre: tagFromPrompt?.coverGenre,
    title: row.title,
    summary: row.summary,
    prompt: row.prompt,
    contentSnippet: row.content?.slice(0, 1200),
  });

  const coverPath = await ensureNovelCoverAfterCreate(
    row.id,
    row.title,
    row.summary ?? "",
    storyHint || row.prompt,
    600_000,
    genre,
  );

  if (!coverPath) {
    return NextResponse.json(
      { error: "封面生成失败，请检查 OPENAI_API_KEY / GEMINI_API_KEY 是否已配置", code: codes.LLM_FAILED, requestId },
      { status: 502, headers: ridHeaders(requestId) },
    );
  }

  const fresh = await prisma.novel.findUnique({
    where: { id },
    select: { id: true, title: true, coverPath: true },
  });

  return NextResponse.json(
    { ok: true, coverPath, novel: fresh },
    { headers: ridHeaders(requestId) },
  );
}
