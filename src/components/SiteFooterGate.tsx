"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { getAdminConsolePathClient } from "@/lib/admin-console-path";

const HIDE_FOOTER_PREFIXES = ["/admin", "/studio", "/billing"];

export function SiteFooterGate() {
  const pathname = usePathname();
  const consolePath = getAdminConsolePathClient();
  if (
    pathname === consolePath ||
    pathname.startsWith(`${consolePath}/`) ||
    HIDE_FOOTER_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    return null;
  }
  return <SiteFooter />;
}
