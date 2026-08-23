"use client";

import { useTranslations } from "next-intl";

export type CreatorConsumptionSummary = {
  sampleSize: number;
  starts: number;
  completed: number;
  completionRate: number;
  averageProgressRate: number;
  unitViews: number;
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
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <Metric label={t("starts")} value={summary.starts} />
          <Metric label={t("completion")} value={`${summary.completionRate}%`} />
          <Metric label={t("progress")} value={`${summary.averageProgressRate}%`} />
          <Metric label={t("completed")} value={summary.completed} />
        </div>
      )}
      <p className="mt-3 text-[10px] leading-relaxed text-[var(--gc-text-faint)]">{t("privacy")}</p>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg border border-[color:var(--gc-border)] px-3 py-2"><p className="text-[var(--gc-muted)]">{label}</p><p className="mt-1 text-base font-semibold text-[var(--gc-text)]">{value}</p></div>;
}
