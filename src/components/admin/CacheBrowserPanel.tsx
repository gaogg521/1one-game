"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { CacheEntryWithStats } from "@/app/api/admin/cache-management/list-entries/route";

type Props = {
  headers: () => HeadersInit;
  onNotice: (notice: { kind: "ok" | "error"; text: string }) => void;
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString("zh-Hans", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ValidBadge({ valid }: { valid: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
        valid ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
      }`}
    >
      {valid ? "✓ Valid" : "✗ Invalid"}
    </span>
  );
}

export function CacheBrowserPanel({ headers, onNotice }: Props) {
  const t = useTranslations("adminPage.cacheManagement");
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<CacheEntryWithStats[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterComicKey, setFilterComicKey] = useState("");
  const [filterValid, setFilterValid] = useState<"all" | "valid" | "invalid">("all");
  const [deleting, setDeleting] = useState(false);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/cache-management/list-entries", { headers: headers() });
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as { entries: CacheEntryWithStats[] };
      setEntries(data.entries);
      setSelected(new Set());
    } catch {
      onNotice({ kind: "error", text: "Failed to load cache entries" });
    } finally {
      setLoading(false);
    }
  }, [headers, onNotice]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (filterComicKey && !e.comicKey.includes(filterComicKey)) return false;
      if (filterValid === "valid" && !e.valid) return false;
      if (filterValid === "invalid" && e.valid) return false;
      return true;
    });
  }, [entries, filterComicKey, filterValid]);

  const selectedEntries = useMemo(() => {
    return filteredEntries.filter((e) => selected.has(`${e.comicKey}-${e.characterId}`));
  }, [filteredEntries, selected]);

  const groupedByComicKey = useMemo(() => {
    const groups = new Map<string, CacheEntryWithStats[]>();
    for (const entry of filteredEntries) {
      if (!groups.has(entry.comicKey)) {
        groups.set(entry.comicKey, []);
      }
      groups.get(entry.comicKey)!.push(entry);
    }
    return groups;
  }, [filteredEntries]);

  async function deleteSelected() {
    if (selectedEntries.length === 0) {
      onNotice({ kind: "error", text: "No entries selected" });
      return;
    }

    if (!confirm(`Delete ${selectedEntries.length} cache entries?`)) return;

    setDeleting(true);
    try {
      // 按 comicKey 分组删除
      const groups = new Map<string, string[]>();
      for (const entry of selectedEntries) {
        if (!groups.has(entry.comicKey)) {
          groups.set(entry.comicKey, []);
        }
        groups.get(entry.comicKey)!.push(entry.characterId);
      }

      let totalDeleted = 0;
      for (const [comicKey, characterIds] of groups) {
        const res = await fetch("/api/admin/cache-management/list-entries", {
          method: "DELETE",
          headers: { ...headers(), "Content-Type": "application/json" },
          body: JSON.stringify({ comicKey, characterIds }),
        });
        if (!res.ok) throw new Error("failed");
        const data = (await res.json()) as { deleted: number };
        totalDeleted += data.deleted;
      }

      onNotice({ kind: "ok", text: `Deleted ${totalDeleted} cache entries` });
      void loadEntries();
    } catch {
      onNotice({ kind: "error", text: "Failed to delete cache entries" });
    } finally {
      setDeleting(false);
    }
  }

  const inputCls =
    "rounded-lg border border-[color:var(--gc-border)] bg-[color:color-mix(in_srgb,var(--gc-bg-elevated)_92%,transparent)] px-3 py-2 text-sm text-[var(--gc-text)] outline-none focus:border-[color:color-mix(in_srgb,var(--gc-accent)_45%,var(--gc-border))]";

  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-base font-semibold text-[var(--gc-text)]">Cache entries</h4>
        <p className="mt-1 text-xs text-[var(--gc-muted)]">
          Browse all cached character sheets and metadata
        </p>
      </div>

      {/* 筛选 */}
      <div className="space-y-3 rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-surface)] p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-[var(--gc-text)]">Comic key</label>
            <input
              type="text"
              className={inputCls}
              placeholder="Filter by comic key"
              value={filterComicKey}
              onChange={(e) => setFilterComicKey(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--gc-text)]">Validity</label>
            <select className={inputCls} value={filterValid} onChange={(e) => setFilterValid(e.target.value as typeof filterValid)}>
              <option value="all">All</option>
              <option value="valid">Valid only</option>
              <option value="invalid">Invalid only</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--gc-text)]">Selection</label>
            <div className="text-sm text-[var(--gc-muted)]">
              {selected.size} / {entries.length} selected
            </div>
          </div>
        </div>
      </div>

      {/* 操作栏 */}
      {selected.size > 0 && (
        <div className="flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
          <button
            type="button"
            disabled={deleting}
            onClick={() => void deleteSelected()}
            className="rounded-lg border border-red-500/50 bg-red-500/20 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/30 disabled:opacity-50"
          >
            {deleting ? "Deleting..." : `Delete selected (${selected.size})`}
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="rounded-lg border border-[color:var(--gc-border)] px-3 py-2 text-sm text-[var(--gc-text-soft)] hover:text-[var(--gc-text)]"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* 列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border border-[color:var(--gc-border)] border-t-[color:var(--gc-accent)]" />
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[color:var(--gc-border)] p-6 text-center text-sm text-[var(--gc-muted)]">
          No cache entries found
        </div>
      ) : (
        <div className="space-y-3">
          {Array.from(groupedByComicKey.entries()).map(([comicKey, comicEntries]) => (
            <div key={comicKey} className="rounded-lg border border-[color:var(--gc-border)] overflow-hidden">
              <div className="bg-[var(--gc-surface)] px-4 py-3 font-mono text-sm font-medium text-[var(--gc-text)]">
                {comicKey} ({comicEntries.length})
              </div>
              <table className="w-full text-left text-sm">
                <thead className="border-t border-[color:var(--gc-border)] bg-[var(--gc-surface)]">
                  <tr>
                    <th className="px-4 py-2 text-xs font-medium text-[var(--gc-text-faint)]">
                      <input
                        type="checkbox"
                        checked={comicEntries.every((e) => selected.has(`${e.comicKey}-${e.characterId}`))}
                        onChange={(e) => {
                          const newSelected = new Set(selected);
                          for (const entry of comicEntries) {
                            const key = `${entry.comicKey}-${entry.characterId}`;
                            if (e.target.checked) {
                              newSelected.add(key);
                            } else {
                              newSelected.delete(key);
                            }
                          }
                          setSelected(newSelected);
                        }}
                      />
                    </th>
                    <th className="px-4 py-2 text-xs font-medium text-[var(--gc-text-faint)]">Character</th>
                    <th className="px-4 py-2 text-xs font-medium text-[var(--gc-text-faint)]">Generated</th>
                    <th className="px-4 py-2 text-xs font-medium text-[var(--gc-text-faint)]">Status</th>
                    <th className="px-4 py-2 text-xs font-medium text-[var(--gc-text-faint)]">Size</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--gc-border)]">
                  {comicEntries.map((entry) => {
                    const key = `${entry.comicKey}-${entry.characterId}`;
                    return (
                      <tr key={key} className="hover:bg-white/2">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selected.has(key)}
                            onChange={(e) => {
                              const newSelected = new Set(selected);
                              if (e.target.checked) {
                                newSelected.add(key);
                              } else {
                                newSelected.delete(key);
                              }
                              setSelected(newSelected);
                            }}
                          />
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-[var(--gc-muted)]">
                          {entry.characterId}
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--gc-text-faint)]">
                          {formatDate(entry.generatedAt)}
                        </td>
                        <td className="px-4 py-3">
                          <ValidBadge valid={entry.valid} />
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--gc-text-faint)]">
                          {entry.fileSizeBytes ? formatBytes(entry.fileSizeBytes) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
