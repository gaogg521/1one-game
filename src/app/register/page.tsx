"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AppMain, AppPageShell } from "@/components/AppPageShell";
import { SiteHeader } from "@/components/SiteHeader";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { mergeLocaleHeaders } from "@/lib/i18n/client-headers";
import { resolveClientApiError } from "@/lib/i18n/resolve-client-api-error";

export default function RegisterPage() {
  const t = useTranslations("account");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitBusy, setSubmitBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputCls =
    "w-full rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-4 py-3 text-sm text-[var(--gc-text)] outline-none placeholder:text-[var(--gc-text-faint)] focus:border-[color:color-mix(in_srgb,var(--gc-accent)_45%,transparent)]";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitBusy(true);
    try {
      const res = await fetch("/api/auth/register/username", {
        method: "POST",
        headers: mergeLocaleHeaders(locale, { "Content-Type": "application/json" }),
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json()) as { errorKey?: string; error?: string };
      if (!res.ok) {
        setError(resolveClientApiError(locale, data, "registerFailed"));
        return;
      }
      router.push(withLocalePath("/studio?register=ok", locale));
      router.refresh();
    } finally {
      setSubmitBusy(false);
    }
  }

  return (
    <AppPageShell>
      <SiteHeader />
      <AppMain>
        <main className="mx-auto flex w-full max-w-md flex-col px-4 py-10 sm:justify-center sm:px-6 sm:py-12 lg:min-h-[calc(100dvh-1px)]">
          <div className="rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-6 shadow-lg sm:p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[color:color-mix(in_srgb,var(--gc-accent)_22%,transparent)] text-lg">
                ✦
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--gc-text)]">{t("registerPlatformName")}</p>
                <p className="text-xs text-[var(--gc-muted)]">{t("registerPlatformTagline")}</p>
              </div>
            </div>

            <h1 className="text-2xl font-semibold text-[var(--gc-text)]">{t("registerTitle")}</h1>
            <p className="mt-2 text-sm text-[var(--gc-muted)]">{t("registerDesc")}</p>

            {error ? (
              <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </p>
            ) : null}

            <form className="mt-6 space-y-4" onSubmit={(e) => void handleSubmit(e)} data-testid="register-form">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[var(--gc-muted)]">{t("registerUsername")}</span>
                <input
                  className={inputCls}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                  minLength={3}
                  maxLength={32}
                  pattern="[A-Za-z][A-Za-z0-9_]{2,31}"
                  title={t("registerUsernameHint")}
                  data-testid="register-username"
                />
                <p className="text-[11px] text-[var(--gc-text-faint)]">{t("registerUsernameHint")}</p>
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[var(--gc-muted)]">{t("registerPassword")}</span>
                <input
                  type="password"
                  className={inputCls}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  data-testid="register-password"
                />
              </label>
              <button
                type="submit"
                disabled={submitBusy}
                className="gc-theme-cta w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
                data-testid="register-submit"
              >
                {submitBusy ? t("registerSubmitting") : t("registerSubmit")}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-[var(--gc-muted)]">
              {t("registerHasAccount")}{" "}
              <Link href={withLocalePath("/login", locale)} className="text-[var(--gc-accent)] hover:underline">
                {t("login")}
              </Link>
            </p>
          </div>
        </main>
      </AppMain>
    </AppPageShell>
  );
}
