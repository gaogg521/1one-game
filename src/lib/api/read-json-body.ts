import { generationErrorCodes } from "@/lib/api/json-error-response";
import type { ApiGenerateErrorPayload } from "@/lib/api/json-error-response";

function maxBodyBytes(): number {
  const n = Number(process.env.GENERATE_BODY_MAX_BYTES ?? "98304");
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 98304;
}

function previewClHeader(cl: string | null, maxBytes: number): ApiGenerateErrorPayload | null {
  if (!cl?.trim()) return null;
  const parsed = /^(\d+)$/.exec(cl.trim())?.[1];
  if (!parsed) return null;
  const size = Number(parsed);
  if (size <= maxBytes) return null;
  return {
    error: "请求体过大",
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
export async function readLimitedJson(req: Request, requestId: string): Promise<ReadJsonLimitedResult> {
  const max = maxBodyBytes();
  const clErr =
    previewClHeader(req.headers.get("content-length"), max) ?? previewClHeader(req.headers.get("Content-Length"), max);
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
        error: "无法读取请求体",
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
        error: "请求体过大",
        code: generationErrorCodes().BODY_TOO_LARGE,
        requestId,
      },
    };
  }

  if (byteLength === 0) {
    return { ok: false, requestId, status: 400, payload: { error: "无效的 JSON", code: generationErrorCodes().BAD_JSON, requestId } };
  }

  const text = new TextDecoder("utf-8", { fatal: false }).decode(ab);
  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, requestId, status: 400, payload: { error: "无效的 JSON", code: generationErrorCodes().BAD_JSON, requestId } };
  }

  return { ok: true, requestId, byteLength, body };
}
