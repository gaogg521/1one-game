import type { RuntimeReferencePayload } from "@/game/engine/runtime-reference-payload";
import type { ReferenceImageHandle } from "@/lib/assets/reference-image-storage.types";

function fnv1a(str: string): string {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0).toString(36);
}

/** 参考图队列摘要：用于 Godot 导出缓存键，避免「无图构建」被误复用（浏览器/Node 通用）。 */
export function referencePayloadsDigest(payloads: RuntimeReferencePayload[] | undefined): string {
  if (!payloads?.length) return "0";
  const parts = payloads
    .slice(0, 8)
    .map((p) => `${p.ordinal}:${p.purpose}:${p.dataUrl.length}`)
    .sort()
    .join("|");
  return fnv1a(parts).slice(0, 12);
}

export function referenceHandlesDigest(handles: ReferenceImageHandle[] | undefined): string {
  if (!handles?.length) return "0";
  const parts = handles
    .slice(0, 8)
    .map((h) => `${h.ordinal}:${h.refId}`)
    .sort()
    .join("|");
  return fnv1a(parts).slice(0, 12);
}

export function combinedReferenceDigest(
  payloads: RuntimeReferencePayload[] | undefined,
  handles: ReferenceImageHandle[] | undefined,
): string {
  const p = referencePayloadsDigest(payloads);
  const h = referenceHandlesDigest(handles);
  if (p === "0" && h === "0") return "0";
  return `${p}_${h}`;
}
