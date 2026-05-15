import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOwnerKey } from "@/lib/owner";
import { parseGameSpec } from "@/lib/game-spec";
import { createProjectRecord } from "@/lib/project-create";
import { rateLimit } from "@/lib/rate-limit";
import { getThrottleKey } from "@/lib/request-key";

export async function GET() {
  const ownerKey = await getOwnerKey();
  if (!ownerKey) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
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
  return NextResponse.json({ projects });
}

export async function POST(req: Request) {
  const ownerKey = await getOwnerKey();
  if (!ownerKey) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const throttleKey = await getThrottleKey("proj_post", ownerKey);
  if (!rateLimit(throttleKey, 40, 60_000)) {
    return NextResponse.json({ error: "请求过于频繁" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的 JSON" }, { status: 400 });
  }

  const prompt =
    typeof body === "object" && body !== null && "prompt" in body
      ? String((body as { prompt?: unknown }).prompt ?? "")
      : "";
  const specRaw =
    typeof body === "object" && body !== null && "spec" in body
      ? (body as { spec?: unknown }).spec
      : undefined;

  const trimmed = prompt.trim();
  if (trimmed.length < 1) {
    return NextResponse.json({ error: "缺少 prompt" }, { status: 400 });
  }

  try {
    const spec = parseGameSpec(specRaw);
    const project = await createProjectRecord({
      ownerKey,
      title: spec.title,
      prompt: trimmed,
      specJson: JSON.stringify(spec),
      status: "ready",
    });
    return NextResponse.json({
      project: { id: project.id, title: project.title, shareCode: project.shareCode },
    });
  } catch {
    return NextResponse.json({ error: "保存失败，规格无效" }, { status: 400 });
  }
}
