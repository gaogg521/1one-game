"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, type ReactNode } from "react";
import { BRAND_LOGO_SRC, BRAND_NAME } from "@/lib/brand";

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

const gameNav = [
  { href: "/create", label: "游戏创作", match: (p: string) => p === "/create" || p.startsWith("/create/") },
  { href: "/discover", label: "游戏发现", match: (p: string) => p === "/discover" || p.startsWith("/discover/") },
  { href: "/samples", label: "游戏样品", match: (p: string) => p === "/samples" || p.startsWith("/samples/") },
];

const novelNav = [
  { href: "/novel/create", label: "小说创作", match: (p: string) => p === "/novel/create" || p.startsWith("/novel/create") },
  { href: "/novel/discover", label: "小说发现", match: (p: string) => p === "/novel/discover" || p.startsWith("/novel/") },
];

const comicNav = [
  { href: "/comic/create", label: "动漫创作", match: (p: string) => p === "/comic/create" || p.startsWith("/comic/create") },
  { href: "/comic/discover", label: "动漫发现", match: (p: string) => p === "/comic/discover" || p.startsWith("/comic/") },
];

const metaNav = [
  { href: "/", label: "首页", match: (p: string) => p === "/" },
  { href: "/studio", label: "我的作品", match: (p: string) => p === "/studio" || p.startsWith("/studio/") },
];

const mobileNavSections = [
  { title: "游戏", icon: <IconGameSection className="h-3.5 w-3.5 shrink-0" />, items: gameNav },
  { title: "小说", icon: <IconNovelSection className="h-3.5 w-3.5 shrink-0" />, items: novelNav },
  { title: "动漫", icon: <IconComicSection className="h-3.5 w-3.5 shrink-0" />, items: comicNav },
  { title: "站点", icon: <IconHubMini className="h-3.5 w-3.5 shrink-0" />, items: metaNav },
];

type NavItem = { href: string; label: string; match: (p: string) => boolean };

function MobilePrimaryNav({ sections }: { sections: { title: string; icon: ReactNode; items: NavItem[] }[] }) {
  const pathname = usePathname();
  const linkBase =
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full px-3 text-[13px] font-medium transition min-h-[40px] sm:min-h-[44px]";

  return (
    <nav className="gc-mobile-nav-scroll flex items-stretch gap-2 overflow-x-auto pb-2 pt-0.5" aria-label="主导航">
      {sections.map((section, si) => (
        <Fragment key={section.title}>
          {si > 0 ? <span className="my-2 w-px shrink-0 bg-[color:var(--gc-border)] opacity-70" aria-hidden /> : null}
          <div className="flex shrink-0 flex-col justify-center gap-1.5 rounded-2xl border border-[color:color-mix(in_srgb,var(--gc-border)_65%,transparent)] bg-[color:color-mix(in_srgb,var(--gc-bg-elevated)_55%,transparent)] px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <span className="flex items-center gap-1 px-0.5 text-[11px] font-bold tracking-tight text-[var(--gc-muted)]">
              <span className="text-[var(--gc-accent)]">{section.icon}</span>
              {section.title}
            </span>
            <div className="flex flex-nowrap items-center gap-1">
              {section.items.map((item) => {
                const active = item.match(pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`${linkBase} ${
                      active
                        ? "bg-[color:color-mix(in_srgb,var(--gc-accent)_22%,transparent)] text-[var(--gc-text)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]"
                        : "text-[var(--gc-muted)] active:bg-[color:color-mix(in_srgb,var(--gc-accent)_14%,transparent)] hover:text-[var(--gc-text)]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </Fragment>
      ))}
    </nav>
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
  const pathname = usePathname();
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
  return (
    <Link
      href="/"
      className={`group flex items-center gap-3 rounded-xl outline-offset-4 ${compact ? "" : "px-1"} ${touchNav ? "min-h-[44px] justify-center" : ""}`}
    >
      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl ring-1 ring-[color:var(--gc-border)] transition group-hover:ring-[color:var(--gc-accent)]/40">
        <Image src={BRAND_LOGO_SRC} alt={BRAND_NAME} width={40} height={40} className="h-full w-full object-cover" priority />
      </span>
      <span className="min-w-0">
        <span className={`block font-semibold tracking-tight text-[var(--gc-text)] ${compact ? "text-base" : "text-[15px] leading-snug"}`}>
          {BRAND_NAME}
        </span>
        {!compact ? (
          <span className="mt-0.5 block text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--gc-muted)]">AI Game Lab</span>
        ) : null}
      </span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <>
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-lg pt-[max(0.5rem,env(safe-area-inset-top,0px))] lg:hidden"
        style={{ borderColor: "var(--gc-border)", backgroundColor: "var(--gc-header-bg)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 pb-2">
          <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-3">
            <BrandBlock compact touchNav />
            <ThemeSwitcher touchFriendly />
          </div>
          <Link
            href="/create"
            className="gc-theme-cta inline-flex shrink-0 items-center justify-center rounded-full px-4 py-2.5 text-xs font-semibold min-h-[44px] sm:min-h-0 sm:py-2"
          >
            创作
          </Link>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-2">
          <MobilePrimaryNav sections={mobileNavSections} />
        </div>
      </header>

      <aside
        className="relative hidden h-screen w-[260px] shrink-0 border-r backdrop-blur-xl lg:flex lg:flex-col lg:sticky lg:top-0"
        style={{ borderColor: "var(--gc-border)", backgroundColor: "var(--gc-sidebar-bg)" }}
      >
        <div className="flex flex-1 flex-col gap-4 px-4 py-8 overflow-y-auto">
          <div className="flex flex-col gap-3">
            <BrandBlock />
            <ThemeSwitcher />
          </div>

          <nav className="flex flex-col gap-1" aria-label="主导航">
            <NavGroup label="游戏" items={gameNav} sectionIcon={<IconGameSection className="h-[18px] w-[18px]" />} />
            <SidebarDivider />
            <NavGroup label="小说" items={novelNav} sectionIcon={<IconNovelSection className="h-[18px] w-[18px]" />} />
            <SidebarDivider />
            <NavGroup label="动漫" items={comicNav} sectionIcon={<IconComicSection className="h-[18px] w-[18px]" />} />
            <SidebarDivider />
            <NavGroup label="" items={metaNav} />
          </nav>

          <div className="mt-auto border-t pt-6" style={{ borderColor: "var(--gc-border)" }}>
            <p className="gc-theme-soft text-center text-[15px] leading-snug tracking-wide text-[var(--gc-muted)] lg:text-left">
              写下一句，
              <br />
              玩出一座世界。
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
