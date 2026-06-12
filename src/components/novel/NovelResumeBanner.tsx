"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

type Props = {
  novelId: string;
  title?: string;
  className?: string;
};

export function NovelResumeBanner({ novelId, title, className = "" }: Props) {
  const t = useTranslations("novelResume");
  const locale = useLocale() as AppLocale;
  const label = title ? t("continueWithTitle", { title }) : t("continueGeneric");

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border border-amber-300/80 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-amber-700/50 dark:bg-amber-950/30 ${className}`}
    >
      <div>
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">{t("detected")}</p>
        <p className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-300/80">{t("hint")}</p>
      </div>
      <Link
        href={withLocalePath(`/novel/create?resumeNovelId=${encodeURIComponent(novelId)}`, locale)}
        className="inline-flex shrink-0 items-center justify-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
      >
        {label}
      </Link>
    </div>
  );
}
