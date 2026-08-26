"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

const FEEDS = [
  { href: "/arcade", labelKey: "games" as const, descKey: "swipePromoGame" as const },
  { href: "/novel/feed", labelKey: "novels" as const, descKey: "swipePromoNovel" as const },
  { href: "/comic/feed", labelKey: "comics" as const, descKey: "swipePromoComic" as const },
] as const;

/** 首页手机端：三种竖滑 Feed 快捷入口 */
export function MobileFeedPromoStrip() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("mobileDock");

  return (
    <div className="mx-auto mb-4 mt-2 flex max-w-6xl flex-col gap-2 md:hidden">
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--gc-muted)]">
        {t("swipePromoTitle")}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {FEEDS.map((feed) => (
          <Link
            key={feed.href}
            href={withLocalePath(feed.href, locale)}
            className="flex min-h-[48px] flex-col items-center justify-center rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-2 py-2.5 text-center transition active:scale-[0.98]"
          >
            <span className="text-sm font-medium text-[var(--gc-text)]">{t(feed.labelKey)}</span>
            <span className="sr-only">{t(feed.descKey)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
