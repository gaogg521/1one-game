"use client";

import { useTranslations } from "next-intl";

export function GamePlayerLoading() {
  const t = useTranslations("gamePlayer");
  return (
    <div className="flex h-[560px] w-full items-center justify-center rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)] text-sm text-[var(--gc-muted)]">
      {t("loading")}
    </div>
  );
}
