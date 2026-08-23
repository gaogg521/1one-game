import { NextResponse } from "next/server";
import { getOwnerKey } from "@/lib/owner";
import { LiteraryEngagementPayloadSchema } from "@/lib/literary-engagement";
import { prisma } from "@/lib/prisma";
import { isPrismaUniqueViolation } from "@/lib/prisma-errors";

export const runtime = "nodejs";

/** Privacy-safe novel/comic consumption telemetry; duplicate session events are idempotent. */
export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const parsed = LiteraryEngagementPayloadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_event" }, { status: 400 });
  const payload = parsed.data;
  const work = payload.workType === "novel"
    ? await prisma.novel.findUnique({ where: { id: payload.workId }, select: { ownerKey: true, visibility: true, status: true } })
    : await prisma.comic.findUnique({ where: { id: payload.workId }, select: { ownerKey: true, visibility: true, status: true } });
  if (!work || work.visibility !== "public" || work.status !== "ready") return NextResponse.json({ ok: true, ignored: "not_public" }, { status: 202 });
  if ((await getOwnerKey()) === work.ownerKey) return NextResponse.json({ ok: true, ignored: "owner" }, { status: 202 });
  const unitIndex = payload.unitIndex ?? 0;
  const existing = await prisma.literaryEngagementEvent.findUnique({
    where: {
      workType_workId_sessionId_event_unitIndex: {
        workType: payload.workType,
        workId: payload.workId,
        sessionId: payload.sessionId,
        event: payload.event,
        unitIndex,
      },
    },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ ok: true, duplicate: true }, { status: 202 });
  try {
    await prisma.literaryEngagementEvent.create({ data: { ...payload, unitIndex } });
  } catch (error) {
    if (!isPrismaUniqueViolation(error)) return NextResponse.json({ ok: false }, { status: 503 });
  }
  return NextResponse.json({ ok: true }, { status: 202 });
}
