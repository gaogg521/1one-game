"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ConsolePreferencesToolbar } from "@/components/admin/ConsolePreferencesToolbar";

export function ConsoleTwoFactorGate({ consolePath }: { consolePath: string }) {
  const t = useTranslations("adminConsole");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/console/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pin.trim() }),
      });
      if (!res.ok) {
        setError(t("twoFactorInvalid"));
        return;
      }
      window.location.href = consolePath;
    } catch {
      setError(t("twoFactorNetwork"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[var(--gc-bg)] px-6 text-center text-[var(--gc-text)]">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ConsolePreferencesToolbar />
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--gc-text-faint)]">{t("eyebrow")}</p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{t("twoFactorTitle")}</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--gc-muted)]">{t("twoFactorDesc")}</p>
      <form onSubmit={submit} className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <input
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder={t("twoFactorPlaceholder")}
          className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-center text-lg tracking-[0.3em] text-white outline-none focus:border-sky-500/50"
        />
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
        <button
          type="submit"
          disabled={busy || !pin.trim()}
          className="rounded-full bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {busy ? t("twoFactorVerifying") : t("twoFactorAction")}
        </button>
      </form>
      <Link href="/" className="mt-6 text-sm text-white/45 hover:text-white/70">
        {t("backToProduct")}
      </Link>
    </div>
  );
}
