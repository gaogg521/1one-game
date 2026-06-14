import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "50", 10) || 50));
  const action = url.searchParams.get("action")?.trim();
  const q = url.searchParams.get("q")?.trim();
  const actorUserId = url.searchParams.get("actorUserId")?.trim();
  const sinceDays = Number.parseInt(url.searchParams.get("sinceDays") ?? "", 10);

  const where: Prisma.AdminAuditLogWhereInput = {};

  if (action) where.action = { contains: action };
  if (actorUserId) where.actorUserId = actorUserId;
  if (Number.isFinite(sinceDays) && sinceDays > 0) {
    where.createdAt = { gte: new Date(Date.now() - sinceDays * 86_400_000) };
  }
  if (q) {
    where.OR = [
      { action: { contains: q } },
      { targetType: { contains: q } },
      { targetId: { contains: q } },
      { detailJson: { contains: q } },
      { actorOwnerKey: { contains: q } },
    ];
  }

  const logs = await prisma.adminAuditLog.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      targetType: true,
      targetId: true,
      detailJson: true,
      actorUserId: true,
      actorOwnerKey: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ logs, limit, filters: { action: action ?? null, q: q ?? null, sinceDays: sinceDays || null } });
}
