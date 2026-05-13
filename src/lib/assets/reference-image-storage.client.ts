import type { ReferenceImageHandle } from "./reference-image-storage.types";

const KEY = "gc:referenceImageHandles:v1";

/** 将最近一次摄取返回的句柄写入 sessionStorage（标签页关闭即失效） */
export function saveReferenceHandlesToSession(handles: ReferenceImageHandle[]): void {
  if (typeof window === "undefined" || !handles.length) return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(handles));
  } catch {
    /* 配额或隐私模式：忽略 */
  }
}

export function readReferenceHandlesFromSession(): ReferenceImageHandle[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as ReferenceImageHandle[];
  } catch {
    return [];
  }
}

export function clearReferenceHandlesSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
