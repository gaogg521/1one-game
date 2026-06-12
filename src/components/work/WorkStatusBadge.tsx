"use client";

import { useLocale } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { workStatusBadge } from "@/lib/work-status";

type Props = {
  status?: string | null;
  visibility?: string | null;
  className?: string;
};

export function WorkStatusBadge({ status, visibility, className = "" }: Props) {
  const locale = useLocale() as AppLocale;
  const badge = workStatusBadge({ dbStatus: status, visibility, locale });
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.className} ${className}`}
    >
      {badge.label}
    </span>
  );
}
