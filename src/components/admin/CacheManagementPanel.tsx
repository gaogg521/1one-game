"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CacheBrowserPanel } from "@/components/admin/CacheBrowserPanel";
import { CdnUploadPanel } from "@/components/admin/CdnUploadPanel";
import type { CharacterSheetCacheEntry } from "@/lib/comic-character-sheet-cache-ttl";
import type { CacheEntryWithStats } from "@/app/api/admin/cache-management/list-entries/route";

export type CacheManagementConfig = {
  storageMode: "session" | "home-dir" | "cdn";
  cdnEndpoint?: string;
  ttlDays: number;
  validateIntervalDays: number;
  maxLocalFiles: number;
};

export type CacheStats = {
  totalEntries: number;
  validEntries: number;
  invalidEntries: number;
  expiredEntries: number;
  totalSizeBytes: number;
};

type Props = {
  headers: () => HeadersInit;
  onNotice: (notice: { kind: "ok" | "error"; text: string }) => void;
};

type CachePanel = "management" | "browser" | "cdn";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

function StorageModeIcon({ mode }: { mode: string }) {
  const icons: Record<string, string> = {
    "session": "⚡",
    "home-dir": "💾",
    "cdn": "☁️",
  };
  return <span>{icons[mode] || "?"}</span>;
}

