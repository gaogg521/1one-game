"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { chartScaleMax } from "@/lib/admin-chart-scale";

export type DayPoint = { date: string; value: number };

type SeriesInput = {
  key: string;
  label: string;
  color: string;
  points: DayPoint[];
};

const CHART_COLORS = {
  accent: "color-mix(in srgb, var(--gc-accent) 85%, white)",
  game: "#38bdf8",
  novel: "#a78bfa",
  comic: "#fbbf24",
  referral: "#34d399",
  commerce: "#f472b6",
};

function maxValue(points: DayPoint[]): number {
  return Math.max(1, ...points.map((p) => p.value));
}

function formatShortDate(date: string): string {
  const [, m, d] = date.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function formatMoney(cents: number): string {
  if (cents >= 100_000) return `¥${(cents / 100).toFixed(0)}`;
  return `¥${(cents / 100).toFixed(2)}`;
}

export function ChartPanel({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)] p-5 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--gc-text)_4%,transparent)] ${className}`}
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-[var(--gc-text)]">{title}</h3>
          {subtitle ? <p className="mt-1 text-xs text-[var(--gc-text-faint)]">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </div>
  );
}

/** 多序列日趋势 — 分组柱状图（稀疏计数比折线更易读） */
export function AdminTrendChart({
  series,
  height = 168,
}: {
  series: SeriesInput[];
  height?: number;
}) {
  const t = useTranslations("adminCharts");
  const allPoints = series.flatMap((s) => s.points);
  const max = chartScaleMax(allPoints);
  const dayCount = series[0]?.points.length ?? 0;

  if (dayCount === 0 || allPoints.every((p) => p.value === 0)) {
    return <EmptyChartHint text={t("emptyPeriod")} />;
  }

  const yTicks = [max, Math.ceil(max / 2), 0];
  const labelIndices =
    dayCount <= 5
      ? Array.from({ length: dayCount }, (_, i) => i)
      : [0, Math.floor((dayCount - 1) / 3), Math.floor(((dayCount - 1) * 2) / 3), dayCount - 1];

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-3">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-[var(--gc-muted)]">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="flex gap-2" style={{ minHeight: height }}>
        <div className="flex w-10 shrink-0 flex-col justify-between py-0.5 text-[10px] tabular-nums leading-none text-[var(--gc-text-faint)]">
          {yTicks.map((v) => (
            <span key={v}>{v}</span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 border-b border-[color:color-mix(in_srgb,var(--gc-border)_55%,transparent)]"
            style={{ height }}
          >
            <div className="absolute inset-x-0 top-1/4 border-t border-dashed border-[color:color-mix(in_srgb,var(--gc-border)_35%,transparent)]" />
            <div className="absolute inset-x-0 top-2/4 border-t border-dashed border-[color:color-mix(in_srgb,var(--gc-border)_35%,transparent)]" />
            <div className="absolute inset-x-0 top-3/4 border-t border-dashed border-[color:color-mix(in_srgb,var(--gc-border)_35%,transparent)]" />
          </div>
          <div
            className="relative flex items-end gap-px border-b border-[color:color-mix(in_srgb,var(--gc-border)_70%,transparent)]"
            style={{ height }}
          >
            {Array.from({ length: dayCount }, (_, dayIdx) => (
              <div
                key={series[0]?.points[dayIdx]?.date ?? dayIdx}
                className="flex h-full min-w-0 flex-1 items-end justify-center gap-px px-px"
              >
                {series.map((s) => {
                  const value = s.points[dayIdx]?.value ?? 0;
                  const barPx =
                    max > 0 && value > 0 ? Math.max(2, Math.round((value / max) * height)) : 0;
                  return (
                    <div
                      key={s.key}
                      title={`${s.label}: ${value}`}
                      className="min-w-[2px] max-w-[10px] shrink-0 flex-1 rounded-t-[2px]"
                      style={{
                        height: barPx,
                        background: s.color,
                        opacity: value > 0 ? 0.92 : 0.12,
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="relative mt-2 flex justify-between text-[10px] text-[var(--gc-text-faint)]">
            {labelIndices.map((idx) => (
              <span key={idx} className="tabular-nums">
                {series[0]?.points[idx] ? formatShortDate(series[0].points[idx]!.date) : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 环形占比图 */
export function AdminDonutChart({
  segments,
  centerLabel,
  centerValue,
}: {
  segments: { label: string; value: number; color: string }[];
  centerLabel: string;
  centerValue: string | number;
}) {
  const t = useTranslations("adminCharts");
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return <EmptyChartHint text={t("emptyDistribution")} />;

  const r = 42;
  const c = 2 * Math.PI * r;
  const rings = segments.reduce<{ seg: (typeof segments)[number]; len: number; offset: number }[]>(
    (acc, seg) => {
      const len = (seg.value / total) * c;
      const offset = acc.length > 0 ? acc[acc.length - 1]!.offset + acc[acc.length - 1]!.len : 0;
      acc.push({ seg, len, offset });
      return acc;
    },
    [],
  );

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="color-mix(in srgb, var(--gc-border) 55%, transparent)" strokeWidth="12" />
          {rings.map(({ seg, len, offset }) => (
            <circle
              key={seg.label}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="12"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-[10px] uppercase tracking-wide text-[var(--gc-text-faint)]">{centerLabel}</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-[var(--gc-text)]">{centerValue}</p>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2 text-sm">
        {segments.map((seg) => (
          <li key={seg.label} className="flex items-center justify-between gap-3">
            <span className="inline-flex min-w-0 items-center gap-2 text-[var(--gc-text-soft)]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: seg.color }} />
              <span className="truncate">{seg.label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-[var(--gc-muted)]">
              {seg.value}
              <span className="ml-1 text-[10px]">({Math.round((seg.value / total) * 100)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 横向排行条 */
export function AdminRankBars({
  items,
  valueSuffix = "",
}: {
  items: { label: string; value: number; hint?: string }[];
  valueSuffix?: string;
}) {
  const t = useTranslations("adminCharts");
  if (items.length === 0) return <EmptyChartHint text={t("emptyRanking")} />;
  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <ul className="space-y-3">
      {items.map((item, idx) => (
        <li key={`${item.label}-${idx}`}>
          <div className="mb-1 flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate text-[var(--gc-text-soft)]">
              <span className="mr-2 text-[10px] text-[var(--gc-text-faint)]">#{idx + 1}</span>
              {item.label}
            </span>
            <span className="shrink-0 tabular-nums text-[var(--gc-muted)]">
              {item.value}
              {valueSuffix}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[color:color-mix(in_srgb,var(--gc-border)_45%,transparent)]">
            <div
              className="h-full rounded-full bg-[color:var(--gc-accent)] transition-all"
              style={{ width: `${(item.value / max) * 100}%`, opacity: 0.55 + (item.value / max) * 0.45 }}
            />
          </div>
          {item.hint ? <p className="mt-1 text-[10px] text-[var(--gc-text-faint)]">{item.hint}</p> : null}
        </li>
      ))}
    </ul>
  );
}

/** 社交裂变漏斗 */
export function AdminFunnelChart({
  stages,
}: {
  stages: { stage: string; value: number }[];
}) {
  const tPage = useTranslations("adminPage");
  const tCharts = useTranslations("adminCharts");
  if (stages.length === 0) return <EmptyChartHint text={tCharts("emptyFunnel")} />;
  const max = Math.max(1, ...stages.map((s) => s.value));

  return (
    <div className="space-y-2">
      {stages.map((stage, idx) => {
        const stageKey = `funnelStages.${stage.stage}` as Parameters<typeof tPage>[0];
        const stageLabel = tPage.has(stageKey) ? tPage(stageKey) : stage.stage;
        const widthPct = 35 + (stage.value / max) * 65;
        const prev = idx > 0 ? stages[idx - 1]!.value : null;
        const stepRate = prev && prev > 0 ? Math.round((stage.value / prev) * 1000) / 10 : null;
        return (
          <div key={stage.stage} className="flex items-center gap-3">
            <div className="w-20 shrink-0 text-right text-xs text-[var(--gc-muted)]">{stageLabel}</div>
            <div className="min-w-0 flex-1">
              <div
                className="rounded-lg border border-[color:color-mix(in_srgb,var(--gc-accent)_25%,var(--gc-border))] bg-[color:color-mix(in_srgb,var(--gc-accent)_12%,transparent)] px-3 py-2"
                style={{ width: `${widthPct}%`, minWidth: "8rem" }}
              >
                <span className="text-sm font-semibold tabular-nums text-[var(--gc-text)]">{stage.value}</span>
                {stepRate !== null ? (
                  <span className="ml-2 text-[10px] text-[var(--gc-text-faint)]">
                    {tCharts("conversionRate", { rate: stepRate })}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 额度流水原因条形图 */
export function AdminQuotaBars({
  items,
}: {
  items: { reason: string; deltaSum: number; events: number }[];
}) {
  const tPage = useTranslations("adminPage");
  const tCharts = useTranslations("adminCharts");
  if (items.length === 0) return <EmptyChartHint text={tCharts("emptyQuota")} />;
  const max = Math.max(1, ...items.map((i) => Math.abs(i.deltaSum)));

  return (
    <ul className="space-y-3">
      {items.slice(0, 8).map((item) => {
        const positive = item.deltaSum >= 0;
        const labelKey = `quotaReasons.${item.reason}` as Parameters<typeof tPage>[0];
        const label = tPage.has(labelKey) ? tPage(labelKey) : item.reason;
        return (
          <li key={item.reason}>
            <div className="mb-1 flex justify-between gap-2 text-xs">
              <span className="text-[var(--gc-text-soft)]">{label}</span>
              <span className={`tabular-nums ${positive ? "text-emerald-400" : "text-amber-400"}`}>
                {positive ? "+" : ""}
                {tCharts("quotaDelta", { delta: item.deltaSum, events: item.events })}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[color:color-mix(in_srgb,var(--gc-border)_45%,transparent)]">
              <div
                className={`h-full rounded-full ${positive ? "bg-emerald-500/70" : "bg-amber-500/70"}`}
                style={{ width: `${(Math.abs(item.deltaSum) / max) * 100}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function AdminKpiStrip({
  items,
}: {
  items: { label: string; value: string | number; hint?: string; tone?: "default" | "accent" | "warn" }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className={`rounded-xl border px-3 py-3 ${
            item.tone === "accent"
              ? "border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))] bg-[color:color-mix(in_srgb,var(--gc-accent)_14%,var(--gc-bg-elevated))]"
              : item.tone === "warn"
                ? "border-amber-500/30 bg-[color:color-mix(in_srgb,#f59e0b_12%,var(--gc-bg-elevated))]"
                : "border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)]"
          }`}
        >
          <p className="text-[10px] uppercase tracking-wide text-[var(--gc-muted)]">{item.label}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--gc-text)]">{item.value}</p>
          {item.hint ? <p className="mt-0.5 text-[10px] text-[var(--gc-text-faint)]">{item.hint}</p> : null}
        </div>
      ))}
    </div>
  );
}

function EmptyChartHint({ text }: { text: string }) {
  return (
    <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed border-[color:var(--gc-border)] text-sm text-[var(--gc-text-faint)]">
      {text}
    </div>
  );
}

export { CHART_COLORS, formatMoney };
