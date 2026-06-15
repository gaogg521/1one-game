"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AppMain, AppPageShell } from "@/components/AppPageShell";
import { SiteHeader } from "@/components/SiteHeader";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { localizedOAuthProviderLabel } from "@/lib/i18n/oauth-localized";
import { mergeLocaleHeaders } from "@/lib/i18n/client-headers";
import { resolveClientApiError } from "@/lib/i18n/resolve-client-api-error";

type Provider = { id: string; label: string; enabled: boolean; configured: boolean };

export default function LoginPage() {
  const t = useTranslations("account");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [error, setError] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("error");
  });
  const [returnPath] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const next = new URLSearchParams(window.location.search).get("next")?.trim();
    if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
    return next;
  });
  const [providers, setProviders] = useState<Provider[]>([]);
  const [user, setUser] = useState<{ displayName: string | null } | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const inputCls =
    "w-full rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-4 py-3 text-sm text-[var(--gc-text)] outline-none focus:border-[color:color-mix(in_srgb,var(--gc-accent)_45%,transparent)]";

  useEffect(() => {
    void fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d: { user?: { displayName: string | null } | null; oauthProviders?: Provider[] }) => {
        setUser(d.user ?? null);
        setProviders(d.oauthProviders ?? []);
      });
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setLoginBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: mergeLocaleHeaders(locale, { "Content-Type": "application/json" }),
        body: JSON.stringify({ account: username, password }),
      });
      const data = (await res.json()) as { errorKey?: string; error?: string };
      if (!res.ok) {
        setLoginError(resolveClientApiError(locale, data, "loginInvalidCredentials"));
        return;
      }
      router.push(returnPath ?? withLocalePath("/studio", locale));
      router.refresh();
    } finally {
      setLoginBusy(false);
    }
  }

  return (
    <AppPageShell>
      <SiteHeader />
      <AppMain>
      <main className="mx-auto flex w-full max-w-lg flex-col px-4 py-10 sm:justify-center sm:px-6 sm:py-12 lg:min-h-[calc(100dvh-1px)]">
        <h1 className="text-2xl font-semibold text-[var(--gc-text)]">{t("loginTitle")}</h1>
        <p className="mt-2 text-sm text-[var(--gc-muted)]">{t("loginDesc")}</p>

        {error ? (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {t("loginFailed", { error: decodeURIComponent(error) })}
          </p>
        ) : null}

        {user ? (
          <div className="mt-6 rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-5">
            <p className="text-sm text-[var(--gc-text)]">
              {t("loggedInAs", { name: user.displayName ?? t("user") })}
            </p>
            <Link
              href={returnPath ?? withLocalePath("/studio", locale)}
              className="gc-theme-cta mt-4 inline-block rounded-lg px-4 py-2 text-sm font-semibold"
            >
              {returnPath?.startsWith("/console") ? t("enterConsole") : t("enterStudio")}
            </Link>
          </div>
        ) : (
          <>
            <form className="mt-6 space-y-3 rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-4" onSubmit={(e) => void handleLogin(e)}>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--gc-muted)]">{t("accountSectionTitle")}</p>
              {loginError ? <p className="text-sm text-red-300">{loginError}</p> : null}
              <input
                type="text"
                className={inputCls}
                placeholder={t("loginIdentifierPlaceholder")}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                data-testid="login-username"
              />
              <input
                type="password"
                className={inputCls}
                placeholder={t("passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                data-testid="login-password"
              />
              <button
                type="submit"
                disabled={loginBusy}
                className="gc-theme-cta w-full rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
                data-testid="login-submit"
              >
                {loginBusy ? t("loginSubmitting") : t("loginSubmit")}
              </button>
              <p className="text-center text-xs text-[var(--gc-muted)]">
                {t("noAccount")}{" "}
                <Link href={withLocalePath("/register", locale)} className="text-[var(--gc-accent)] hover:underline">
                  {t("goRegister")}
                </Link>
              </p>
            </form>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-[color:var(--gc-border)]" />
              <span className="text-[10px] uppercase tracking-wide text-[var(--gc-text-faint)]">OAuth</span>
              <div className="h-px flex-1 bg-[color:var(--gc-border)]" />
            </div>

            <div className="flex flex-col gap-2">
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
                  {t("providerLogin", {
                    provider: localizedOAuthProviderLabel(locale, p.id, p.label),
                  })}
                  {!p.enabled && p.configured ? t("providerConfiguring") : !p.enabled ? t("providerSoon") : ""}
                </a>
              ))}
            </div>
          </>
        )}

        <p className="mt-8 text-xs leading-relaxed text-[var(--gc-text-faint)]">{t("oauthHint")}</p>
      </main>
      </AppMain>
    </AppPageShell>
  );
}
