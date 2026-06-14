"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { EmailConfigPublicView, EmailProvider } from "@/lib/email-config-types";

type Props = {
  headers: () => HeadersInit;
  onNotice: (n: { kind: "ok" | "error"; text: string }) => void;
};

type FormState = {
  provider: EmailProvider;
  from: string;
  resendApiKeyDraft: string;
  smtpHost: string;
  smtpPort: string;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassDraft: string;
  testTo: string;
};

function formFromView(view: EmailConfigPublicView): FormState {
  return {
    provider: view.provider === "resend" ? "resend" : "smtp",
    from: view.from ?? "",
    resendApiKeyDraft: "",
    smtpHost: view.smtpHost ?? "",
    smtpPort: view.smtpPort ? String(view.smtpPort) : "465",
    smtpSecure: view.smtpSecure ?? view.smtpPort === 465,
    smtpUser: view.smtpUser ?? "",
    smtpPassDraft: "",
    testTo: "",
  };
}

function SourceBadge({ source }: { source: "env" | "db" | "none" }) {
  const t = useTranslations("adminPage.emailConfig");
  const cls =
    source === "db"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : source === "env"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
        : "border-[color:var(--gc-border)] text-[var(--gc-text-faint)]";
  return (
    <span className={`rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${cls}`}>
      {source === "db" ? t("sourceDb") : source === "env" ? t("sourceEnv") : t("sourceNone")}
    </span>
  );
}

