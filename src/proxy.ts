import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  defaultLocale,
  detectLocaleFromAcceptLanguage,
  getLocalePrefix,
  isAppLocale,
  stripLocalePrefix,
} from "@/i18n/routing";
import { LOCALE_COOKIE, OWNER_COOKIE, REF_COOKIE } from "@/lib/constants";
import { parseDevCanonicalOriginRaw } from "@/lib/dev-canonical-origin";

/** Next.js 16+：原 middleware 更名为 proxy，运行在请求边界上。 */
const LOCALE_HEADER = "x-app-locale";

export function proxy(request: NextRequest) {
  const canon =
    process.env.NODE_ENV !== "production" ? parseDevCanonicalOriginRaw(process.env.NEXT_PUBLIC_DEV_CANONICAL_ORIGIN) : null;
  const forceCanon = process.env.DEV_FORCE_CANONICAL_ORIGIN === "1" && canon;

  if (forceCanon) {
    const reqUrl = request.nextUrl;
    if (reqUrl.origin !== canon!.origin) {
      const target = new URL(reqUrl.pathname + reqUrl.search + reqUrl.hash, canon!.origin);
      const res = NextResponse.redirect(target, 307);
      if (!request.cookies.get(OWNER_COOKIE)?.value) {
        const id = globalThis.crypto.randomUUID();
        res.cookies.set(OWNER_COOKIE, id, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 400,
          secure: request.nextUrl.protocol === "https:",
        });
      }
      return res;
    }
  }

  const ref = request.nextUrl.searchParams.get("ref")?.trim();
  const hasOwner = Boolean(request.cookies.get(OWNER_COOKIE)?.value);
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const detectedLocale = isAppLocale(cookieLocale)
    ? cookieLocale
    : detectLocaleFromAcceptLanguage(request.headers.get("accept-language"));

  const pathname = request.nextUrl.pathname;
  const { locale: pathnameLocale, pathname: rewrittenPathname } = stripLocalePrefix(pathname);
  const localePrefix = getLocalePrefix(detectedLocale);
  const hasLocalePrefix = pathnameLocale !== null;

  if (!hasLocalePrefix) {
    const target = new URL(`${localePrefix}${pathname === "/" ? "" : pathname}${request.nextUrl.search}`, request.url);
    const redirectRes = NextResponse.redirect(target, 307);
    if (!request.cookies.get(LOCALE_COOKIE)?.value) {
      redirectRes.cookies.set(LOCALE_COOKIE, detectedLocale, {
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 400,
        secure: request.nextUrl.protocol === "https:",
      });
    }
    if (!hasOwner) {
      const id = globalThis.crypto.randomUUID();
      redirectRes.cookies.set(OWNER_COOKIE, id, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 400,
        secure: request.nextUrl.protocol === "https:",
      });
    }
    if (ref && ref.length >= 4 && ref.length <= 64) {
      redirectRes.cookies.set(REF_COOKIE, ref, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
        secure: request.nextUrl.protocol === "https:",
      });
    }
    return redirectRes;
  }

  const activeLocale = pathnameLocale ?? defaultLocale;
  const rewrittenUrl = request.nextUrl.clone();
  rewrittenUrl.pathname = rewrittenPathname;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_HEADER, activeLocale);
  const res = NextResponse.rewrite(rewrittenUrl, {
    request: {
      headers: requestHeaders,
    },
  });
  res.headers.set("x-app-locale", activeLocale);
  res.cookies.set(LOCALE_COOKIE, activeLocale, {
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
    secure: request.nextUrl.protocol === "https:",
  });

  if (ref && ref.length >= 4 && ref.length <= 64) {
    res.cookies.set(REF_COOKIE, ref, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      secure: request.nextUrl.protocol === "https:",
    });
  }

  if (hasOwner) {
    return res;
  }
  const id = globalThis.crypto.randomUUID();
  res.cookies.set(OWNER_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
    secure: request.nextUrl.protocol === "https:",
  });
  return res;
}

export const config = {
  /** 静态资源与封面不走 proxy，减轻 dev 下偶发「This page couldn't load」 */
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|covers/|brand/|samples/|.*\\..*).*)"],
};
