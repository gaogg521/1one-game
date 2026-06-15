"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { mergeLocaleHeaders } from "@/lib/i18n/client-headers";
import { localizedPlanName } from "@/lib/i18n/commerce-localized";

type SessionUser = {
  id: string;
  username: string | null;
  displayName: string | null;
  email: string | null;
  role: string;
  referralCode: string;
  quota?: { balance: number; plan: { id: string; name: string } };
};

export function UserAccountOverview() {
  const t = useTranslations("userConsole");
  const locale = useLocale() as AppLocale;
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    void fetch("/api/auth/session", { headers: mergeLocaleHeaders(locale) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { user?: SessionUser | null }) => setUser(d?.user ?? null));
  }, [locale]);

  if (!user) {
    return <p className="text-sm text-[var(--gc-muted)]">{t("loading")}</p>;
  }

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-6">
        <h2 className="text-lg font-semibold text-[var(--gc-text)]">{t("welcome", { name: user.displayName ?? user.username ?? t("guest") })}</h2>
        <p className="mt-2 text-sm text-[var(--gc-muted)]">{t("accountDesc")}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {user.quota ? (
            <div className="rounded-xl border border-[color:var(--gc-border)] px-4 py-3">
              <p className="text-xs text-[var(--gc-text-faint)]">{t("quotaBalance")}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{user.quota.balance}</p>
              <p className="mt-1 text-xs text-[var(--gc-muted)]">
                {localizedPlanName(locale, user.quota.plan.id, user.quota.plan.name)}
              </p>
            </div>
          ) : null}
          <div className="rounded-xl border border-[color:var(--gc-border)] px-4 py-3">
            <p className="text-xs text-[var(--gc-text-faint)]">{t("referralCode")}</p>
            <p className="mt-1 font-mono text-sm">{user.referralCode}</p>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href={withLocalePath("/studio", locale)} className="gc-theme-cta rounded-xl px-4 py-2.5 text-sm font-semibold">
          {t("goStudio")}
        </Link>
        <Link
          href={withLocalePath("/billing", locale)}
          className="rounded-xl border border-[color:var(--gc-border)] px-4 py-2.5 text-sm font-medium text-[var(--gc-muted)] hover:text-[var(--gc-text)]"
        >
          {t("goWallet")}
        </Link>
      </div>
    </section>
  );
}

export function UserProfilePanel() {
  const t = useTranslations("userConsole");
  const locale = useLocale() as AppLocale;
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    void fetch("/api/auth/session", { headers: mergeLocaleHeaders(locale) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { user?: SessionUser | null }) => setUser(d?.user ?? null));
  }, [locale]);

  if (!user) {
    return <p className="text-sm text-[var(--gc-muted)]">{t("loading")}</p>;
  }

  const rows = [
    { label: t("fieldUsername"), value: user.username ?? "—" },
    { label: t("fieldDisplayName"), value: user.displayName ?? "—" },
    { label: t("fieldEmail"), value: user.email ?? "—" },
    { label: t("fieldRole"), value: user.role },
  ];

  return (
    <section className="max-w-lg space-y-4 rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-6">
      <h2 className="text-lg font-semibold">{t("tabProfile")}</h2>
      <dl className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col gap-0.5 border-b border-[color:var(--gc-border)] pb-3 last:border-0">
            <dt className="text-xs text-[var(--gc-text-faint)]">{row.label}</dt>
            <dd className="text-sm text-[var(--gc-text)]">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function UserWalletPanel() {
  const t = useTranslations("userConsole");
  const tb = useTranslations("billing");
  const locale = useLocale() as AppLocale;
  const [quota, setQuota] = useState<{ balance: number; plan: { id: string; name: string } } | null>(null);

  useEffect(() => {
    void fetch("/api/commerce/quota", { headers: mergeLocaleHeaders(locale) })
      .then((r) => (r.ok ? r.json() : null))
      .then((q) => setQuota(q));
  }, [locale]);

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-6">
        <h2 className="text-lg font-semibold">{t("tabWallet")}</h2>
        {quota ? (
          <p className="mt-3 text-sm text-[var(--gc-muted)]">
            {t("walletSummary", {
              balance: quota.balance,
              plan: localizedPlanName(locale, quota.plan.id, quota.plan.name),
            })}
          </p>
        ) : (
          <p className="mt-3 text-sm text-[var(--gc-muted)]">{t("walletGuest")}</p>
        )}
      </div>
      <Link href={withLocalePath("/billing", locale)} className="text-sm text-[var(--gc-accent)] hover:underline">
        {tb("pageTitle")} →
      </Link>
    </section>
  );
}
