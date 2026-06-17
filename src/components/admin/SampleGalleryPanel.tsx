"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { withLocalePath } from "@/i18n/navigation";
import { AdminKpiStrip } from "@/components/admin/AdminCharts";
import type { AdminSampleGalleryReport, AdminSampleRow } from "@/lib/admin-sample-gallery";

type Filter = "all" | "missing" | "noCover";

export function SampleGalleryPanel({
  headers,
  onNotice,
}: {
  headers: () => HeadersInit;
  onNotice: (notice: { kind: "ok" | "error"; text: string }) => void;
}) {
  const t = useTranslations("adminPage");
  const locale = useLocale() as AppLocale;
  const [report, setReport] = useState<AdminSampleGalleryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchBusy, setBatchBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/samples", { headers: headers() });
      if (!res.ok) {
        onNotice({ kind: "error", text: t("samplesLoadFailed") });
        return;
      }
      setReport((await res.json()) as AdminSampleGalleryReport);
    } catch {
      onNotice({ kind: "error", text: t("samplesLoadFailed") });
    } finally {
      setLoading(false);
    }
  }, [headers, onNotice, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!report) return [];
    const q = query.trim().toLowerCase();
    return report.items.filter((item) => {
      if (filter === "missing" && item.synced) return false;
      if (filter === "noCover" && item.hasCover) return false;
      if (!q) return true;
      return `${item.title} ${item.sampleId} ${item.projectId}`.toLowerCase().includes(q);
    });
  }, [filter, query, report]);

  async function syncAll() {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/samples", { method: "POST", headers: headers() });
      const data = (await res.json().catch(() => ({}))) as { report?: AdminSampleGalleryReport; error?: string };
      if (!res.ok) {
        onNotice({ kind: "error", text: data.error || t("samplesSyncFailed") });
        return;
      }
      if (data.report) setReport(data.report);
      else await load();
      onNotice({ kind: "ok", text: t("samplesSyncDone", { count: data.report?.syncedCount ?? report?.syncedCount ?? 0 }) });
    } catch {
      onNotice({ kind: "error", text: t("samplesSyncFailed") });
    } finally {
      setSyncing(false);
    }
  }

  async function batchFeatured(featured: boolean) {
    const ids = [...selected];
    if (!ids.length) {
      onNotice({ kind: "error", text: t("samplesSelectFirst") });
      return;
    }
    setBatchBusy(true);
    try {
      const res = await fetch("/api/admin/samples", {
        method: "PATCH",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ projectIds: ids, featured }),
      });
      if (!res.ok) {
        onNotice({ kind: "error", text: t("actionFailed") });
        return;
      }
      onNotice({ kind: "ok", text: t("samplesBatchDone", { count: ids.length }) });
      setSelected(new Set());
      await load();
    } finally {
      setBatchBusy(false);
    }
  }

  function toggleSelect(projectId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  async function toggleFeatured(item: AdminSampleRow) {
    const res = await fetch("/api/admin/samples", {
      method: "PATCH",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: item.projectId, featured: !item.featured }),
    });
    if (!res.ok) {
      onNotice({ kind: "error", text: t("actionFailed") });
      return;
    }
    onNotice({ kind: "ok", text: t("actionDone") });
    await load();
  }

  if (loading && !report) {
    return <p className="text-sm text-[var(--gc-muted)]">{t("loading")}</p>;
  }

  if (!report) {
    return (
      <div className="rounded-2xl border border-[color:var(--gc-border)] p-6 text-sm text-[var(--gc-muted)]">
        {t("samplesEmpty")}
      </div>
    );
  }

  return (
    <section className="space-y-5" data-testid="admin-samples-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-[var(--gc-text)]">{t("samplesTitle")}</h2>
          <p className="mt-1 text-sm text-[var(--gc-muted)]">{t("samplesSubtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={withLocalePath("/samples", locale)}
            className="rounded-full border border-[color:var(--gc-border)] px-4 py-2 text-sm text-[var(--gc-muted)] hover:text-[var(--gc-text)]"
            target="_blank"
            rel="noreferrer"
          >
            {t("samplesOpenPublic")}
          </Link>
          <button
            type="button"
            disabled={syncing}
            onClick={() => void syncAll()}
            className="rounded-full border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-400 disabled:opacity-50"
          >
            {syncing ? t("samplesSyncing") : t("samplesSyncAll")}
          </button>
        </div>
      </div>

      <AdminKpiStrip
        items={[
          { label: t("samplesKpiCatalog"), value: report.catalogCount },
          {
            label: t("samplesKpiSynced"),
            value: report.syncedCount,
            hint: t("samplesKpiDbHint", { count: report.dbCount }),
            tone: report.syncedCount < report.catalogCount ? "warn" : "default",
          },
          {
            label: t("samplesKpiMissing"),
            value: report.missingInDb.length,
            tone: report.missingInDb.length > 0 ? "warn" : "default",
          },
          {
            label: t("samplesKpiNoCover"),
            value: report.items.filter((i) => !i.hasCover).length,
            tone: report.items.some((i) => !i.hasCover) ? "warn" : "default",
          },
        ]}
      />

      {report.missingInDb.length > 0 || report.orphanInDb.length > 0 ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-200/90">
          {report.missingInDb.length > 0 ? (
            <p>{t("samplesMissingHint", { count: report.missingInDb.length })}</p>
          ) : null}
          {report.orphanInDb.length > 0 ? (
            <p className="mt-1 text-xs text-amber-200/70">{t("samplesOrphanHint", { count: report.orphanInDb.length })}</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("samplesSearchPlaceholder")}
          className="min-w-[14rem] flex-1 rounded-xl border border-[color:var(--gc-border)] bg-black/20 px-3 py-2 text-sm text-[var(--gc-text)]"
        />
        <div className="flex flex-wrap gap-2">
          {(["all", "missing", "noCover"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                filter === f
                  ? "bg-[color:color-mix(in_srgb,var(--gc-accent)_18%,transparent)] text-[var(--gc-text)]"
                  : "border border-[color:var(--gc-border)] text-[var(--gc-muted)]"
              }`}
            >
              {t(`samplesFilter_${f}` as "samplesFilter_all")}
            </button>
          ))}
        </div>
        <span className="text-xs text-[var(--gc-text-faint)]">{t("totalCount", { total: filtered.length })}</span>
      </div>

      {filtered.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-[color:var(--gc-border)] px-3 py-1.5 text-xs text-[var(--gc-muted)]"
            onClick={() => setSelected(new Set(filtered.map((i) => i.projectId)))}
          >
            {t("selectAll")}
          </button>
          {selected.size > 0 ? (
            <>
              <button
                type="button"
                disabled={batchBusy}
                className="rounded-full border border-[var(--gc-accent)]/40 px-3 py-1.5 text-xs text-[var(--gc-accent)] disabled:opacity-50"
                onClick={() => void batchFeatured(true)}
              >
                {t("samplesBatchFeature", { count: selected.size })}
              </button>
              <button
                type="button"
                disabled={batchBusy}
                className="rounded-full border border-[color:var(--gc-border)] px-3 py-1.5 text-xs text-[var(--gc-muted)] disabled:opacity-50"
                onClick={() => void batchFeatured(false)}
              >
                {t("samplesBatchUnfeature", { count: selected.size })}
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-[color:var(--gc-border)]">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="bg-[var(--gc-surface-glass)] text-[var(--gc-muted)]">
            <tr>
              <th className="px-4 py-3" />
              <th className="px-4 py-3 font-medium">{t("samplesColCover")}</th>
              <th className="px-4 py-3 font-medium">{t("colTitle")}</th>
              <th className="px-4 py-3 font-medium">{t("samplesColStatus")}</th>
              <th className="px-4 py-3 font-medium">{t("colEngagement")}</th>
              <th className="px-4 py-3 font-medium">{t("colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <SampleRow
                key={item.projectId}
                item={item}
                locale={locale}
                checked={selected.has(item.projectId)}
                onToggleSelect={() => toggleSelect(item.projectId)}
                onToggleFeatured={() => void toggleFeatured(item)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SampleRow({
  item,
  locale,
  checked,
  onToggleSelect,
  onToggleFeatured,
}: {
  item: AdminSampleRow;
  locale: AppLocale;
  checked: boolean;
  onToggleSelect: () => void;
  onToggleFeatured: () => void;
}) {
  const t = useTranslations("adminPage");
  const coverSrc = item.coverPath || item.coverImageSrc;

  return (
    <tr className="border-t border-[color:var(--gc-border)]" data-testid={`admin-sample-row-${item.sampleId}`}>
      <td className="px-4 py-3">
        <input type="checkbox" checked={checked} onChange={onToggleSelect} aria-label={item.title} />
      </td>
      <td className="px-4 py-3">
        <div className="relative h-14 w-11 overflow-hidden rounded-lg border border-[color:var(--gc-border)] bg-black/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverSrc} alt="" className="h-full w-full object-cover" />
        </div>
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-[var(--gc-text)]">{item.title}</p>
        <p className="mt-0.5 text-xs text-[var(--gc-muted)]">{item.subtitle}</p>
        <p className="mt-1 font-mono text-[10px] text-[var(--gc-text-faint)]">{item.sampleId}</p>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1 text-xs">
          <span className={item.synced ? "text-emerald-400" : "text-amber-400"}>
            {item.synced ? t("samplesStatusSynced") : t("samplesStatusMissing")}
          </span>
          {item.featured ? <span className="text-[var(--gc-accent)]">{t("samplesShelfFeatured")}</span> : null}
          {!item.hasCover ? <span className="text-amber-400">{t("samplesStatusNoCover")}</span> : null}
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-[var(--gc-muted)]">
        {t("engagementPlays", { count: item.playCount })}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          <Link
            href={withLocalePath(item.playPath, locale)}
            className="text-sm text-sky-400 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            {t("actionPlay")}
          </Link>
          <button type="button" className="text-sm text-[var(--gc-accent)]" onClick={onToggleFeatured}>
            {item.featured ? t("actionUnfeature") : t("actionFeature")}
          </button>
        </div>
      </td>
    </tr>
  );
}
