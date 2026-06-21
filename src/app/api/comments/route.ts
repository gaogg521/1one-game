import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOwnerKey } from "@/lib/owner";

export const runtime = "nodejs";

const WORK_TYPES = ["game", "novel", "comic"] as const;
type WorkType = (typeof WORK_TYPES)[number];

function isWorkType(v: string): v is WorkType {
  return (WORK_TYPES as readonly string[]).includes(v);
}

/** GET /api/comments?workType=novel&workId=xxx&cursor=xxx&limit=20 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const workType = url.searchParams.get("workType") ?? "";
  const workId = url.searchParams.get("workId") ?? "";
  const cursor = url.searchParams.get("cursor");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 50);

  if (!isWorkType(workType) || !workId) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  let cursorDate: Date | undefined;
  if (cursor) {
    const cursorRow = await prisma.comment.findUnique({ where: { id: cursor }, select: { createdAt: true } });
    if (!cursorRow) {
      return NextResponse.json({ comments: [], nextCursor: null }, { status: 200 });
    }
    cursorDate = cursorRow.createdAt;
  }

  const rows = await prisma.comment.findMany({
    where: {
      workType,
      workId,
      ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    select: { id: true, nickname: true, content: true, createdAt: true, ownerKey: true },
  });

  const ownerKey = await getOwnerKey();
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return NextResponse.json({
    comments: page.map((c) => ({
      id: c.id,
      nickname: c.nickname,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      isOwn: !!ownerKey && c.ownerKey === ownerKey,
    })),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
  });
}

/** POST /api/comments */
export async function POST(req: NextRequest) {
  const ownerKey = await getOwnerKey();
  if (!ownerKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { workType?: string; workId?: string; content?: string; nickname?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { workType, workId, content, nickname } = body;
  if (!isWorkType(workType ?? "") || !workId || !content?.trim()) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  const trimmed = content.trim().slice(0, 500);
  const nick = (nickname?.trim() ?? "").slice(0, 30);

  const comment = await prisma.comment.create({
    data: { workType: workType!, workId, ownerKey, nickname: nick, content: trimmed },
    select: { id: true, nickname: true, content: true, createdAt: true },
  });

  return NextResponse.json({
    comment: {
      id: comment.id,
      nickname: comment.nickname,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      isOwn: true,
    },
  });
}
