import { generationErrorCodes } from "@/lib/api/json-error-response";
import type { ApiGenerateErrorPayload } from "@/lib/api/json-error-response";
import { apiErrorMessage } from "@/lib/i18n/progress-message";
import { resolveRequestLocaleSync } from "@/lib/i18n/request-locale";
import { PRODUCT } from "@/lib/product-config";

function maxBodyBytes(): number {
  return PRODUCT.api.bodyMaxBytes;
}

function previewClHeader(
  req: Request,
  cl: string | null,
  maxBytes: number,
): ApiGenerateErrorPayload | null {
  if (!cl?.trim()) return null;
  const parsed = /^(\d+)$/.exec(cl.trim())?.[1];
  if (!parsed) return null;
  const size = Number(parsed);
  if (size <= maxBytes) return null;
  return {
    error: apiErrorMessage(resolveRequestLocaleSync(req), "bodyTooLarge"),
    code: generationErrorCodes().BODY_TOO_LARGE,
  };
}

export type ReadJsonLimitedResult<T = unknown> =
  | {
      ok: true;
      requestId: string;
      /** 解码后的字节长度（近似于传输大小） */
      byteLength: number;
      body: T;
    }
  | { ok: false; requestId: string; status: number; payload: ApiGenerateErrorPayload };

/**
 * 受限长度 JSON 读取（先于 JSON.parse，避免超长 prompt 与其它字段撑爆）。
 */
export async function readLimitedJson(
  req: Request,
  requestId: string,
  opts?: { maxBytes?: number },
): Promise<ReadJsonLimitedResult> {
  const locale = resolveRequestLocaleSync(req);
  const max = opts?.maxBytes ?? maxBodyBytes();
  const clErr =
    previewClHeader(req, req.headers.get("content-length"), max) ??
    previewClHeader(req, req.headers.get("Content-Length"), max);
  if (clErr) {
    return {
      ok: false,
      requestId,
      status: 413,
      payload: { ...clErr, requestId },
    };
  }

  let ab: ArrayBuffer;
  try {
    ab = await req.arrayBuffer();
  } catch {
    return {
      ok: false,
      requestId,
      status: 400,
      payload: {
        error: apiErrorMessage(locale, "bodyUnreadable"),
        code: generationErrorCodes().BAD_REQUEST,
        requestId,
      },
    };
  }
  const byteLength = ab.byteLength;
  if (byteLength > max) {
    return {
      ok: false,
      requestId,
      status: 413,
      payload: {
        error: apiErrorMessage(locale, "bodyTooLarge"),
        code: generationErrorCodes().BODY_TOO_LARGE,
        requestId,
      },
    };
  }

  if (byteLength === 0) {
    return {
      ok: false,
      requestId,
      status: 400,
      payload: {
        error: apiErrorMessage(locale, "badJson"),
        code: generationErrorCodes().BAD_JSON,
        requestId,
      },
    };
  }

  const text = new TextDecoder("utf-8", { fatal: false }).decode(ab);
  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    return {
      ok: false,
      requestId,
      status: 400,
      payload: {
        error: apiErrorMessage(locale, "badJson"),
        code: generationErrorCodes().BAD_JSON,
        requestId,
      },
    };
  }

  return { ok: true, requestId, byteLength, body };
}
