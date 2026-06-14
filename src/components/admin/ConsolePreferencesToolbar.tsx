"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/locale/LocaleSwitcher";

const ThemeSwitcher = dynamic(
  () => import("@/components/theme/ThemeSwitcher").then((m) => m.ThemeSwitcher),
  { ssr: false },
);

export function ConsolePreferencesToolbar({ className = "" }: { className?: string }) {
  const t = useTranslations("common");

  return (
    <div
      className={`flex flex-wrap items-center gap-3 ${className}`}
      data-testid="admin-console-preferences"
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-[var(--gc-text-faint)]">{t("language")}</span>
        <LocaleSwitcher compact menuPlacement="bottom" />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-[var(--gc-text-faint)]">{t("theme")}</span>
        <ThemeSwitcher touchFriendly />
      </div>
    </div>
  );
}
