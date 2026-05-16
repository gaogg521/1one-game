import { NextResponse } from "next/server";
import { generationErrorCodes } from "@/lib/api/json-error-response";
import { newGenerateRequestId, ridHeaders } from "@/lib/api/request-id";
import { ensureNovelCoverAfterCreate } from "@/lib/cover-generation";
import { deleteNovelCoverFile } from "@/lib/novel-cover-persist";
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
    await prisma.novel.update({ where: { id }, data: { coverPath: null } });
  }

  const coverPath = await ensureNovelCoverAfterCreate(
    row.id,
    row.title,
    row.summary ?? "",
    row.prompt,
    600_000,
  );

  if (!coverPath) {
    return NextResponse.json(
      { error: "封面生成失败，请检查 IMAGE_GEN_* / GEMINI_API_KEY 配置", code: codes.LLM_FAILED, requestId },
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
