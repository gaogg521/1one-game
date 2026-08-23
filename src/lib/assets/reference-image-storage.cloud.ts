import { randomUUID } from "node:crypto";
import type { IReferenceImageStorage, RegisterIngestedImageInput, ReferenceImageHandle } from "./reference-image-storage.types";

const UPLOAD_TIMEOUT_MS = 20_000;

function sessionHandle(input: RegisterIngestedImageInput, refId: string, notice?: string): ReferenceImageHandle {
  return {
    refId,
    ordinal: input.ordinal,
    mimeType: input.mimeType,
    originalName: input.originalName,
    purpose: input.purpose?.trim() || undefined,
    tier: "session",
    persisted: false,
    notice,
  };
}

/** `Bearer token` becomes Authorization; `X-Api-Key: token` preserves its explicit name. */
function uploadAuthHeader(raw: string | undefined): Headers {
  const headers = new Headers();
  const value = raw?.trim();
  if (!value) return headers;
  const separator = value.indexOf(":");
  if (separator > 0) {
    const name = value.slice(0, separator).trim();
    const headerValue = value.slice(separator + 1).trim();
    if (name && headerValue) headers.set(name, headerValue);
  } else {
    headers.set("authorization", value);
  }
  return headers;
}

function cloudUrlFromResponse(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const candidate = (payload as { publicUrl?: unknown; url?: unknown }).publicUrl ?? (payload as { url?: unknown }).url;
  if (typeof candidate !== "string") return null;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Generic object-storage upload adapter. The configured endpoint receives
 * multipart fields `file`, `refId`, `ordinal`, `mimeType`, `originalName`, and
 * optional `purpose`, then must return JSON `{ publicUrl: "https://..." }`.
 *
 * A storage outage deliberately falls back to a non-persisted session handle:
 * it never claims persistence and it never breaks text/document ingestion.
 */
export class CloudReferenceImageStorage implements IReferenceImageStorage {
  readonly mode = "cloud" as const;

  async registerIngestedImage(input: RegisterIngestedImageInput): Promise<ReferenceImageHandle> {
    const uploadUrl = process.env.REFERENCE_ASSET_CLOUD_UPLOAD_URL?.trim();
    const refId = randomUUID();

    if (!uploadUrl) return sessionHandle(input, refId);

    try {
      const form = new FormData();
      form.set("file", new Blob([Uint8Array.from(input.buffer)], { type: input.mimeType }), `reference-${refId}`);
      form.set("refId", refId);
      form.set("ordinal", String(input.ordinal));
      form.set("mimeType", input.mimeType);
      form.set("originalName", input.originalName);
      if (input.purpose?.trim()) form.set("purpose", input.purpose.trim());

      const headers = uploadAuthHeader(process.env.REFERENCE_ASSET_CLOUD_AUTH_HEADER);
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers,
        body: form,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
      });
      if (!response.ok) return sessionHandle(input, refId, "cloud_upload_failed");
      const publicUrl = cloudUrlFromResponse(await response.json());
      if (!publicUrl) return sessionHandle(input, refId, "cloud_upload_invalid_response");
      return {
        refId,
        ordinal: input.ordinal,
        mimeType: input.mimeType,
        originalName: input.originalName,
        purpose: input.purpose?.trim() || undefined,
        tier: "persistent",
        persisted: true,
        publicUrl,
      };
    } catch {
      return sessionHandle(input, refId, "cloud_upload_failed");
    }
  }
}
