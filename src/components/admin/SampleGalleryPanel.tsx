"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { withLocalePath } from "@/i18n/navigation";
import { AdminKpiStrip } from "@/components/admin/AdminCharts";
import type { AdminSampleGalleryReport, AdminSampleRow } from "@/lib/admin-sample-gallery";

type Filter = "all" | "missing" | "noCover" | "hidden" | "copied";

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
      if (filter === "missing" && item.inDb) return false;
      if (filter === "noCover" && item.hasCover) return false;
      if (filter === "hidden" && item.visibility !== "hidden") return false;
      if (filter === "copied" && item.inCatalog) return false;
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

  async function patchSamples(ids: string[], body: { featured?: boolean; visibility?: "public" | "hidden" }) {
    if (!ids.length) {
      onNotice({ kind: "error", text: t("samplesSelectFirst") });
      return false;
    }
    const res = await fetch("/api/admin/samples", {
      method: "PATCH",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ projectIds: ids, ...body }),
    });
    if (!res.ok) {
      onNotice({ kind: "error", text: t("actionFailed") });
      return false;
    }
    return true;
  }

  async function removeSamples(ids: string[]) {
    if (!ids.length) {
      onNotice({ kind: "error", text: t("samplesSelectFirst") });
      return false;
    }
    const res = await fetch("/api/admin/samples", {
      method: "DELETE",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ projectIds: ids }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      unlisted?: number;
      deleted?: number;
      error?: string;
    };
    if (!res.ok) {
      onNotice({ kind: "error", text: data.error || t("actionFailed") });
      return false;
    }
    onNotice({
      kind: "ok",
      text: t("samplesRemoveDone", {
        count: (data.unlisted ?? 0) + (data.deleted ?? 0),
        unlisted: data.unlisted ?? 0,
        deleted: data.deleted ?? 0,
      }),
    });
    return true;
  }

  async function batchFeatured(featured: boolean) {
    const ids = [...selected];
    if (!ids.length) {
      onNotice({ kind: "error", text: t("samplesSelectFirst") });
      return;
    }
    setBatchBusy(true);
    try {
      const ok = await patchSamples(ids, { featured });
      if (!ok) return;
      onNotice({ kind: "ok", text: t("samplesBatchDone", { count: ids.length }) });
      setSelected(new Set());
      await load();
    } finally {
      setBatchBusy(false);
    }
  }

  async function batchUnlist() {
    const ids = [...selected];
    if (!ids.length) {
      onNotice({ kind: "error", text: t("samplesSelectFirst") });
      return;
    }
    if (!window.confirm(t("confirmBatchUnlistSamples", { count: ids.length }))) return;
    setBatchBusy(true);
    try {
      const ok = await patchSamples(ids, { visibility: "hidden", featured: false });
      if (!ok) return;
      onNotice({ kind: "ok", text: t("samplesBatchDone", { count: ids.length }) });
      setSelected(new Set());
      await load();
    } finally {
      setBatchBusy(false);
    }
  }

  async function batchRemove() {
    const ids = [...selected];
    if (!ids.length) {
      onNotice({ kind: "error", text: t("samplesSelectFirst") });
      return;
    }
    if (!window.confirm(t("confirmBatchRemoveSamples", { count: ids.length }))) return;
    setBatchBusy(true);
    try {
      const ok = await removeSamples(ids);
      if (!ok) return;
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
    if (item.featured && !window.confirm(t("confirmUnfeature"))) return;
    const ok = await patchSamples([item.projectId], { featured: !item.featured });
    if (!ok) return;
    onNotice({ kind: "ok", text: t("actionDone") });
    await load();
  }

  async function toggleListed(item: AdminSampleRow) {
    if (item.listed) {
      if (!window.confirm(t("confirmUnlistSample", { title: item.title }))) return;
      const ok = await patchSamples([item.projectId], { visibility: "hidden", featured: false });
      if (!ok) return;
    } else {
      const ok = await patchSamples([item.projectId], { visibility: "public" });
      if (!ok) return;
    }
    onNotice({ kind: "ok", text: t("actionDone") });
    await load();
  }

  async function removeOne(item: AdminSampleRow) {
    const message = item.inCatalog
      ? t("confirmUnlistCatalogSample", { title: item.title })
      : t("confirmRemoveCopiedSample", { title: item.title });
    if (!window.confirm(message)) return;
    const ok = await removeSamples([item.projectId]);
    if (!ok) return;
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

  const hiddenCount = report.items.filter((i) => i.visibility === "hidden").length;

  return (
    <section className="space-y-5" data-testid="admin-samples-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="gc-admin-type-panel">{t("samplesTitle")}</h2>
          <p className="gc-admin-type-body mt-1">{t("samplesSubtitle")}</p>
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
            label: t("samplesKpiHidden"),
            value: hiddenCount,
            tone: hiddenCount > 0 ? "warn" : "default",
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
          {(["all", "missing", "noCover", "hidden", "copied"] as const).map((f) => (
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
            onClick={() => setSelected(new Set(filtered.filter((i) => i.inDb).map((i) => i.projectId)))}
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
                className="rounded-full border border-rose-500/40 px-3 py-1.5 text-xs text-rose-300 disabled:opacity-50"
                onClick={() => void batchFeatured(false)}
              >
                {t("samplesBatchUnfeature", { count: selected.size })}
              </button>
              <button
                type="button"
                disabled={batchBusy}
                className="rounded-full border border-amber-500/40 px-3 py-1.5 text-xs text-amber-300 disabled:opacity-50"
                onClick={() => void batchUnlist()}
              >
                {t("samplesBatchUnlist", { count: selected.size })}
              </button>
              <button
                type="button"
                disabled={batchBusy}
                className="rounded-full border border-rose-500/40 px-3 py-1.5 text-xs text-rose-400 disabled:opacity-50"
                onClick={() => void batchRemove()}
              >
                {t("samplesBatchRemove", { count: selected.size })}
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
                onToggleListed={() => void toggleListed(item)}
                onRemove={() => void removeOne(item)}
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
  onToggleListed,
  onRemove,
}: {
  item: AdminSampleRow;
  locale: AppLocale;
  checked: boolean;
  onToggleSelect: () => void;
  onToggleFeatured: () => void;
  onToggleListed: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations("adminPage");
  const coverSrc = item.coverPath || item.coverImageSrc;

  return (
    <tr className="border-t border-[color:var(--gc-border)]" data-testid={`admin-sample-row-${item.sampleId}`}>
      <td className="px-4 py-3">
        <input type="checkbox" checked={checked} onChange={onToggleSelect} aria-label={item.title} disabled={!item.inDb} />
      </td>
      <td className="px-4 py-3">
        <div className="relative h-14 w-11 overflow-hidden rounded-lg border border-[color:var(--gc-border)] bg-black/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverSrc} alt="" className="h-full w-full object-cover" />
        </div>
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-[var(--gc-text)]">{item.title}</p>
        {item.subtitle ? <p className="mt-0.5 text-xs text-[var(--gc-muted)]">{item.subtitle}</p> : null}
        <p className="mt-1 font-mono text-[10px] text-[var(--gc-text-faint)]">{item.sampleId}</p>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1 text-xs">
          {!item.inDb ? (
            <span className="text-amber-400">{t("samplesStatusMissing")}</span>
          ) : item.listed ? (
            <span className="text-emerald-400">{t("samplesStatusListed")}</span>
          ) : (
            <span className="text-amber-400">{t("samplesStatusUnlisted")}</span>
          )}
          {item.featured ? <span className="text-[var(--gc-accent)]">{t("samplesShelfFeatured")}</span> : null}
          {!item.inCatalog && item.inDb ? <span className="text-sky-300">{t("samplesCopiedBadge")}</span> : null}
          {!item.hasCover ? <span className="text-amber-400">{t("samplesStatusNoCover")}</span> : null}
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-[var(--gc-muted)]">
        {t("engagementPlays", { count: item.playCount })}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {item.inDb ? (
            <Link
              href={withLocalePath(item.playPath, locale)}
              className="text-sm text-sky-400 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              {t("actionPlay")}
            </Link>
          ) : null}
          {item.inDb ? (
            <button
              type="button"
              data-testid={`admin-sample-unfeature-${item.sampleId}`}
              className={`text-sm ${item.featured ? "text-rose-400" : "text-[var(--gc-accent)]"}`}
              onClick={onToggleFeatured}
            >
              {item.featured ? t("actionUnfeature") : t("actionFeature")}
            </button>
          ) : null}
          {item.inDb ? (
            <button
              type="button"
              data-testid={`admin-sample-unlist-${item.sampleId}`}
              className={`text-sm ${item.listed ? "text-amber-400" : "text-emerald-400"}`}
              onClick={onToggleListed}
            >
              {item.listed ? t("samplesUnlist") : t("samplesRelist")}
            </button>
          ) : null}
          {item.inDb ? (
            <button
              type="button"
              data-testid={`admin-sample-remove-${item.sampleId}`}
              className="text-sm text-rose-400"
              onClick={onRemove}
            >
              {t("samplesRemove")}
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