function CacheStatsDisplay({ stats }: { stats: CacheStats | null }) {
  const t = useTranslations("adminPage.cacheManagement");

  if (!stats) {
    return (
      <div className="text-sm text-[var(--gc-muted)]">
        {t("statsLoading")}
      </div>
    );
  }

  const healthScore = stats.totalEntries === 0 ? 100 : Math.round((stats.validEntries / stats.totalEntries) * 100);
  const healthColor = healthScore >= 90 ? "text-emerald-400" : healthScore >= 70 ? "text-amber-400" : "text-red-400";

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-surface)] p-3">
          <p className="text-[11px] uppercase tracking-wide text-[var(--gc-text-faint)]">{t("statsTotalEntries")}</p>
          <p className="mt-1 text-lg font-semibold text-[var(--gc-text)]">{stats.totalEntries}</p>
        </div>
        <div className="rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-surface)] p-3">
          <p className="text-[11px] uppercase tracking-wide text-[var(--gc-text-faint)]">{t("statsValidEntries")}</p>
          <p className="mt-1 text-lg font-semibold text-emerald-400">{stats.validEntries}</p>
        </div>
        <div className="rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-surface)] p-3">
          <p className="text-[11px] uppercase tracking-wide text-[var(--gc-text-faint)]">{t("statsExpiredEntries")}</p>
          <p className="mt-1 text-lg font-semibold text-amber-400">{stats.expiredEntries}</p>
        </div>
        <div className="rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-surface)] p-3">
          <p className="text-[11px] uppercase tracking-wide text-[var(--gc-text-faint)]">{t("statsTotalSize")}</p>
          <p className="mt-1 text-lg font-semibold text-[var(--gc-text)]">{formatBytes(stats.totalSizeBytes)}</p>
        </div>
      </div>

      <div className="rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-surface)] p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--gc-muted)]">{t("statsHealthScore")}</span>
          <span className={`text-lg font-semibold ${healthColor}`}>{healthScore}%</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full transition-all ${
              healthScore >= 90 ? "bg-emerald-500" : healthScore >= 70 ? "bg-amber-500" : "bg-red-500"
            }`}
            style={{ width: `${healthScore}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function CacheManagementPanel({ headers, onNotice }: Props) {
  const t = useTranslations("adminPage.cacheManagement");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [panel, setPanel] = useState<CachePanel>("management");
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [entries, setEntries] = useState<CacheEntryWithStats[]>([]);
  const [config, setConfig] = useState<CacheManagementConfig>({
    storageMode: "home-dir",
    ttlDays: 30,
    validateIntervalDays: 7,
    maxLocalFiles: 1000,
  });

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/cache-management/stats", { headers: headers() });
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as CacheStats;
      setStats(data);
    } catch {
      onNotice({ kind: "error", text: t("statsLoadFailed") });
    } finally {
      setLoading(false);
    }
  }, [headers, onNotice, t]);

  const loadEntries = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/cache-management/list-entries", { headers: headers() });
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as { entries: CacheEntryWithStats[] };
      setEntries(data.entries);
    } catch {
      onNotice({ kind: "error", text: "Failed to load cache entries" });
    }
  }, [headers, onNotice]);

  useEffect(() => {
    void loadStats();
    void loadEntries();
    const interval = setInterval(() => {
      void loadStats();
      void loadEntries();
    }, 30_000); // 刷新间隔 30 秒
    return () => clearInterval(interval);
  }, [loadStats, loadEntries]);

  async function saveConfig() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/cache-management/config", {
        method: "PATCH",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error("failed");
      onNotice({ kind: "ok", text: t("configSaved") });
    } catch {
      onNotice({ kind: "error", text: t("configSaveFailed") });
    } finally {
      setSaving(false);
    }
  }

  async function cleanupExpiredCaches() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/cache-management/cleanup-expired", {
        method: "POST",
        headers: headers(),
      });
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as { cleaned: number };
      onNotice({ kind: "ok", text: t("cleanupExpiredDone", { count: data.cleaned }) });
      void loadStats();
    } catch {
      onNotice({ kind: "error", text: t("cleanupExpiredFailed") });
    } finally {
      setSaving(false);
    }
  }

  async function cleanupAllCaches() {
    if (!confirm(t("cleanupAllConfirm"))) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/cache-management/cleanup-all", {
        method: "POST",
        headers: headers(),
      });
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as { cleaned: number };
      onNotice({ kind: "ok", text: t("cleanupAllDone", { count: data.cleaned }) });
      void loadStats();
    } catch {
      onNotice({ kind: "error", text: t("cleanupAllFailed") });
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-[color:var(--gc-border)] bg-[color:color-mix(in_srgb,var(--gc-bg-elevated)_92%,transparent)] px-3 py-2 text-sm text-[var(--gc-text)] outline-none focus:border-[color:color-mix(in_srgb,var(--gc-accent)_45%,var(--gc-border))]";

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-[var(--gc-text)]">{t("title")}</h3>
        <p className="mt-1 text-sm text-[var(--gc-muted)]">{t("desc")}</p>
      </div>

      {/* 标签页 */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPanel("management")}
          className={`rounded-full px-5 py-2.5 text-sm font-medium transition ${
            panel === "management"
              ? "bg-[color:color-mix(in_srgb,var(--gc-accent)_20%,transparent)] text-[var(--gc-text)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--gc-accent)_40%,transparent)]"
              : "border border-[color:var(--gc-border)] text-[var(--gc-muted)] hover:text-[var(--gc-text)]"
          }`}
        >
          Configuration
        </button>
        <button
          type="button"
          onClick={() => setPanel("browser")}
          className={`rounded-full px-5 py-2.5 text-sm font-medium transition ${
            panel === "browser"
              ? "bg-[color:color-mix(in_srgb,var(--gc-accent)_20%,transparent)] text-[var(--gc-text)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--gc-accent)_40%,transparent)]"
              : "border border-[color:var(--gc-border)] text-[var(--gc-muted)] hover:text-[var(--gc-text)]"
          }`}
        >
          Browser
        </button>
        <button
          type="button"
          onClick={() => setPanel("cdn")}
          className={`rounded-full px-5 py-2.5 text-sm font-medium transition ${
            panel === "cdn"
              ? "bg-[color:color-mix(in_srgb,var(--gc-accent)_20%,transparent)] text-[var(--gc-text)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--gc-accent)_40%,transparent)]"
              : "border border-[color:var(--gc-border)] text-[var(--gc-muted)] hover:text-[var(--gc-text)]"
          }`}
        >
          CDN Upload
        </button>
      </div>

      {/* Management Panel */}
      {panel === "management" && (
        <>
          {/* 缓存统计 */}
      <section className="rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-5">
        <h4 className="text-base font-semibold text-[var(--gc-text)]">{t("sectionStats")}</h4>
        <p className="mt-1 text-xs text-[var(--gc-muted)]">{t("sectionStatsHint")}</p>
        <div className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border border-[color:var(--gc-border)] border-t-[color:var(--gc-accent)]" />
            </div>
          ) : (
            <CacheStatsDisplay stats={stats} />
          )}
        </div>
      </section>

      {/* 存储配置 */}
      <section className="rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-5">
        <h4 className="text-base font-semibold text-[var(--gc-text)]">{t("sectionStorage")}</h4>
        <p className="mt-1 text-xs text-[var(--gc-muted)]">{t("sectionStorageHint")}</p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--gc-text)]">{t("fieldStorageMode")}</label>
            <div className="mt-2 space-y-2">
              {(["session", "home-dir", "cdn"] as const).map((mode) => (
                <label key={mode} className="flex items-center gap-3 text-sm">
                  <input
                    type="radio"
                    name="storageMode"
                    value={mode}
                    checked={config.storageMode === mode}
                    onChange={(e) => setConfig({ ...config, storageMode: e.target.value as typeof mode })}
                  />
                  <StorageModeIcon mode={mode} />
                  <span className="text-[var(--gc-text)]">{t(`storageMode_${mode}`)}</span>
                  <span className="text-xs text-[var(--gc-text-faint)]">{t(`storageMode_${mode}_desc`)}</span>
                </label>
              ))}
            </div>
          </div>

          {config.storageMode === "cdn" && (
            <div>
              <label className="block text-sm font-medium text-[var(--gc-text)]">{t("fieldCdnEndpoint")}</label>
              <input
                type="url"
                className={inputCls}
                value={config.cdnEndpoint || ""}
                onChange={(e) => setConfig({ ...config, cdnEndpoint: e.target.value })}
                placeholder="https://cdn.example.com"
              />
              <p className="mt-1 text-xs text-[var(--gc-text-faint)]">{t("fieldCdnEndpointHint")}</p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-[var(--gc-text)]">{t("fieldTtlDays")}</label>
              <input
                type="number"
                className={inputCls}
                min="1"
                max="365"
                value={config.ttlDays}
                onChange={(e) => setConfig({ ...config, ttlDays: parseInt(e.target.value, 10) || 30 })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--gc-text)]">{t("fieldValidateIntervalDays")}</label>
              <input
                type="number"
                className={inputCls}
                min="1"
                max="30"
                value={config.validateIntervalDays}
                onChange={(e) => setConfig({ ...config, validateIntervalDays: parseInt(e.target.value, 10) || 7 })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--gc-text)]">{t("fieldMaxLocalFiles")}</label>
              <input
                type="number"
                className={inputCls}
                min="100"
                max="10000"
                value={config.maxLocalFiles}
                onChange={(e) => setConfig({ ...config, maxLocalFiles: parseInt(e.target.value, 10) || 1000 })}
              />
            </div>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={() => void saveConfig()}
            className="rounded-lg bg-[color:color-mix(in_srgb,var(--gc-accent)_28%,transparent)] px-4 py-2 text-sm font-medium text-[var(--gc-text)] hover:brightness-110 disabled:opacity-50"
          >
            {saving ? t("saving") : t("save")}
          </button>
        </div>
      </section>

      {/* 缓存管理 */}
      <section className="rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-5">
        <h4 className="text-base font-semibold text-[var(--gc-text)]">{t("sectionCleanup")}</h4>
        <p className="mt-1 text-xs text-[var(--gc-muted)]">{t("sectionCleanupHint")}</p>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => void cleanupExpiredCaches()}
            className="rounded-lg border border-[color:var(--gc-border)] px-4 py-2 text-sm text-[var(--gc-text)] hover:bg-white/5 disabled:opacity-50"
          >
            {saving ? t("cleaning") : t("cleanupExpired")}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void cleanupAllCaches()}
            className="rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50"
          >
            {saving ? t("cleaning") : t("cleanupAll")}
          </button>
          <button
            type="button"
            onClick={() => void loadStats()}
            className="rounded-lg border border-[color:var(--gc-border)] px-4 py-2 text-sm text-[var(--gc-text)] hover:bg-white/5"
          >
            {t("refreshStats")}
          </button>
        </div>
      </section>
        </>
      )}

      {/* Browser Panel */}
      {panel === "browser" && <CacheBrowserPanel headers={headers} onNotice={onNotice} />}

      {/* CDN Upload Panel */}
      {panel === "cdn" && (
        <CdnUploadPanel headers={headers} onNotice={onNotice} entries={entries} />
      )}
    </div>
  );
}
