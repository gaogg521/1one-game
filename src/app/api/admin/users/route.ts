import { NextResponse } from "next/server";
import { requireAdmin, writeAdminAudit } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";
import { localizedJsonError } from "@/lib/api/localized-error";

export async function GET(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 100);
  const q = searchParams.get("q")?.trim();

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { displayName: { contains: q } },
            { email: { contains: q } },
            { referralCode: { contains: q } },
            { legacyOwnerKey: { contains: q } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      oauthAccounts: { select: { provider: true } },
      _count: { select: { referrals: true, sessions: true } },
    },
  });

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      displayName: u.displayName,
      email: u.email,
      role: u.role,
      referralCode: u.referralCode,
      legacyOwnerKey: u.legacyOwnerKey,
      providers: u.oauthAccounts.map((a) => a.provider),
      referralCount: u._count.referrals,
      sessionCount: u._count.sessions,
      createdAt: u.createdAt.toISOString(),
    })),
  });
}

export async function PATCH(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = (await req.json()) as { id?: string; role?: string };
  if (!body.id || !body.role) return localizedJsonError(req, "adminMissingIdRole", 400);
  if (!["user", "admin", "super_admin"].includes(body.role)) {
    return localizedJsonError(req, "adminInvalidRole", 400);
  }
  if (body.role === "super_admin" && gate.user?.role !== "super_admin") {
    return localizedJsonError(req, "adminSuperAdminOnly", 403);
  }

  await prisma.user.update({ where: { id: body.id }, data: { role: body.role } });
  await writeAdminAudit({
    req,
    action: "user_role",
    targetType: "user",
    targetId: body.id,
    detail: { role: body.role },
    actorUserId: gate.user?.id,
    actorOwnerKey: gate.ownerKey,
  });

  return NextResponse.json({ ok: true });
}
