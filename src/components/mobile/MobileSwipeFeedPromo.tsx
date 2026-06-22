"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

type Kind = "novel" | "comic" | "game";

export function MobileSwipeFeedPromo({ kind }: { kind: Kind }) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("mobileDock");
  const href =
    kind === "novel" ? "/novel/feed" : kind === "comic" ? "/comic/feed" : "/arcade";
  const desc =
    kind === "novel" ? t("swipePromoNovel") : kind === "comic" ? t("swipePromoComic") : t("swipePromoGame");
  const icon = kind === "novel" ? "📖" : kind === "comic" ? "🎨" : "🎮";

  return (
    <Link
      href={withLocalePath(href, locale)}
      className="flex items-center gap-3 rounded-xl border border-[color:color-mix(in_srgb,var(--gc-accent)_28%,var(--gc-border))] bg-[color:color-mix(in_srgb,var(--gc-accent)_8%,var(--gc-surface-glass))] px-4 py-3 transition active:scale-[0.99] md:hidden"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--gc-accent)_18%,transparent)] text-lg">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[var(--gc-text)]">{t("swipePromoTitle")}</span>
        <span className="mt-0.5 block text-xs text-[var(--gc-muted)]">{desc}</span>
      </span>
      <span className="shrink-0 rounded-full bg-[color:var(--gc-accent)] px-3 py-1.5 text-[11px] font-semibold text-white">
        {t("swipePromoCta")}
      </span>
    </Link>
  );
}
