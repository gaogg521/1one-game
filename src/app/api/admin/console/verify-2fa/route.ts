import { NextResponse } from "next/server";
import { isAdminRole } from "@/lib/auth/admin";
import {
  CONSOLE_2FA_COOKIE,
  isConsole2faRequired,
  mintConsole2faToken,
  verifyConsole2faPin,
} from "@/lib/auth/console-2fa";
import { getCurrentAuthUser } from "@/lib/auth/user";
import { apiErrorMessage } from "@/lib/i18n/progress-message";
import { resolveRequestLocaleSync } from "@/lib/i18n/request-locale";

/** POST { pin } — 运营控制台二次验证（生产 + ADMIN_CONSOLE_2FA_PIN） */
export async function POST(req: Request) {
  if (!isConsole2faRequired()) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const user = await getCurrentAuthUser();
  if (!user || !isAdminRole(user.role)) {
    return NextResponse.json(
      { error: apiErrorMessage(resolveRequestLocaleSync(req), "adminRequired") },
      { status: 403 },
    );
  }

  let body: { pin?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const pin = body.pin?.trim() ?? "";
  if (!verifyConsole2faPin(pin)) {
    return NextResponse.json({ error: "invalid_pin" }, { status: 401 });
  }

  const token = mintConsole2faToken(user.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(CONSOLE_2FA_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
  return res;
}
