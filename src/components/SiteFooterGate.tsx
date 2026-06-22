"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { getAdminConsolePathClient } from "@/lib/admin-console-path";

const HIDE_FOOTER_PREFIXES = ["/admin", "/studio", "/billing"];
/** Path segments (locale-agnostic) that suppress the footer */
const HIDE_FOOTER_SEGMENTS = ["arcade", "feed"];

export function SiteFooterGate() {
  const pathname = usePathname();
  const consolePath = getAdminConsolePathClient();
  const segments = pathname.split("/");
  if (
    pathname === consolePath ||
    pathname.startsWith(`${consolePath}/`) ||
    HIDE_FOOTER_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    HIDE_FOOTER_SEGMENTS.some((seg) => segments.includes(seg))
  ) {
    return null;
  }
  return <SiteFooter />;
}
