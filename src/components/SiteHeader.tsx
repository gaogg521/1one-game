"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode } from "react";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { LocaleSwitcher } from "@/components/locale/LocaleSwitcher";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { BRAND_LOGO_SRC } from "@/lib/brand";

function IconGameSection(props: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden>
      <line x1="6" x2="10" y1="11" y2="11" />
      <line x1="8" x2="8" y1="9" y2="13" />
      <line x1="15" x2="15.01" y1="12" y2="12" />
      <line x1="18" x2="18.01" y1="10" y2="10" />
      <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" />
    </svg>
  );
}

function IconNovelSection(props: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden>
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </svg>
  );
}

function IconComicSection(props: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M7 3v18" />
      <path d="M3 7.5h4" />
      <path d="M3 12h18" />
      <path d="M3 16.5h4" />
      <path d="M17 7.5h4" />
      <path d="M17 16.5h4" />
    </svg>
  );
}

function IconHubMini(props: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden>
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  );
}

const ThemeSwitcher = dynamic(() => import("@/components/theme/ThemeSwitcher").then((m) => m.ThemeSwitcher), {
  ssr: false,
});

type NavItem = { href: string; label: string; match: (p: string) => boolean };
type NavSection = { title: string; icon: ReactNode; items: NavItem[] };

function appPath(pathname: string, locale: AppLocale) {
  return withLocalePath(pathname, locale);
}

function stripLocale(pathname: string) {
  const segs = pathname.split("/").filter(Boolean);
  if (segs[0] && ["zh-Hans", "zh-Hant", "en", "ms", "th"].includes(segs[0])) {
    return `/${segs.slice(1).join("/")}` || "/";
  }
  return pathname || "/";
}

function buildNav(locale: AppLocale, t: ReturnType<typeof useTranslations>) {
  const gameNav = [
    { href: appPath("/create", locale), label: t("nav.gameCreate"), match: (p: string) => p === "/create" || p.startsWith("/create/") },
    { href: appPath("/discover", locale), label: t("nav.gameDiscover"), match: (p: string) => p === "/discover" || p.startsWith("/discover/") },
    { href: appPath("/samples", locale), label: t("nav.gameSamples"), match: (p: string) => p === "/samples" || p.startsWith("/samples/") },
  ];

  const novelNav = [
    { href: appPath("/novel/create", locale), label: t("nav.novelCreate"), match: (p: string) => p === "/novel/create" || p.startsWith("/novel/create") },
    { href: appPath("/novel/discover", locale), label: t("nav.novelDiscover"), match: (p: string) => p === "/novel/discover" || p.startsWith("/novel/") },
  ];

  const comicNav = [
    { href: appPath("/comic/create", locale), label: t("nav.comicCreate"), match: (p: string) => p === "/comic/create" || p.startsWith("/comic/create") },
    { href: appPath("/comic/discover", locale), label: t("nav.comicDiscover"), match: (p: string) => p === "/comic/discover" || p.startsWith("/comic/") },
  ];

  const metaNav = [
    { href: appPath("/", locale), label: t("nav.home"), match: (p: string) => p === "/" },
    { href: appPath("/start", locale), label: t("nav.start"), match: (p: string) => p === "/start" },
    { href: appPath("/studio", locale), label: t("nav.studio"), match: (p: string) => p === "/studio" || p.startsWith("/studio/") },
  ];

  const mobileNavSections: NavSection[] = [
    { title: t("nav.game"), icon: <IconGameSection className="h-3.5 w-3.5 shrink-0" />, items: gameNav },
    { title: t("nav.novel"), icon: <IconNovelSection className="h-3.5 w-3.5 shrink-0" />, items: novelNav },
    { title: t("nav.comic"), icon: <IconComicSection className="h-3.5 w-3.5 shrink-0" />, items: comicNav },
    { title: t("nav.site"), icon: <IconHubMini className="h-3.5 w-3.5 shrink-0" />, items: metaNav },
  ];

  return { gameNav, novelNav, comicNav, metaNav, mobileNavSections };
}

