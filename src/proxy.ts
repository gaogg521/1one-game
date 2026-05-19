import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { OWNER_COOKIE } from "@/lib/constants";
import { parseDevCanonicalOriginRaw } from "@/lib/dev-canonical-origin";

/** Next.js 16+：原 middleware 更名为 proxy，运行在请求边界上。 */
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

  if (request.cookies.get(OWNER_COOKIE)?.value) {
    return NextResponse.next();
  }
  const res = NextResponse.next();
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|covers/|brand/|samples/).*)"],
};
