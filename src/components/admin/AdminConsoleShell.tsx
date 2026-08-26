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

  const sectionLabel = (section: ConsoleNavSection) =>
    section.superAdminOnly
      ? ta(section.labelKey as "navSectionAdminOperations")
      : tu(section.labelKey as "navSectionGeneral");

  return (
    <div className="admin-console-root relative z-10 flex min-h-screen bg-[var(--gc-bg)] text-[var(--gc-text)]">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)] lg:flex">
        <div className="border-b border-[color:var(--gc-border)] px-5 pb-4 pt-5">
          <p className="gc-admin-type-meta">{t("eyebrow")}</p>
          <p className="gc-admin-type-brand mt-2">{tu("consoleTitle")}</p>
          <p className="gc-admin-type-path mt-1.5">{t("pathHint", { path: consolePath })}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4" aria-label={t("navAria")}>
          {navSections.map((section, index) => {
            const prev = navSections[index - 1];
            const startAdmin = Boolean(section.superAdminOnly && !prev?.superAdminOnly);
            return (
              <div
                key={section.id}
                data-testid={`admin-nav-section-${section.id}`}
                className={startAdmin ? "border-t border-[color:var(--gc-border)] pt-5" : undefined}
              >
                <p className="gc-admin-type-group mb-1.5 px-2.5">{sectionLabel(section)}</p>
                <div className="flex flex-col gap-0.5 pl-1.5">
                  {section.items.map((item) => {
                    const active = item.id === activeNavId;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-testid={`admin-tab-${item.id}`}
                        onClick={() => onNavChange(item.id)}
                        className={`gc-admin-type-nav relative rounded-lg py-2 pl-4 pr-3 text-left transition ${
                          active
                            ? "bg-[color:color-mix(in_srgb,var(--gc-accent)_16%,transparent)] font-medium text-[var(--gc-text)]"
                            : "text-[var(--gc-muted)] hover:bg-[var(--gc-surface-glass)] hover:text-[var(--gc-text)]"
                        }`}
                      >
                        {active ? (
                          <span
                            aria-hidden
                            className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-[var(--gc-accent)]"
                          />
                        ) : null}
                        {labelFor(section, item.labelKey)}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="border-t border-[color:var(--gc-border)] px-4 py-3">
          {showSsoLogout ? (
            <form action={`/api/admin/console/sso/logout?next=${encodeURIComponent(consolePath)}`} method="post" className="mb-2">
              <button type="submit" className="gc-admin-type-label text-[var(--gc-accent)] hover:underline">
                {t("ssoLogoutAction")}
              </button>
            </form>
          ) : null}
          <Link href="/" className="gc-admin-type-label text-[var(--gc-accent)] hover:underline">
            {t("backToProduct")}
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--gc-border)] bg-[color:var(--gc-header-bg)] px-4 py-2.5 backdrop-blur sm:px-6">
          <div className="lg:hidden">
            <p className="gc-admin-type-meta">{t("eyebrow")}</p>
            <p className="gc-admin-type-group mt-0.5">{tu("consoleTitle")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {actorRole ? (
              <span className="gc-admin-type-label rounded-full border border-[color:var(--gc-border)] px-2.5 py-1 text-[var(--gc-text-soft)]">
                {t("actorRole", { role: actorRole })}
              </span>
            ) : null}
            <span className="gc-admin-type-label hidden sm:inline">{tu("securityNoticeUser")}</span>
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