/**
 * 手机端不再把全部产品线塞进首屏横向滚动条：保留所有入口，但收进一个可展开的导航面板。
 * 首屏只让用户看到品牌、账户与明确的创作动作，避免导航先于产品价值占满屏幕。
 */
function MobileCompactNav({ sections }: { sections: NavSection[] }) {
  const t = useTranslations();
  const pathname = stripLocale(typeof window !== "undefined" ? window.location.pathname : "/");

  return (
    <details className="group relative shrink-0">
      <summary
        className="flex min-h-[40px] min-w-[40px] cursor-pointer list-none items-center justify-center rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] text-[var(--gc-text)] transition hover:border-[color:color-mix(in_srgb,var(--gc-accent)_45%,var(--gc-border))] [&::-webkit-details-marker]:hidden"
        aria-label={t("common.mainNav")}
      >
        <IconHubMini className="h-[18px] w-[18px]" />
      </summary>
      <nav
        className="fixed inset-x-3 top-[calc(3.75rem+env(safe-area-inset-top))] z-50 grid max-h-[min(72dvh,38rem)] grid-cols-2 gap-2 overflow-y-auto rounded-2xl border border-[color:var(--gc-border)] bg-[color:color-mix(in_srgb,var(--gc-bg-elevated)_94%,black)] p-2.5 shadow-2xl backdrop-blur-2xl"
        aria-label={t("common.mainNav")}
      >
        {sections.map((section) => (
          <section
            key={section.title}
            className="rounded-xl border border-[color:color-mix(in_srgb,var(--gc-border)_70%,transparent)] bg-[var(--gc-surface-glass)] p-2"
          >
            <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-bold text-[var(--gc-muted)]">
              <span className="text-[var(--gc-accent)]">{section.icon}</span>
              {section.title}
            </p>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = item.match(pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex min-h-[40px] items-center rounded-lg px-2 text-xs font-medium transition ${
                      active
                        ? "bg-[color:color-mix(in_srgb,var(--gc-accent)_20%,transparent)] text-[var(--gc-text)]"
                        : "text-[var(--gc-muted)] active:bg-[color:color-mix(in_srgb,var(--gc-accent)_14%,transparent)] hover:text-[var(--gc-text)]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>
    </details>
  );
}

function NavGroup({
  label,
  items,
  sectionIcon,
}: {
  label: string;
  items: NavItem[];
  sectionIcon?: ReactNode;
}) {
  const pathname = stripLocale(typeof window !== "undefined" ? window.location.pathname : "/");
  const base = "flex w-full items-center gap-1 rounded-xl px-3 py-2 text-sm transition";

  const showSectionHeading = label.trim().length > 0;

  return (
    <div className="flex flex-col gap-0.5">
      {showSectionHeading ? (
        <div className="flex items-center gap-2.5 px-3 pb-1 pt-2">
          {sectionIcon ? (
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:color-mix(in_srgb,var(--gc-accent)_14%,transparent)] text-[var(--gc-accent)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--gc-accent)_28%,transparent)]"
              aria-hidden
            >
              {sectionIcon}
            </span>
          ) : null}
          <p className="text-[17px] font-bold leading-tight tracking-tight text-[var(--gc-text)]">{label}</p>
        </div>
      ) : null}
      {items.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${base} ${
              active
                ? "bg-[color:color-mix(in_srgb,var(--gc-accent)_14%,transparent)] text-[var(--gc-text)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                : "text-[var(--gc-muted)] hover:bg-[color:color-mix(in_srgb,var(--gc-accent)_8%,transparent)] hover:text-[var(--gc-text)]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

function SidebarDivider() {
  return <div className="mx-3 my-1 h-px" style={{ backgroundColor: "var(--gc-border)" }} />;
}

function BrandBlock({ compact, touchNav }: { compact?: boolean; touchNav?: boolean }) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("common");
  const appName = t("appName");
  return (
    <Link
      href={appPath("/", locale)}
      className={`group flex min-w-0 items-center gap-2 rounded-xl outline-offset-4 sm:gap-3 ${compact ? "" : "px-1"} ${touchNav ? "min-h-[44px]" : ""}`}
    >
      <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl ring-1 ring-[color:var(--gc-border)] transition group-hover:ring-[color:var(--gc-accent)]/40 sm:h-10 sm:w-10">
        <Image src={BRAND_LOGO_SRC} alt={appName} width={40} height={40} className="h-full w-full object-cover" priority />
      </span>
      <span className={`min-w-0 ${touchNav ? "hidden min-[400px]:block" : ""}`}>
        <span className={`block truncate font-semibold tracking-tight text-[var(--gc-text)] ${compact ? "text-sm sm:text-base" : "text-[15px] leading-snug"}`}>
          {appName}
        </span>
        {!compact ? (
          <span className="mt-0.5 hidden text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--gc-muted)] sm:block">AI Game Lab</span>
        ) : null}
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const { gameNav, novelNav, comicNav, metaNav, mobileNavSections } = buildNav(locale, t);
  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 hidden lg:block lg:pl-[min(280px,30vw)]">
        <div className="pointer-events-auto flex items-center justify-end gap-2 border-b border-[color:var(--gc-border)] bg-[var(--gc-header-bg)] px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-lg pt-[max(0.5rem,env(safe-area-inset-top,0px))] xl:px-6">
          <LocaleSwitcher compact />
          <AccountMenu compact />
        </div>
      </div>

      <header
        className="sticky top-0 z-40 w-full min-w-0 border-b backdrop-blur-lg pt-[max(0.5rem,env(safe-area-inset-top,0px))] lg:hidden"
        style={{ borderColor: "var(--gc-border)", backgroundColor: "var(--gc-header-bg)" }}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-1.5 px-3 pb-2 sm:gap-2 sm:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden sm:gap-2">
            <BrandBlock compact touchNav />
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <MobileCompactNav sections={mobileNavSections} />
            <LocaleSwitcher compact />
            <AccountMenu compact />
            <Link
              href={appPath("/start", locale)}
              className="gc-theme-cta inline-flex shrink-0 items-center justify-center rounded-full px-3 py-2 text-xs font-semibold min-h-[40px] sm:min-h-[44px] sm:px-4 sm:py-2.5"
            >
              {t("nav.createCta")}
            </Link>
          </div>
        </div>
      </header>

      <aside
        className="relative hidden w-[min(280px,30vw)] max-w-[280px] shrink-0 border-r backdrop-blur-xl lg:sticky lg:top-0 lg:flex lg:max-h-[100dvh] lg:flex-col lg:self-start"
        style={{ borderColor: "var(--gc-border)", backgroundColor: "var(--gc-sidebar-bg)" }}
      >
        <div className="flex h-[100dvh] min-h-0 flex-col overflow-x-hidden px-3 py-4 xl:px-4 xl:py-6">
          <div className="flex shrink-0 flex-col gap-3">
            <BrandBlock />
            <ThemeSwitcher />
          </div>

          <nav className="mt-4 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1" aria-label={t("common.mainNav")}>
            <NavGroup label={t("nav.game")} items={gameNav} sectionIcon={<IconGameSection className="h-[18px] w-[18px]" />} />
            <SidebarDivider />
            <NavGroup label={t("nav.novel")} items={novelNav} sectionIcon={<IconNovelSection className="h-[18px] w-[18px]" />} />
            <SidebarDivider />
            <NavGroup label={t("nav.comic")} items={comicNav} sectionIcon={<IconComicSection className="h-[18px] w-[18px]" />} />
            <SidebarDivider />
            <NavGroup label="" items={metaNav} />
          </nav>

          <div className="shrink-0 border-t pt-4" style={{ borderColor: "var(--gc-border)" }}>
            <Link
              href={appPath("/start", locale)}
              className="gc-theme-cta block rounded-full px-4 py-2.5 text-center text-sm font-semibold lg:text-left"
            >
              {t("nav.createNow")}
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
