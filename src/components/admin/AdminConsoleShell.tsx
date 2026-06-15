"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ConsolePreferencesToolbar } from "@/components/admin/ConsolePreferencesToolbar";
import { getAdminConsolePathClient } from "@/lib/admin-console-path";
import type { ConsoleNavSection } from "@/lib/console-nav";

export function AdminConsoleShell({
  children,
  navSections,
  activeNavId,
  onNavChange,
  actorRole,
  consolePath: consolePathProp,
  showSsoLogout = false,
  secretKeySlot,
}: {
  children: ReactNode;
  navSections: ConsoleNavSection[];
  activeNavId: string;
  onNavChange: (id: string) => void;
  actorRole?: string | null;
  consolePath?: string;
  showSsoLogout?: boolean;
  secretKeySlot?: ReactNode;
}) {
  const t = useTranslations("adminConsole");
  const tu = useTranslations("userConsole");
  const ta = useTranslations("adminPage");
  const consolePath = consolePathProp ?? getAdminConsolePathClient();

  const labelFor = (section: ConsoleNavSection, labelKey: string) =>
    section.superAdminOnly ? ta(labelKey as "tabOverview") : tu(labelKey as "tabAccount");

  return (
    <div className="admin-console-root relative z-10 flex min-h-screen bg-[var(--gc-bg)] text-[var(--gc-text)]">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-[color:var(--gc-border)] bg-[color:var(--gc-sidebar-bg)] backdrop-blur-md lg:flex">
        <div className="border-b border-[color:var(--gc-border)] px-5 py-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--gc-text-faint)]">{t("eyebrow")}</p>
          <p className="mt-2 text-lg font-semibold tracking-tight">{tu("consoleTitle")}</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--gc-muted)]">{t("pathHint", { path: consolePath })}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-3" aria-label={t("navAria")}>
          {navSections.map((section) => (
            <div key={section.id}>
              <p
                className={`mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider ${
                  section.superAdminOnly
                    ? "text-[color:color-mix(in_srgb,var(--gc-accent)_70%,var(--gc-text-faint))]"
                    : "text-[var(--gc-text-faint)]"
                }`}
              >
                {tu(section.labelKey as "navSectionGeneral")}
              </p>
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const active = item.id === activeNavId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-testid={`admin-tab-${item.id}`}
                      onClick={() => onNavChange(item.id)}
                      className={`rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                        active
                          ? "bg-[color:color-mix(in_srgb,var(--gc-accent)_16%,transparent)] text-[var(--gc-text)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--gc-accent)_30%,var(--gc-border))]"
                          : "text-[var(--gc-muted)] hover:bg-[var(--gc-surface-glass)] hover:text-[var(--gc-text)]"
                      }`}
                    >
                      {labelFor(section, item.labelKey)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-[color:var(--gc-border)] p-4 text-xs text-[var(--gc-text-faint)]">
          {showSsoLogout ? (
            <form action={`/api/admin/console/sso/logout?next=${encodeURIComponent(consolePath)}`} method="post" className="mb-3">
              <button type="submit" className="text-[var(--gc-accent)] hover:underline">
                {t("ssoLogoutAction")}
              </button>
            </form>
          ) : null}
          <Link href="/" className="text-[var(--gc-accent)] hover:underline">
            {t("backToProduct")}
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--gc-border)] bg-[color:var(--gc-header-bg)] px-4 py-3 backdrop-blur sm:px-6">
          <div className="lg:hidden">
            <p className="text-sm font-semibold">{tu("consoleTitle")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--gc-muted)]">
            {actorRole ? (
              <span className="rounded-full border border-[color:var(--gc-border)] px-2.5 py-1 font-medium text-[var(--gc-text-soft)]">
                {t("actorRole", { role: actorRole })}
              </span>
            ) : null}
            <span className="hidden sm:inline">{tu("securityNoticeUser")}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ConsolePreferencesToolbar />
            {secretKeySlot}
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-auto bg-[var(--gc-bg)]">{children}</div>
      </div>
    </div>
  );
}
