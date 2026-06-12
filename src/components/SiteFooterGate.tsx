"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";

const HIDE_FOOTER_PREFIXES = ["/admin", "/studio", "/billing"];

export function SiteFooterGate() {
  const pathname = usePathname();
  if (HIDE_FOOTER_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }
  return <SiteFooter />;
}
