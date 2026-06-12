"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { AppMain, AppPageShell } from "@/components/AppPageShell";
import { SiteHeader } from "@/components/SiteHeader";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

type Plan = {
  id: string;
  name: string;
  monthlyQuota: number;
  priceCents: number;
  features: string[];
};

type QuotaInfo = {
  balance: number;
  plan: { id: string; name: string; periodEnd: string | null };
};

export default function BillingPage() {
  const t = useTranslations();
  const tp = useTranslations("commercePlans");
  const locale = useLocale() as AppLocale;
  const [plans, setPlans] = useState<Plan[]>([]);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    void Promise.all([
      fetch("/api/commerce/plans").then((r) => r.json()),
      fetch("/api/commerce/quota").then((r) => (r.ok ? r.json() : null)),
    ]).then(([p, q]) => {
      setPlans((p as { plans?: Plan[] }).plans ?? []);
      setQuota(q as QuotaInfo | null);
    });
  }, []);

  async function buy(planId: string) {
    setBusy(planId);
    setMsg("");
    try {
      const res = await fetch("/api/commerce/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, provider: "dev" }),
      });
      const data = (await res.json()) as {
        order?: { orderId: string };
        devPay?: { simulateUrl: string };
        error?: string;
      };
      if (!res.ok) {
        setMsg(data.error ?? t("billing.orderFailed"));
        return;
      }
      if (data.devPay?.simulateUrl && data.order?.orderId) {
        const sim = await fetch(data.devPay.simulateUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: data.order.orderId }),
        });
        if (sim.ok) {
          setMsg(t("billing.devPaySuccess"));
          const q = await fetch("/api/commerce/quota").then((r) => r.json());
          setQuota(q as QuotaInfo);
        } else {
          setMsg(t("billing.devPayFailed"));
        }
      } else {
        setMsg(t("billing.orderCreated", { orderId: data.order?.orderId ?? "-" }));
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppPageShell>
      <SiteHeader />
      <AppMain>
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-semibold text-[var(--gc-text)]">{t("billing.title")}</h1>
        <p className="mt-2 text-sm text-[var(--gc-muted)]">
          {t("billing.desc")}
          <Link href={withLocalePath("/login", locale)} className="ml-1 text-[var(--gc-accent)]">
            {t("billing.goLogin")}
          </Link>
        </p>

        {quota ? (
          <div className="mt-6 rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-4">
            <p className="text-sm text-[var(--gc-text)]">
              {t("billing.currentPlan")} <strong>{quota.plan.name}</strong>
            </p>
            <p className="mt-1 text-2xl font-semibold text-[var(--gc-accent)]">
              {quota.balance} {t("billing.pointsUnit")}
            </p>
            <p className="mt-1 text-xs text-[var(--gc-muted)]">{t("billing.availableQuota")}</p>
          </div>
        ) : null}

        {msg ? (
          <p className="mt-4 rounded-lg border border-[color:var(--gc-border)] px-4 py-3 text-sm text-[var(--gc-text-soft)]">
            {msg}
          </p>
        ) : null}

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {plans.map((p) => {
            const planKey = p.id as "free" | "creator" | "pro";
            const features = (tp.raw(`${planKey}.features`) as string[] | undefined) ?? p.features;
            return (
            <div
              key={p.id}
              className="rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-4"
            >
              <h2 className="font-semibold text-[var(--gc-text)]">{tp(`${planKey}.name`)}</h2>
              <p className="mt-2 text-xl text-[var(--gc-text)]">
                {p.priceCents === 0 ? t("billing.free") : t("billing.perMonth", { price: (p.priceCents / 100).toFixed(0) })}
              </p>
              <p className="mt-1 text-xs text-[var(--gc-muted)]">{t("billing.includesQuota", { count: p.monthlyQuota })}</p>
              <ul className="mt-3 space-y-1 text-[11px] text-[var(--gc-text-soft)]">
                {features.map((f) => (
                  <li key={f}>· {f}</li>
                ))}
              </ul>
              {p.id !== "free" ? (
                <button
                  type="button"
                  disabled={busy === p.id}
                  onClick={() => void buy(p.id)}
                  className="gc-theme-cta mt-4 w-full rounded-lg py-2 text-xs font-semibold disabled:opacity-50"
                >
                  {busy === p.id ? t("billing.processing") : t("billing.subscribe")}
                </button>
              ) : null}
            </div>
            );
          })}
        </div>
      </main>
      </AppMain>
    </AppPageShell>
  );
}
