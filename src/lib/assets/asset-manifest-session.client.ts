"use client";

import type { AssetManifestV1 } from "@/lib/orchestration/asset-manifest";
import type { AssetManifestV2 } from "@/lib/assets/asset-runtime-resolver";

const SESSION_KEY = "gc:assetManifest:v1";

export function writeAssetManifestToSession(manifest: AssetManifestV1 | AssetManifestV2): void {
  try {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(manifest));
  } catch {
    /* 配额或其它：静默 */
  }
}

export function readAssetManifestFromSession(): AssetManifestV2 | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw?.trim()) return null;
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") return null;
    const m = o as Partial<AssetManifestV2>;
    if (m.schemaVersion !== 1 || !Array.isArray(m.items)) return null;
    return m as AssetManifestV2;
  } catch {
    return null;
  }
}

export function clearAssetManifestSession(): void {
  try {
    if (typeof window === "undefined") return;
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** 供生成 API body：仅元数据，不含像素 */
export type AssetManifestApiSummary = {
  schemaVersion: number;
  revision: number;
  itemCount: number;
};

/** 会话有效清单时才返回摘要，便于打进编排 trace */
export function summarizeAssetManifestForGenerateApi(): AssetManifestApiSummary | undefined {
  const m = readAssetManifestFromSession();
  if (!m?.items.length) return undefined;
  return {
    schemaVersion: m.schemaVersion,
    revision: m.revision,
    itemCount: m.items.length,
  };
}
