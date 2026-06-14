import { NextResponse } from "next/server";
import { CONSOLE_SSO_COOKIE } from "@/lib/auth/console-sso";
import { CONSOLE_2FA_COOKIE } from "@/lib/auth/console-2fa";
import { SESSION_COOKIE } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

/** POST — 清控制台 SSO / 2FA / 会话 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const sessionToken = req.headers.get("cookie")?.match(/gcreator_session=([^;]+)/)?.[1];

  if (sessionToken) {
    await prisma.userSession.deleteMany({ where: { token: sessionToken } }).catch(() => {});
  }

  const next = url.searchParams.get("next")?.trim() || "/console";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/console";
  const res = NextResponse.redirect(`${origin}/login?next=${encodeURIComponent(safeNext)}`);
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(CONSOLE_SSO_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(CONSOLE_2FA_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
