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
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [devCodeHint, setDevCodeHint] = useState<string | null>(null);
  const [sendBusy, setSendBusy] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const inputCls =
    "w-full rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-4 py-3 text-sm text-[var(--gc-text)] outline-none placeholder:text-[var(--gc-text-faint)] focus:border-[color:color-mix(in_srgb,var(--gc-accent)_45%,transparent)]";

  async function sendCode() {
    setError(null);
    setDevCodeHint(null);
    setSendBusy(true);
    try {
      const res = await fetch("/api/auth/register/send-code", {
        method: "POST",
        headers: mergeLocaleHeaders(locale, { "Content-Type": "application/json" }),
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { devCode?: string; errorKey?: string; error?: string };
      if (!res.ok) {
        setError(resolveClientApiError(locale, data, "registerSendFailed"));
        return;
      }
      if (data.devCode) setDevCodeHint(data.devCode);
      setCooldown(60);
      const timer = window.setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) {
            window.clearInterval(timer);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } finally {
      setSendBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitBusy(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: mergeLocaleHeaders(locale, { "Content-Type": "application/json" }),
        body: JSON.stringify({ displayName, email, password, code }),
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
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="username"
                  required
                  minLength={2}
                  maxLength={32}
                  data-testid="register-username"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[var(--gc-muted)]">{t("registerEmail")}</span>
                <input
                  type="email"
                  className={inputCls}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  data-testid="register-email"
                />
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
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-[var(--gc-muted)]">{t("registerCode")}</span>
                <div className="flex gap-2">
                  <input
                    className={`${inputCls} flex-1`}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder={t("registerCodePlaceholder")}
                    inputMode="numeric"
                    required
                    data-testid="register-code"
                  />
                  <button
                    type="button"
                    disabled={sendBusy || cooldown > 0 || !email.trim()}
                    onClick={() => void sendCode()}
                    className="shrink-0 rounded-xl border border-[color:color-mix(in_srgb,var(--gc-accent)_40%,var(--gc-border))] px-3 py-2 text-xs font-medium text-[var(--gc-text)] disabled:opacity-45"
                    data-testid="register-send-code"
                  >
                    {cooldown > 0 ? t("registerResendIn", { sec: cooldown }) : t("registerSendCode")}
                  </button>
                </div>
                {devCodeHint ? (
                  <p className="text-[11px] text-amber-200/90" data-testid="register-dev-code">
                    {t("registerDevCodeHint", { code: devCodeHint })}
                  </p>
                ) : null}
              </div>
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
