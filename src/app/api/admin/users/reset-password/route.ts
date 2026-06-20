import { NextResponse } from "next/server";
import { requireAdmin, writeAdminAudit } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { localizedJsonError } from "@/lib/api/localized-error";

export async function POST(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = (await req.json()) as { id?: string; password?: string };
  if (!body.id || !body.password) return localizedJsonError(req, "adminMissingIdRole", 400);

  const pwErr = validatePasswordStrength(body.password);
  if (pwErr) return localizedJsonError(req, "registerWeakPassword", 400);

  const user = await prisma.user.findUnique({ where: { id: body.id }, select: { id: true, username: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!user.username) return NextResponse.json({ error: "Cannot reset password for OAuth-only accounts" }, { status: 400 });

  await prisma.user.update({
    where: { id: body.id },
    data: { passwordHash: hashPassword(body.password) },
  });

  await writeAdminAudit({
    req,
    action: "user_reset_password",
    targetType: "user",
    targetId: body.id,
    actorUserId: gate.user?.id,
    actorOwnerKey: gate.ownerKey,
  });

  return NextResponse.json({ ok: true });
}
