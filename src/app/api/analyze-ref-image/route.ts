import { NextResponse } from "next/server";
import { readLimitedJson } from "@/lib/api/read-json-body";
import { newGenerateRequestId } from "@/lib/api/request-id";
import { readIngestCacheBuffer } from "@/lib/reference-ingest-server-cache";
import { analyzeRefImageForGameBrief } from "@/lib/vision-reference";

export const runtime = "nodejs";

/**
 * POST /api/analyze-ref-image
 * Body: { refId: string; mimeType?: string }
 * Response: RefImageGameBrief | { error: string }
 *
 * 从 ingest 缓存读取图片 buffer，调用 Vision LLM 提取结构化游戏创意建议。
 * 客户端在 ingest 完成后调用，将 suggestedTemplateId 写入 templateHint。
 */
export async function POST(req: Request): Promise<NextResponse> {
  const requestId = newGenerateRequestId();
  const json = await readLimitedJson(req, requestId);
  if (!json.ok) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const body = json.body as { refId?: unknown; mimeType?: unknown };
  const refId = typeof body.refId === "string" ? body.refId.trim() : "";
  if (!refId) {
    return NextResponse.json({ error: "missing_refId" }, { status: 400 });
  }

  const cached = await readIngestCacheBuffer(refId);
  if (!cached) {
    return NextResponse.json({ error: "ref_not_found" }, { status: 404 });
  }

  const b64 = cached.buffer.toString("base64");
  const result = await analyzeRefImageForGameBrief({
    mimeType: cached.mime,
    base64: b64,
  });

  if (!result) {
    return NextResponse.json({ error: "analysis_failed" }, { status: 502 });
  }

  return NextResponse.json(result);
}
