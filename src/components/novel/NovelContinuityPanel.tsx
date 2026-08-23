"use client";

import { useTranslations } from "next-intl";
import type { ConsistencyReport } from "@/lib/novel-long-consistency";

export function NovelContinuityPanel({ report }: { report?: ConsistencyReport | null }) {
  const t = useTranslations("novelContinuity");
  if (!report) return null;
  return (
    <section className="rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-4 sm:p-5" data-testid="novel-continuity-report">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--gc-accent)]">{t("eyebrow")}</p>
          <h2 className="mt-1 text-base font-semibold text-[var(--gc-text)]">{t("title")}</h2>
          <p className="mt-1 text-xs leading-relaxed text-[var(--gc-muted)]">{report.ok ? t("ready") : t("needsReview")}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] ${report.ok ? "border-emerald-400/30 text-emerald-400" : "border-amber-400/30 text-amber-300"}`}>
          {report.ok ? t("passed") : t("issues", { count: report.issues.length })}
        </span>
      </div>
      {report.issues.length ? (
        <ul className="mt-4 space-y-2">
          {report.issues.map((issue, index) => (
            <li key={`${issue.code}-${index}`} className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${issue.severity === "error" ? "border-red-400/25 text-red-300" : "border-amber-400/25 text-amber-200"}`}>
              <span className="mr-2 text-[10px] font-semibold uppercase tracking-wide opacity-75">{issue.severity === "error" ? t("error") : t("warning")}</span>
              {issue.message}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
