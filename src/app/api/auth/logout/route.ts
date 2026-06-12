import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";
import { getSessionTokenFromCookies } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const token = await getSessionTokenFromCookies();
  if (token) {
    await prisma.userSession.deleteMany({ where: { token } }).catch(() => {});
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
