import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import type { OAuthProviderId } from "@/lib/auth/types";
import { localizedJsonError } from "@/lib/api/localized-error";
import { getOAuthHandler, getOAuthRedirectUri } from "@/lib/auth/oauth";

const STATE_COOKIE = "gcreator_oauth_state";

type RouteContext = { params: Promise<{ provider: string }> };

export async function GET(req: Request, ctx: RouteContext) {
  const { provider: raw } = await ctx.params;
  const provider = raw as OAuthProviderId;
  const handler = getOAuthHandler(provider);
  if (!handler.config.enabled) {
    return localizedJsonError(req, "oauthNotOpen", 503, {
      params: { provider: handler.config.label },
    });
  }

  const origin = new URL(req.url).origin;
  const redirectUri = getOAuthRedirectUri(origin, provider);
  const state = randomBytes(16).toString("hex");
  const url = handler.getAuthorizeUrl(state, redirectUri);

  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, `${provider}:${state}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
    secure: origin.startsWith("https"),
  });
  return res;
}
