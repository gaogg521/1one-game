"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { shouldHideMobileDock } from "@/components/mobile/mobile-chrome";

export function MobileDockInset({ children }: { children: ReactNode }) {
  const hide = shouldHideMobileDock(usePathname());
  return (
    <div
      className={`flex min-h-0 flex-1 flex-col ${hide ? "" : "pb-[calc(3.25rem+env(safe-area-inset-bottom))] md:pb-0"}`}
    >
      {children}
    </div>
  );
}
