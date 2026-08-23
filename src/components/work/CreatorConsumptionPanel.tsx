"use client";

import { useTranslations } from "next-intl";

export type CreatorConsumptionSummary = {
  sampleSize: number;
  starts: number;
  completed: number;
  completionRate: number;
  averageProgressRate: number;
  unitViews: number;
  health: {
    status: "insufficient_sample" | "attention" | "healthy";
    minSamples: number;
    alerts: Array<{ code: "low_completion" | "early_dropoff"; recommendedUnitIndex?: number }>;
  };
};

/** Owner-only aggregate insight; intentionally contains no reader-level data. */
export function CreatorConsumptionPanel({ summary, className = "" }: { summary: CreatorConsumptionSummary; className?: string }) {
  const t = useTranslations("creatorEngagement");
  return (
    <section className={`rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-4 ${className}`} data-testid="creator-consumption-insights">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--gc-muted)]">{t("title")}</p>
      {summary.sampleSize === 0 ? (
        <p className="mt-2 text-sm text-[var(--gc-muted)]">{t("noSamples")}</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <Metric label={t("starts")} value={summary.starts} />
            <Metric label={t("completion")} value={`${summary.completionRate}%`} />
            <Metric label={t("progress")} value={`${summary.averageProgressRate}%`} />
            <Metric label={t("completed")} value={summary.completed} />
          </div>
          <EngagementAdvice summary={summary} />
        </>
      )}
      <p className="mt-3 text-[10px] leading-relaxed text-[var(--gc-text-faint)]">{t("privacy")}</p>
    </section>
  );
}

function EngagementAdvice({ summary }: { summary: CreatorConsumptionSummary }) {
  const t = useTranslations("creatorEngagement");
  if (summary.health.status === "insufficient_sample") {
    return <p className="mt-3 text-xs text-[var(--gc-muted)]">{t("collecting", { count: summary.sampleSize, min: summary.health.minSamples })}</p>;
  }
  if (summary.health.status === "healthy") {
    return <p className="mt-3 text-xs text-emerald-500">{t("healthy")}</p>;
  }
  return (
    <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-[var(--gc-text-soft)]" data-testid="creator-consumption-alert">
      {summary.health.alerts.map((alert) => (
        <p key={alert.code}>{alert.code === "low_completion"
          ? t("lowCompletion")
          : t("earlyDropoff", { unit: alert.recommendedUnitIndex ?? 1 })}</p>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg border border-[color:var(--gc-border)] px-3 py-2"><p className="text-[var(--gc-muted)]">{label}</p><p className="mt-1 text-base font-semibold text-[var(--gc-text)]">{value}</p></div>;
}
