"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

const HIDE_PREFIXES = ["/create", "/play/", "/console", "/admin", "/studio"];

function stripLocale(pathname: string) {
  const segs = pathname.split("/").filter(Boolean);
  if (segs[0] && ["zh-Hans", "zh-Hant", "en", "ms", "th"].includes(segs[0])) {
    return `/${segs.slice(1).join("/")}` || "/";
  }
  return pathname || "/";
}

/** 手机底栏：快速进入三种竖滑 Feed */
export function MobileBrowseDock() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("mobileDock");
  const pathname = stripLocale(usePathname());

  if (HIDE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
    return null;
  }
  // Feed 页自带顶栏切换，不重复底栏
  if (pathname === "/arcade" || pathname === "/novel/feed" || pathname === "/comic/feed") {
    return null;
  }

  const tabs = [
    { href: "/arcade", label: t("games"), match: (p: string) => p === "/arcade" },
    { href: "/novel/feed", label: t("novels"), match: (p: string) => p === "/novel/feed" },
    { href: "/comic/feed", label: t("comics"), match: (p: string) => p === "/comic/feed" },
    { href: "/", label: t("home"), match: (p: string) => p === "/" },
  ] as const;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[color:color-mix(in_srgb,var(--gc-bg)_92%,#000)] backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "max(0.35rem, env(safe-area-inset-bottom))" }}
      aria-label={t("aria")}
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pt-1.5">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={withLocalePath(tab.href, locale)}
              className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1 text-[11px] font-medium transition ${
                active ? "text-[var(--gc-text)]" : "text-[var(--gc-muted)]"
              }`}
            >
              <span
                className={`h-1 w-8 rounded-full transition ${active ? "bg-[color:var(--gc-accent)]" : "bg-transparent"}`}
              />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Feed 顶栏：游戏 / 小说 / 漫画 三态切换 */
export function MobileFeedTabs({ active }: { active: "arcade" | "novel" | "comic" }) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("mobileDock");

  const tabs = [
    { id: "arcade" as const, href: "/arcade", label: t("games") },
    { id: "novel" as const, href: "/novel/feed", label: t("novels") },
    { id: "comic" as const, href: "/comic/feed", label: t("comics") },
  ];

  return (
    <div className="flex rounded-full bg-black/40 p-0.5 backdrop-blur-md">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={withLocalePath(tab.href, locale)}
          className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
            active === tab.id ? "bg-white/20 text-white" : "text-white/55 hover:text-white/80"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