export function EmailConfigPanel({ headers, onNotice }: Props) {
  const t = useTranslations("adminPage.emailConfig");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [view, setView] = useState<EmailConfigPublicView | null>(null);
  const [form, setForm] = useState<FormState | null>(null);

  const inputCls =
    "w-full rounded-xl border border-[color:var(--gc-border)] bg-[color:color-mix(in_srgb,var(--gc-bg-elevated)_92%,transparent)] px-4 py-3 text-sm text-[var(--gc-text)] outline-none transition placeholder:text-[var(--gc-text-faint)] focus:border-[color:color-mix(in_srgb,var(--gc-accent)_45%,var(--gc-border))] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--gc-accent)_18%,transparent)]";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/email-config", { headers: headers() });
      if (!res.ok) {
        onNotice({ kind: "error", text: t("loadFailed") });
        return;
      }
      const data = (await res.json()) as EmailConfigPublicView;
      setView(data);
      setForm(formFromView(data));
    } finally {
      setLoading(false);
    }
  }, [headers, onNotice, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        provider: form.provider,
        from: form.from.trim() || null,
        smtpHost: form.smtpHost.trim() || null,
        smtpPort: form.smtpPort.trim() ? Number(form.smtpPort) : null,
        smtpSecure: form.smtpSecure,
        smtpUser: form.smtpUser.trim() || null,
      };
      if (form.resendApiKeyDraft.trim()) body.resendApiKey = form.resendApiKeyDraft.trim();
      if (form.smtpPassDraft.trim()) body.smtpPass = form.smtpPassDraft.trim();

      const res = await fetch("/api/admin/email-config", {
        method: "PATCH",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        onNotice({ kind: "error", text: t("saveFailed") });
        return;
      }
      const data = (await res.json()) as EmailConfigPublicView;
      setView(data);
      setForm({ ...formFromView(data), testTo: form.testTo });
      onNotice({ kind: "ok", text: t("saveDone") });
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    if (!form?.testTo.trim()) {
      onNotice({ kind: "error", text: t("testNeedEmail") });
      return;
    }
    setTesting(true);
    try {
      const res = await fetch("/api/admin/email-config/test", {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ to: form.testTo.trim() }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      if (data.ok) onNotice({ kind: "ok", text: t("testDone") });
      else onNotice({ kind: "error", text: data.message ?? t("testFailed") });
    } finally {
      setTesting(false);
    }
  }

  if (loading || !form || !view) {
    return <p className="text-sm text-[var(--gc-muted)]">{t("loading")}</p>;
  }

  return (
    <div className="space-y-5 pb-28" data-testid="admin-email-config">
      <header className="rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-5 sm:p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gc-accent)]">{t("eyebrow")}</p>
        <h2 className="mt-1 text-xl font-semibold text-[var(--gc-text)]">{t("title")}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--gc-muted)]">{t("desc")}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              view.configured
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-amber-500/15 text-amber-200"
            }`}
          >
            {view.configured ? t("statusConfigured") : t("statusMissing")}
          </span>
          {view.updatedAt ? (
            <span className="text-xs text-[var(--gc-text-faint)]">{t("lastUpdated", { at: view.updatedAt })}</span>
          ) : null}
        </div>
      </header>

      <section className="rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1.5 flex items-center gap-2 text-xs font-medium text-[var(--gc-text-soft)]">
              {t("fieldProvider")}
              <SourceBadge source={view.sources.provider} />
            </span>
            <select
              value={form.provider}
              onChange={(e) => setForm({ ...form, provider: e.target.value as EmailProvider })}
              className={inputCls}
            >
              <option value="smtp">{t("providerSmtp")}</option>
              <option value="resend">{t("providerResend")}</option>
            </select>
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 flex items-center gap-2 text-xs font-medium text-[var(--gc-text-soft)]">
              {t("fieldFrom")}
              <SourceBadge source={view.sources.from} />
            </span>
            <input
              value={form.from}
              onChange={(e) => setForm({ ...form, from: e.target.value })}
              placeholder={t("fieldFromPlaceholder")}
              className={inputCls}
            />
          </label>

          {form.provider === "resend" ? (
            <label className="block sm:col-span-2">
              <span className="mb-1.5 flex items-center gap-2 text-xs font-medium text-[var(--gc-text-soft)]">
                {t("fieldResendKey")}
                <SourceBadge source={view.sources.resendApiKey} />
              </span>
              <input
                type="password"
                value={form.resendApiKeyDraft}
                onChange={(e) => setForm({ ...form, resendApiKeyDraft: e.target.value })}
                placeholder={view.resendApiKey ? t("secretKeepHint", { masked: view.resendApiKey }) : t("fieldResendKeyPlaceholder")}
                className={inputCls}
              />
            </label>
          ) : (
            <>
              <label className="block">
                <span className="mb-1.5 flex items-center gap-2 text-xs font-medium text-[var(--gc-text-soft)]">
                  {t("fieldSmtpHost")}
                  <SourceBadge source={view.sources.smtpHost} />
                </span>
                <input
                  value={form.smtpHost}
                  onChange={(e) => setForm({ ...form, smtpHost: e.target.value })}
                  placeholder="smtp.example.com"
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 flex items-center gap-2 text-xs font-medium text-[var(--gc-text-soft)]">
                  {t("fieldSmtpPort")}
                  <SourceBadge source={view.sources.smtpPort} />
                </span>
                <input
                  value={form.smtpPort}
                  onChange={(e) => setForm({ ...form, smtpPort: e.target.value })}
                  placeholder="465"
                  className={inputCls}
                />
              </label>
              <label className="flex items-center gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.smtpSecure}
                  onChange={(e) => setForm({ ...form, smtpSecure: e.target.checked })}
                  className="rounded border-[color:var(--gc-border)]"
                />
                <span className="text-sm text-[var(--gc-text-soft)]">{t("fieldSmtpSecure")}</span>
                <SourceBadge source={view.sources.smtpSecure} />
              </label>
              <label className="block">
                <span className="mb-1.5 flex items-center gap-2 text-xs font-medium text-[var(--gc-text-soft)]">
                  {t("fieldSmtpUser")}
                  <SourceBadge source={view.sources.smtpUser} />
                </span>
                <input
                  value={form.smtpUser}
                  onChange={(e) => setForm({ ...form, smtpUser: e.target.value })}
                  placeholder="user@example.com"
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 flex items-center gap-2 text-xs font-medium text-[var(--gc-text-soft)]">
                  {t("fieldSmtpPass")}
                  <SourceBadge source={view.sources.smtpPass} />
                </span>
                <input
                  type="password"
                  value={form.smtpPassDraft}
                  onChange={(e) => setForm({ ...form, smtpPassDraft: e.target.value })}
                  placeholder={view.smtpPass ? t("secretKeepHint", { masked: view.smtpPass }) : t("fieldSmtpPassPlaceholder")}
                  className={inputCls}
                />
              </label>
            </>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="rounded-xl bg-[var(--gc-accent)] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? t("saving") : t("save")}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || saving}
            className="rounded-xl border border-[color:var(--gc-border)] px-5 py-2.5 text-sm text-[var(--gc-text)]"
          >
            {t("reload")}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-5 sm:p-6">
        <h3 className="text-sm font-semibold text-[var(--gc-text)]">{t("testTitle")}</h3>
        <p className="mt-1 text-xs text-[var(--gc-muted)]">{t("testDesc")}</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1">
            <span className="mb-1.5 block text-xs font-medium text-[var(--gc-text-soft)]">{t("testTo")}</span>
            <input
              value={form.testTo}
              onChange={(e) => setForm({ ...form, testTo: e.target.value })}
              placeholder="you@example.com"
              className={inputCls}
            />
          </label>
          <button
            type="button"
            onClick={() => void sendTest()}
            disabled={testing || !view.configured}
            className="rounded-xl border border-[color:var(--gc-border)] px-5 py-3 text-sm text-[var(--gc-text)] disabled:opacity-50"
          >
            {testing ? t("testing") : t("testSend")}
          </button>
        </div>
      </section>
    </div>
  );
}
