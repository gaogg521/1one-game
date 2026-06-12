"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect } from "react";
import type { AppLocale } from "@/i18n/routing";
import { withLocalePath } from "@/i18n/navigation";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-lg font-semibold text-[var(--gc-text)]">{t("errors.globalTitle")}</h1>
      <p className="text-sm text-[var(--gc-muted)]">
        {t("errors.globalDesc")}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="gc-theme-cta rounded-full px-5 py-2 text-sm font-semibold"
        >
          {t("common.retry")}
        </button>
        <Link
          href={withLocalePath("/", locale)}
          className="rounded-full border border-[color:var(--gc-border)] px-5 py-2 text-sm text-[var(--gc-text)]"
        >
          {t("common.goHome")}
        </Link>
      </div>
    </div>
  );
}
