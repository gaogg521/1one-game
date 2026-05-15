/**
 * Phase 2：资产清单契约（不写死 data URL；像素仍走 session payloads，本条做索引与可追溯）
 */
export const ASSET_MANIFEST_SCHEMA_VERSION = 1 as const;

export type AssetManifestChannel = "reference_ingest" | "comfy_placeholder";

export type AssetManifestItem = {
  id: string;
  ordinal: number;
  purpose: string;
  channel: AssetManifestChannel;
  /** 来源提示：用户上传 / 剪贴板 / （未来）Comfy */
  hint?: string;
};

export type AssetManifestV1 = {
  schemaVersion: typeof ASSET_MANIFEST_SCHEMA_VERSION;
  revision: number;
  createdAt: number;
  /** 与 RuntimeReferencePayload 同序；不写像素 */
  items: AssetManifestItem[];
};

export type RuntimePayloadLike = { ordinal: number; purpose: string };

export function buildAssetManifestFromReferencePayloads(
  payloads: RuntimePayloadLike[],
  opts?: { channel?: AssetManifestChannel; hint?: string },
): AssetManifestV1 {
  const channel = opts?.channel ?? "reference_ingest";
  const hint = opts?.hint;
  const items = payloads.map((p) => ({
    id: `ref_ord_${p.ordinal}`,
    ordinal: p.ordinal,
    purpose: p.purpose,
    channel,
    ...(hint ? { hint } : {}),
  }));
  return {
    schemaVersion: ASSET_MANIFEST_SCHEMA_VERSION,
    revision: 1,
    createdAt: Date.now(),
    items,
  };
}
