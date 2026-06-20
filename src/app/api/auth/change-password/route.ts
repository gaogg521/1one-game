import { NextResponse } from "next/server";
import { getCurrentAuthUser } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";
import { hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/auth/password";
import { localizedJsonError } from "@/lib/api/localized-error";

export async function POST(req: Request) {
  let user;
  try {
    user = await getCurrentAuthUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { currentPassword?: string; newPassword?: string };
  if (!body.currentPassword || !body.newPassword) {
    return localizedJsonError(req, "badJson", 400);
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true, username: true },
  });
  if (!dbUser?.username) {
    return NextResponse.json({ error: "OAuth-only accounts cannot set a password here" }, { status: 400 });
  }
  if (!dbUser.passwordHash) {
    return NextResponse.json({ error: "No password set" }, { status: 400 });
  }

  if (!verifyPassword(body.currentPassword, dbUser.passwordHash)) {
    return localizedJsonError(req, "loginInvalidCredentials", 401);
  }

  const pwErr = validatePasswordStrength(body.newPassword);
  if (pwErr) return localizedJsonError(req, "registerWeakPassword", 400);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(body.newPassword) },
  });

  return NextResponse.json({ ok: true });
}
