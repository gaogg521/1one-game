import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOwnerKey } from "@/lib/owner";
import { parseGameSpec } from "@/lib/game-spec";
import { createProjectRecord } from "@/lib/project-create";
import { copyProjectCoverFile } from "@/lib/project-cover";
import { fetchCreativeBriefJson, saveCreativeBriefJson } from "@/lib/project-creative-brief-db";
import { rateLimit } from "@/lib/rate-limit";
import { getThrottleKey } from "@/lib/request-key";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: RouteContext) {
  const ownerKey = await getOwnerKey();
  if (!ownerKey) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const key = await getThrottleKey("dup", ownerKey);
  if (!rateLimit(key, 20, 60_000)) {
    return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
  }

  const { id } = await ctx.params;
  const source = await prisma.project.findUnique({ where: { id } });
  if (!source) {
    return NextResponse.json({ error: "未找到源作品" }, { status: 404 });
  }

  try {
    parseGameSpec(JSON.parse(source.specJson));
  } catch {
    return NextResponse.json({ error: "源作品数据损坏" }, { status: 500 });
  }

  const title =
    source.title.length > 70 ? `${source.title.slice(0, 68)}…（副本）` : `${source.title}（副本）`;

  const clone = await createProjectRecord({
    ownerKey,
    title,
    prompt: source.prompt,
    specJson: source.specJson,
    status: source.status,
  });

  if (source.coverPath) {
    const rel = await copyProjectCoverFile(source.id, clone.id);
    if (rel) {
      await prisma.project.update({ where: { id: clone.id }, data: { coverPath: rel } });
    }
  }

  const briefJson = await fetchCreativeBriefJson(source.id);
  if (briefJson?.trim()) {
    await saveCreativeBriefJson(clone.id, briefJson);
  }

  return NextResponse.json({
    project: { id: clone.id, title: clone.title, shareCode: clone.shareCode },
  });
}
