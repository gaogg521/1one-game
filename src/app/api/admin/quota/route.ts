import { NextResponse } from "next/server";
import { requireAdmin, writeAdminAudit } from "@/lib/auth/admin";
import { grantQuota } from "@/lib/commerce/quota";
import { localizedJsonError } from "@/lib/api/localized-error";
import { prisma } from "@/lib/prisma";

/** POST { userId, delta, reason? } — 运营发放/扣减额度 */
export async function POST(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  let body: { userId?: string; delta?: number; reason?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const userId = body.userId?.trim();
  const delta = body.delta;
  if (!userId || typeof delta !== "number" || !Number.isFinite(delta) || delta === 0) {
    return localizedJsonError(req, "adminUserIdDelta", 400);
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return localizedJsonError(req, "adminUserNotFound", 404);

  const balance = await grantQuota({
    userId,
    delta: Math.trunc(delta),
    reason: "admin_grant",
    refType: "admin",
    refId: admin.user?.id ?? admin.ownerKey ?? "legacy_admin",
  });

  await writeAdminAudit({
    req,
    actorUserId: admin.user?.id,
    actorOwnerKey: admin.ownerKey,
    action: "quota_grant",
    targetType: "user",
    targetId: userId,
    detail: { delta, balance, note: body.reason },
  });

  return NextResponse.json({ ok: true, userId, balance, delta });
}
