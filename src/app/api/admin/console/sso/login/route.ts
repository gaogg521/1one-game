import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminConsolePath } from "@/lib/admin-console-path";
import {
  CONSOLE_SSO_STATE_COOKIE,
  buildConsoleSsoAuthorizeUrl,
  isConsoleSsoEnabled,
  mintConsoleSsoState,
} from "@/lib/auth/console-sso";

/** GET — 302 到 IdP（或 stub callback） */
export async function GET(req: Request) {
  if (!isConsoleSsoEnabled()) {
    return NextResponse.json({ error: "sso_disabled" }, { status: 404 });
  }

  const url = new URL(req.url);
  const consolePath = getAdminConsolePath();
  const nextPath = url.searchParams.get("next")?.trim() || consolePath;
  const safeNext = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : consolePath;
  const state = mintConsoleSsoState(safeNext);
  const origin = url.origin;

  const jar = await cookies();
  jar.set(CONSOLE_SSO_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
    secure: origin.startsWith("https"),
  });

  const authorize = buildConsoleSsoAuthorizeUrl(origin, state);
  return NextResponse.redirect(authorize);
}
