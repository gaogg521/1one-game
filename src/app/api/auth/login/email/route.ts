import { NextResponse } from "next/server";
import { loginWithEmail } from "@/lib/auth/email-register";
import { SESSION_COOKIE } from "@/lib/constants";
import { sessionCookieOptions } from "@/lib/auth/user";
import { localizedJsonError } from "@/lib/api/localized-error";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return localizedJsonError(req, "badJson", 400);
  }

  const b = body as Record<string, unknown>;
  const result = await loginWithEmail(String(b.email ?? ""), String(b.password ?? ""));

  if (!result.ok) {
    return localizedJsonError(req, "loginInvalidCredentials", 401);
  }

  const origin = new URL(req.url).origin;
  const res = NextResponse.json({ ok: true, userId: result.userId });
  res.cookies.set(SESSION_COOKIE, result.sessionToken, sessionCookieOptions(origin.startsWith("https")));
  return res;
}
