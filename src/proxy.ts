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
import {
  getAdminConsoleHost,
  getAdminConsolePath,
  isAdminConsolePath,
  isLegacyAdminPath,
} from "@/lib/admin-console-path";
import { parseDevCanonicalOriginRaw } from "@/lib/dev-canonical-origin";

/** Next.js 16+：原 middleware 更名为 proxy，运行在请求边界上。 */
const LOCALE_HEADER = "x-app-locale";

/** Absolute rewrite target that talks HTTP to the local Node listener (never https://localhost). */
function internalRewriteDestination(request: NextRequest, pathname: string): URL {
  const dest = request.nextUrl.clone();
  dest.pathname = pathname || "/";
  dest.protocol = "http:";
  const listenHost = process.env.HOSTNAME?.trim();
  dest.hostname =
    !listenHost || listenHost === "0.0.0.0" ? "127.0.0.1" : listenHost;
  const listenPort = process.env.PORT?.trim();
  if (listenPort) dest.port = listenPort;
  return dest;
}

export function proxy(request: NextRequest) {
  // Absolute locale rewrites are followed as a loopback proxy request; do not
  // re-apply the bare-path → /{locale} redirect on that subrequest.
  if (request.headers.has("x-middleware-subrequest")) {
    const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
    const headerLocale = request.headers.get(LOCALE_HEADER);
    const activeLocale = isAppLocale(headerLocale)
      ? headerLocale
      : isAppLocale(cookieLocale)
        ? cookieLocale
        : detectLocaleFromAcceptLanguage(request.headers.get("accept-language"));
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(LOCALE_HEADER, activeLocale);
    const res = NextResponse.next({
      request: { headers: requestHeaders },
    });
    res.headers.set("x-app-locale", activeLocale);
    return res;
  }

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
  const consolePath = getAdminConsolePath();
  const hostHeader = request.headers.get("host")?.split(":")[0]?.toLowerCase() ?? "";
  const consoleHost = getAdminConsoleHost();

  if (consoleHost && hostHeader === consoleHost) {
    if (!isAdminConsolePath(rewrittenPathname) && !isLegacyAdminPath(rewrittenPathname)) {
      const target = new URL(`${consolePath}${request.nextUrl.search}`, request.url);
      const res = NextResponse.redirect(target, 308);
      res.headers.set("X-Robots-Tag", "noindex, nofollow");
      return res;
    }
  }

  if (isLegacyAdminPath(rewrittenPathname)) {
    const target = new URL(`${consolePath}${request.nextUrl.search}`, request.url);
    const res = NextResponse.redirect(target, 308);
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }

  if (isAdminConsolePath(rewrittenPathname)) {
    if (pathnameLocale !== null) {
      const target = new URL(`${consolePath}${request.nextUrl.search}`, request.url);
      const res = NextResponse.redirect(target, 308);
      res.cookies.set(LOCALE_COOKIE, pathnameLocale, {
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 400,
        secure: request.nextUrl.protocol === "https:",
      });
      res.headers.set("X-Robots-Tag", "noindex, nofollow");
      return res;
    }
    const activeLocale = isAppLocale(cookieLocale) ? cookieLocale : detectedLocale;
    const res = NextResponse.next();
    res.headers.set(LOCALE_HEADER, activeLocale);
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    res.headers.set("Referrer-Policy", "no-referrer");
    res.headers.set("X-Frame-Options", "DENY");
    if (!isAppLocale(cookieLocale)) {
      res.cookies.set(LOCALE_COOKIE, activeLocale, {
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 400,
        secure: request.nextUrl.protocol === "https:",
      });
    }
    return res;
  }

  const localePrefix = getLocalePrefix(detectedLocale);
  const hasLocalePrefix = pathnameLocale !== null;

  if (!hasLocalePrefix) {
    // Locale already applied via rewrite request headers (loopback proxy follow-up).
    const rewriteLocale = request.headers.get(LOCALE_HEADER);
    if (isAppLocale(rewriteLocale)) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set(LOCALE_HEADER, rewriteLocale);
      const passthrough = NextResponse.next({
        request: { headers: requestHeaders },
      });
      passthrough.headers.set("x-app-locale", rewriteLocale);
      return passthrough;
    }

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
  // Behind nginx TLS, request.nextUrl is https://127.0.0.1:PORT/… — rewriting to
  // that https URL 500s (EPROTO). Always rewrite to the local HTTP listener.
  const rewrittenUrl = internalRewriteDestination(request, rewrittenPathname);
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
