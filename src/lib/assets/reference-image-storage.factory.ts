import type { IReferenceImageStorage, ReferenceImageStorageMode } from "./reference-image-storage.types";
import { PRODUCT } from "@/lib/product-config";
import { CloudReferenceImageStorage } from "./reference-image-storage.cloud";
import { SessionReferenceImageStorage } from "./reference-image-storage.session";

function normalizeMode(raw: string): ReferenceImageStorageMode {
  const v = raw.trim().toLowerCase();
  return v === "cloud" ? "cloud" : "session";
}

/** 服务端摄取 / 生成管线取存储适配器（单例，按产品配置切换） */
let cached: IReferenceImageStorage | null = null;
let cachedKey = "";

export function getReferenceImageStorage(): IReferenceImageStorage {
  const key = PRODUCT.referenceAssets.storageMode;
  if (cached && cachedKey === key) return cached;
  cachedKey = key;
  const mode = normalizeMode(key);
  cached = mode === "cloud" ? new CloudReferenceImageStorage() : new SessionReferenceImageStorage();
  return cached;
}

/** 测试或热重载时重置单例 */
export function resetReferenceImageStorageForTests(): void {
  cached = null;
  cachedKey = "";
}
