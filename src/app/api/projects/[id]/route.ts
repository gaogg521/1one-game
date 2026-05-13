import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOwnerKey } from "@/lib/owner";
import { parseGameSpec } from "@/lib/game-spec";
import { isPrismaUniqueViolation } from "@/lib/prisma-errors";
import { newShareCode } from "@/lib/share-code";
import { deleteProjectCoverFile, saveProjectCoverJpeg } from "@/lib/project-cover";
import { rateLimit } from "@/lib/rate-limit";
import { getThrottleKey } from "@/lib/request-key";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const ownerKey = await getOwnerKey();

  const row = await prisma.project.findUnique({ where: { id } });
  if (!row) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }

  const isOwner = ownerKey && row.ownerKey === ownerKey;
  try {
    const spec = parseGameSpec(JSON.parse(row.specJson));
    return NextResponse.json({
      project: {
        id: row.id,
        title: row.title,
        prompt: row.prompt,
        createdAt: row.createdAt,
        shareCode: row.shareCode,
        coverPath: row.coverPath,
        isOwner: Boolean(isOwner),
      },
      spec,
    });
  } catch {
    return NextResponse.json({ error: "损坏的作品数据" }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const ownerKey = await getOwnerKey();
  if (!ownerKey) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const throttleKey = await getThrottleKey("proj_patch", ownerKey);
  if (!rateLimit(throttleKey, 60, 60_000)) {
    return NextResponse.json({ error: "请求过于频繁" }, { status: 429 });
  }

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的 JSON" }, { status: 400 });
  }

  const row = await prisma.project.findUnique({ where: { id } });
  if (!row || row.ownerKey !== ownerKey) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
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
      const msg = e instanceof Error ? e.message : "封面保存失败";
      return NextResponse.json({ error: msg }, { status: 400 });
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

  if (titleRaw !== undefined) {
    const t = titleRaw.trim().slice(0, 80);
    if (t.length < 1) {
      return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
    }
    await prisma.project.update({ where: { id }, data: { title: t } });
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
    select: { title: true, shareCode: true, coverPath: true },
  });

  return NextResponse.json({
    project: {
      id,
      title: fresh?.title ?? row.title,
      shareCode: fresh?.shareCode ?? shareCode,
      coverPath: fresh?.coverPath ?? row.coverPath,
    },
  });
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const ownerKey = await getOwnerKey();
  if (!ownerKey) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const row = await prisma.project.findUnique({ where: { id } });
  if (!row || row.ownerKey !== ownerKey) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }

  await deleteProjectCoverFile(id);
  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
