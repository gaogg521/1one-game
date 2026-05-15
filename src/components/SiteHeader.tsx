"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BRAND_LOGO_SRC, BRAND_NAME } from "@/lib/brand";

const ThemeSwitcher = dynamic(() => import("@/components/theme/ThemeSwitcher").then((m) => m.ThemeSwitcher), {
  ssr: false,
});

const nav = [
  { href: "/", label: "首页", match: (p: string) => p === "/" },
  { href: "/create", label: "创作", match: (p: string) => p === "/create" || p.startsWith("/create/") },
  { href: "/discover", label: "发现", match: (p: string) => p === "/discover" || p.startsWith("/discover/") },
  { href: "/samples", label: "样品", match: (p: string) => p === "/samples" || p.startsWith("/samples/") },
  { href: "/studio", label: "我的作品", match: (p: string) => p === "/studio" || p.startsWith("/studio/") },
];

function NavLinks({ variant }: { variant: "sidebar" | "mobile" }) {
  const pathname = usePathname();

  const base =
    variant === "sidebar"
      ? "flex w-full items-center gap-1 rounded-xl px-3 py-2.5 text-sm font-medium transition"
      : "rounded-full px-3 py-1.5 text-sm transition";

  return (
    <nav className={variant === "sidebar" ? "flex flex-col gap-0.5" : "flex flex-wrap items-center gap-1"} aria-label="主导航">
      {nav.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${base} ${
              active
                ? variant === "sidebar"
                  ? "bg-[color:color-mix(in_srgb,var(--gc-accent)_14%,transparent)] text-[var(--gc-text)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                  : "bg-[color:color-mix(in_srgb,var(--gc-accent)_18%,transparent)] text-[var(--gc-text)]"
                : variant === "sidebar"
                  ? "text-[var(--gc-muted)] hover:bg-[color:color-mix(in_srgb,var(--gc-accent)_8%,transparent)] hover:text-[var(--gc-text)]"
                  : "text-[var(--gc-muted)] hover:bg-[color:color-mix(in_srgb,var(--gc-accent)_10%,transparent)] hover:text-[var(--gc-text)]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function BrandBlock({ compact }: { compact?: boolean }) {
  return (
    <Link href="/" className={`group flex items-center gap-3 rounded-xl outline-offset-4 ${compact ? "" : "px-1"}`}>
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
      <header className="sticky top-0 z-40 border-b backdrop-blur-lg lg:hidden" style={{ borderColor: "var(--gc-border)", backgroundColor: "var(--gc-header-bg)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <BrandBlock compact />
            <ThemeSwitcher />
          </div>
          <div className="flex items-center gap-2">
            <Link href="/create" className="gc-theme-cta shrink-0 px-4 py-2 text-xs font-semibold">
              创作
            </Link>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-3">
          <NavLinks variant="mobile" />
        </div>
      </header>

      <aside
        className="relative hidden h-screen w-[260px] shrink-0 border-r backdrop-blur-xl lg:flex lg:flex-col lg:sticky lg:top-0"
        style={{ borderColor: "var(--gc-border)", backgroundColor: "var(--gc-sidebar-bg)" }}
      >
        <div className="flex flex-1 flex-col gap-6 px-4 py-8">
          <div className="flex flex-col gap-3">
            <BrandBlock />
            <ThemeSwitcher />
          </div>

          <Link href="/create" className="gc-theme-cta flex w-full items-center justify-center px-4 py-3.5 text-sm font-semibold">
            + 开始创作
          </Link>

          <NavLinks variant="sidebar" />

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
