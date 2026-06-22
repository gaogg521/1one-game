"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

const FEEDS = [
  { href: "/arcade", icon: "🎮", labelKey: "games" as const, descKey: "swipePromoGame" as const },
  { href: "/novel/feed", icon: "📖", labelKey: "novels" as const, descKey: "swipePromoNovel" as const },
  { href: "/comic/feed", icon: "🎨", labelKey: "comics" as const, descKey: "swipePromoComic" as const },
] as const;

/** 首页手机端：三种竖滑 Feed 快捷入口 */
export function MobileFeedPromoStrip() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("mobileDock");

  return (
    <div className="mt-8 flex flex-col gap-2 md:hidden">
      <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--gc-muted)]">
        {t("swipePromoTitle")}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {FEEDS.map((feed) => (
          <Link
            key={feed.href}
            href={withLocalePath(feed.href, locale)}
            className="flex flex-col items-center gap-1 rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-2 py-3 text-center transition active:scale-[0.98]"
          >
            <span className="text-xl">{feed.icon}</span>
            <span className="text-[11px] font-semibold text-[var(--gc-text)]">{t(feed.labelKey)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
