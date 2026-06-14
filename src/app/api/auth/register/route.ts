import { NextResponse } from "next/server";
import { registerWithEmail } from "@/lib/auth/email-register";
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
  const result = await registerWithEmail({
    email: String(b.email ?? ""),
    code: String(b.code ?? ""),
    password: String(b.password ?? ""),
    displayName: String(b.displayName ?? ""),
    referralCode: typeof b.referralCode === "string" ? b.referralCode : undefined,
  });

  if (!result.ok) {
    const key =
      result.error === "invalidEmail"
        ? "registerInvalidEmail"
        : result.error === "weakPassword"
          ? "registerWeakPassword"
          : result.error === "invalidCode"
            ? "registerInvalidCode"
            : result.error === "nameRequired"
              ? "registerNameRequired"
              : "registerEmailTaken";
    return localizedJsonError(req, key, 400);
  }

  const origin = new URL(req.url).origin;
  const res = NextResponse.json({ ok: true, userId: result.userId });
  res.cookies.set(SESSION_COOKIE, result.sessionToken, sessionCookieOptions(origin.startsWith("https")));
  return res;
}
