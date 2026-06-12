export type QuotaExceededPayload = {
  error?: string;
  code?: string;
  needed?: number;
  available?: number;
};

export function isQuotaExceededPayload(data: unknown): data is QuotaExceededPayload {
  if (!data || typeof data !== "object") return false;
  const d = data as QuotaExceededPayload;
  return d.code === "QUOTA_EXCEEDED";
}

export function parseQuotaExceeded(
  data: unknown,
  status?: number,
): QuotaExceededPayload | null {
  if (status === 402 && data && typeof data === "object") {
    const d = data as QuotaExceededPayload;
    return {
      error: d.error,
      code: "QUOTA_EXCEEDED",
      needed: d.needed,
      available: d.available,
    };
  }
  if (isQuotaExceededPayload(data)) return data;
  return null;
}
