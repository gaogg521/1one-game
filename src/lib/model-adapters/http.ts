import { isUnroutedGatewayResponse } from "@/lib/model-adapters/types";

/** Normalised low-level POST used by every adapter, so failure detection is uniform. */
export type GatewayResponse =
  | { ok: true; status: number; contentType: string; bytes: Buffer; json: unknown | null }
  | { ok: false; status: number; error: string };

export function apiUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function postJson(
  baseUrl: string,
  apiKey: string,
  path: string,
  body: unknown,
  timeoutMs: number,
): Promise<GatewayResponse> {
  let res: Response;
  try {
    res = await fetch(apiUrl(baseUrl, path), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    return { ok: false, status: 0, error: `request failed: ${(e as Error).message}` };
  }

  const contentType = res.headers.get("content-type") ?? "";
  let bytes: Buffer;
  try {
    bytes = Buffer.from(await res.arrayBuffer());
  } catch (e) {
    return { ok: false, status: res.status, error: `body read failed: ${(e as Error).message}` };
  }

  // The gateway answers unrouted paths with an empty 200 instead of a 404, so
  // this has to be rejected explicitly or a missing endpoint reads as success.
  if (isUnroutedGatewayResponse(res.status, bytes.length, res.headers.get("content-type"))) {
    return { ok: false, status: res.status, error: `endpoint ${path} is not routed on this gateway (empty 200)` };
  }

  if (!res.ok) {
    return { ok: false, status: res.status, error: `HTTP ${res.status}: ${bytes.toString("utf8").slice(0, 300).replace(/\s+/g, " ")}` };
  }

  let json: unknown | null = null;
  if (/json/i.test(contentType) || bytes.length < 2_000_000) {
    try { json = JSON.parse(bytes.toString("utf8")); } catch { json = null; }
  }
  return { ok: true, status: res.status, contentType, bytes, json };
}
