"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { AdminOpsHealthReport, OpsHealthStatus } from "@/lib/admin-ops-health";

const STATUS_STYLE: Record<OpsHealthStatus, string> = {
  ok: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
  warn: "border-amber-500/30 bg-amber-500/5 text-amber-200",
  fail: "border-rose-500/40 bg-rose-500/10 text-rose-200",
};

const DOT_STYLE: Record<OpsHealthStatus, string> = {
  ok: "bg-emerald-400",
  warn: "bg-amber-400",
  fail: "bg-rose-500",
};

export function OpsHealthPanel({
  headers,
  onGoSamples,
  onGoPending,
}: {
  headers: () => HeadersInit;
  onGoSamples?: () => void;
  onGoPending?: () => void;
}) {
  const t = useTranslations("adminPage");
  const [report, setReport] = useState<AdminOpsHealthReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ops-health", { headers: headers() });
      if (res.ok) setReport((await res.json()) as AdminOpsHealthReport);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !report) {
    return (
      <div className="rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-5">
        <p className="text-sm text-[var(--gc-muted)]">{t("loading")}</p>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div
      className="rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-5"
      data-testid="admin-ops-health-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--gc-text)]">{t("healthTitle")}</p>
          <p className="mt-1 text-xs text-[var(--gc-muted)]">{t("healthSubtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${STATUS_STYLE[report.overall]}`}>
            <span className={`h-2 w-2 rounded-full ${DOT_STYLE[report.overall]}`} />
            {t(`healthOverall_${report.overall}` as "healthOverall_ok")}
          </span>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-full border border-[color:var(--gc-border)] px-3 py-1 text-xs text-[var(--gc-muted)] hover:text-[var(--gc-text)]"
          >
            {t("healthRefresh")}
          </button>
        </div>
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {report.checks.map((check) => (
          <li
            key={check.id}
            className={`rounded-xl border px-3 py-2.5 text-sm ${STATUS_STYLE[check.status]}`}
            data-testid={`health-check-${check.id}`}
          >
            <div className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_STYLE[check.status]}`} />
              <span className="font-medium">{t(check.labelKey as "healthCheck_db")}</span>
              {check.detail ? <span className="ml-auto font-mono text-xs opacity-80">{check.detail}</span> : null}
            </div>
            {check.hintKey ? (
              <p className="mt-1.5 text-xs opacity-80">{t(check.hintKey as "healthHint_db")}</p>
            ) : null}
            {check.id === "samples_sync" && check.status !== "ok" && onGoSamples ? (
              <button type="button" className="mt-2 text-xs underline opacity-90" onClick={onGoSamples}>
                {t("healthGoSamples")}
              </button>
            ) : null}
            {check.id === "moderation" && check.status === "warn" && onGoPending ? (
              <button type="button" className="mt-2 text-xs underline opacity-90" onClick={onGoPending}>
                {t("healthGoPending")}
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {report.qaSnapshots.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs text-[var(--gc-muted)]">
          {report.qaSnapshots.map((snap) => (
            <li key={snap.script}>
              {t("healthQaLastRun", {
                script: snap.script,
                passed: snap.passed,
                total: snap.total,
                hours: snap.ageHours,
              })}
              {snap.failedIds?.length ? (
                <span className="ml-1 text-amber-300/90">({snap.failedIds.slice(0, 3).join(", ")})</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-5 border-t border-[color:var(--gc-border)] pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--gc-text-faint)]">{t("healthQaTitle")}</p>
        <ul className="mt-2 space-y-1.5">
          {report.qaCommands.map((cmd) => (
            <li key={cmd.id} className="flex flex-wrap items-baseline gap-x-2 text-xs text-[var(--gc-muted)]">
              <span>{t(cmd.labelKey as "healthQa_admin")}</span>
              <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-[10px] text-sky-300/90">{cmd.command}</code>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
