"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { AppMain, AppPageShell } from "@/components/AppPageShell";
import { SiteHeader } from "@/components/SiteHeader";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { localizedOAuthProviderLabel } from "@/lib/i18n/oauth-localized";

type Provider = { id: string; label: string; enabled: boolean; configured: boolean };

export default function LoginPage() {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const [error] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("error");
  });
  const [providers, setProviders] = useState<Provider[]>([]);
  const [user, setUser] = useState<{ displayName: string | null } | null>(null);

  useEffect(() => {
    void fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d: { user?: { displayName: string | null } | null; oauthProviders?: Provider[] }) => {
        setUser(d.user ?? null);
        setProviders(d.oauthProviders ?? []);
      });
  }, []);

  return (
    <AppPageShell>
      <SiteHeader />
      <AppMain>
      <main className="mx-auto flex w-full max-w-lg flex-col px-4 py-10 sm:justify-center sm:px-6 sm:py-12 lg:min-h-[calc(100dvh-1px)]">
        <h1 className="text-2xl font-semibold text-[var(--gc-text)]">{t("account.loginTitle")}</h1>
        <p className="mt-2 text-sm text-[var(--gc-muted)]">
          {t("account.loginDesc")}
        </p>

        {error ? (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {t("account.loginFailed", { error: decodeURIComponent(error) })}
          </p>
        ) : null}

        {user ? (
          <div className="mt-6 rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-5">
            <p className="text-sm text-[var(--gc-text)]">
              {t("account.loggedInAs", { name: user.displayName ?? t("account.user") })}
            </p>
            <Link href={withLocalePath("/studio", locale)} className="gc-theme-cta mt-4 inline-block rounded-lg px-4 py-2 text-sm font-semibold">
              {t("account.enterStudio")}
            </Link>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-2">
            {providers.map((p) => (
              <a
                key={p.id}
                href={p.enabled ? `/api/auth/oauth/${p.id}/start` : undefined}
                aria-disabled={!p.enabled}
                className={`rounded-xl border px-4 py-3 text-center text-sm font-medium transition ${
                  p.enabled
                    ? "border-[color:color-mix(in_srgb,var(--gc-accent)_40%,var(--gc-border))] bg-[color:color-mix(in_srgb,var(--gc-accent)_10%,transparent)] text-[var(--gc-text)] hover:brightness-110"
                    : "cursor-not-allowed border-[color:var(--gc-border)] text-[var(--gc-text-faint)] opacity-60"
                }`}
              >
                {t("account.providerLogin", {
                  provider: localizedOAuthProviderLabel(locale, p.id, p.label),
                })}
                {!p.enabled && p.configured ? t("account.providerConfiguring") : !p.enabled ? t("account.providerSoon") : ""}
              </a>
            ))}
          </div>
        )}

        <p className="mt-8 text-xs leading-relaxed text-[var(--gc-text-faint)]">
          {t("account.oauthHint")}
        </p>
      </main>
      </AppMain>
    </AppPageShell>
  );
}
