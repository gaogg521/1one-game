import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { OWNER_COOKIE } from "@/lib/constants";

/** Next.js 16+：原 middleware 更名为 proxy，运行在请求边界上。 */
export function proxy(request: NextRequest) {
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
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
