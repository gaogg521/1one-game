"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import type { CacheEntryWithStats } from "@/app/api/admin/cache-management/list-entries/route";

type Props = {
  headers: () => HeadersInit;
  onNotice: (notice: { kind: "ok" | "error"; text: string }) => void;
  entries: CacheEntryWithStats[];
};

type CdnConfig = {
  provider: "aws-s3" | "cloudflare" | "custom";
  endpoint: string;
  accessKey?: string;
  secretKey?: string;
  bucket?: string;
  ttlSeconds: number;
};

type UploadResult = {
  characterId: string;
  success: boolean;
  cdnUrl?: string;
  error?: string;
};

export function CdnUploadPanel({ headers, onNotice, entries }: Props) {
  const t = useTranslations("adminPage.cacheManagement");
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [config, setConfig] = useState<CdnConfig>({
    provider: "custom",
    endpoint: "",
    ttlSeconds: 2592000,
  });
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [selectedComicKey, setSelectedComicKey] = useState<string>("");

  const uniqueComicKeys = Array.from(new Set(entries.map((e) => e.comicKey)));
  const selectedEntries = selectedComicKey
    ? entries.filter((e) => e.comicKey === selectedComicKey)
    : [];

  const loadConfig = useCallback(async () => {
    setLoadingConfig(true);
    try {
      const res = await fetch("/api/admin/cache-management/cdn-config", { headers: headers() });
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as CdnConfig;
      setConfig(data);
    } catch {
      onNotice({ kind: "error", text: "Failed to load CDN config" });
    } finally {
      setLoadingConfig(false);
    }
  }, [headers, onNotice]);

  const saveConfig = useCallback(
    async (newConfig: CdnConfig) => {
      try {
        const res = await fetch("/api/admin/cache-management/cdn-config", {
          method: "PATCH",
          headers: { ...headers(), "Content-Type": "application/json" },
          body: JSON.stringify(newConfig),
        });
        if (!res.ok) throw new Error("failed");
        setConfig(newConfig);
        onNotice({ kind: "ok", text: "CDN config saved" });
      } catch {
        onNotice({ kind: "error", text: "Failed to save CDN config" });
      }
    },
    [headers, onNotice]
  );

  const verifyCdnEndpoint = async () => {
    setVerifying(true);
    try {
      const res = await fetch("/api/admin/cache-management/cdn-config/verify", {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: config.endpoint }),
      });
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as { valid: boolean; message: string };
      onNotice({
        kind: data.valid ? "ok" : "error",
        text: data.message,
      });
    } catch {
      onNotice({ kind: "error", text: "Failed to verify CDN endpoint" });
    } finally {
      setVerifying(false);
    }
  };

  const uploadSelected = async () => {
    if (!selectedComicKey || selectedEntries.length === 0) {
      onNotice({ kind: "error", text: "No entries selected" });
      return;
    }

    setUploading(true);
    try {
      const res = await fetch("/api/admin/cache-management/cdn-upload", {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({
          comicKey: selectedComicKey,
          characterIds: selectedEntries.map((e) => e.characterId),
        }),
      });
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as {
        uploaded: number;
        failed: number;
        results: UploadResult[];
      };
      setUploadResults(data.results);
      onNotice({
        kind: data.failed === 0 ? "ok" : "error",
        text: `Uploaded ${data.uploaded}, failed ${data.failed}`,
      });
    } catch {
      onNotice({ kind: "error", text: "Failed to upload to CDN" });
    } finally {
      setUploading(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-[color:var(--gc-border)] bg-[color:color-mix(in_srgb,var(--gc-bg-elevated)_92%,transparent)] px-3 py-2 text-sm text-[var(--gc-text)] outline-none focus:border-[color:color-mix(in_srgb,var(--gc-accent)_45%,var(--gc-border))]";

  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-base font-semibold text-[var(--gc-text)]">CDN Upload</h4>
        <p className="mt-1 text-xs text-[var(--gc-muted)]">
          Upload character sheets to CDN for better distribution
        </p>
      </div>

      {/* CDN Configuration */}
      <div className="space-y-4 rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-surface)] p-4">
        <h5 className="text-sm font-medium text-[var(--gc-text)]">CDN Configuration</h5>

        {loadingConfig ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border border-[color:var(--gc-border)] border-t-[color:var(--gc-accent)]" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-[var(--gc-text)]">Provider</label>
                <select
                  className={inputCls}
                  value={config.provider}
                  onChange={(e) =>
                    setConfig({ ...config, provider: e.target.value as typeof config.provider })
                  }
                >
                  <option value="custom">Custom</option>
                  <option value="aws-s3">AWS S3</option>
                  <option value="cloudflare">Cloudflare</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--gc-text)]">Endpoint</label>
                <input
                  type="url"
                  className={inputCls}
                  value={config.endpoint}
                  onChange={(e) => setConfig({ ...config, endpoint: e.target.value })}
                  placeholder="https://cdn.example.com"
                />
              </div>
            </div>

            {config.provider !== "custom" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-[var(--gc-text)]">
                    Access Key
                  </label>
                  <input
                    type="password"
                    className={inputCls}
                    value={config.accessKey || ""}
                    onChange={(e) => setConfig({ ...config, accessKey: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--gc-text)]">
                    Bucket / Account ID
                  </label>
                  <input
                    type="text"
                    className={inputCls}
                    value={config.bucket || ""}
                    onChange={(e) => setConfig({ ...config, bucket: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                disabled={verifying}
                onClick={() => void verifyCdnEndpoint()}
                className="rounded-lg border border-[color:var(--gc-border)] px-3 py-2 text-sm text-[var(--gc-text)] hover:bg-white/5 disabled:opacity-50"
              >
                {verifying ? "Verifying..." : "Verify Endpoint"}
              </button>
              <button
                type="button"
                onClick={() => void saveConfig(config)}
                className="rounded-lg bg-[color:color-mix(in_srgb,var(--gc-accent)_28%,transparent)] px-3 py-2 text-sm font-medium text-[var(--gc-text)] hover:brightness-110"
              >
                Save Config
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Upload Selection */}
      <div className="space-y-4 rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-surface)] p-4">
        <h5 className="text-sm font-medium text-[var(--gc-text)]">Select Comic to Upload</h5>

        <div>
          <label className="block text-xs font-medium text-[var(--gc-text)]">Comic Key</label>
          <select
            className={inputCls}
            value={selectedComicKey}
            onChange={(e) => setSelectedComicKey(e.target.value)}
          >
            <option value="">-- Select a comic --</option>
            {uniqueComicKeys.map((key) => (
              <option key={key} value={key}>
                {key} ({entries.filter((e) => e.comicKey === key).length} entries)
              </option>
            ))}
          </select>
        </div>

        {selectedComicKey && selectedEntries.length > 0 && (
          <div>
            <p className="text-xs text-[var(--gc-muted)]">
              {selectedEntries.length} character sheet(s) to upload
            </p>
            <button
              type="button"
              disabled={uploading}
              onClick={() => void uploadSelected()}
              className="mt-2 rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50"
            >
              {uploading ? "Uploading..." : `Upload ${selectedEntries.length} sheet(s)`}
            </button>
          </div>
        )}
      </div>

      {/* Upload Results */}
      {uploadResults.length > 0 && (
        <div className="space-y-3 rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-surface)] p-4">
          <h5 className="text-sm font-medium text-[var(--gc-text)]">Upload Results</h5>
          <div className="space-y-2">
            {uploadResults.map((result) => (
              <div key={result.characterId} className="flex items-start gap-2 text-xs">
                {result.success ? (
                  <>
                    <span className="text-emerald-400">✓</span>
                    <div>
                      <p className="text-[var(--gc-text)]">{result.characterId}</p>
                      <p className="break-all text-[var(--gc-text-faint)]">{result.cdnUrl}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-red-400">✗</span>
                    <div>
                      <p className="text-[var(--gc-text)]">{result.characterId}</p>
                      <p className="text-red-400">{result.error}</p>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
