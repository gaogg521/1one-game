import { NextResponse } from "next/server";
import { generationErrorCodes } from "@/lib/api/json-error-response";
import { localizedApiErrorPayload } from "@/lib/api/localized-error";
import { generateRateLimits } from "@/lib/api/generate-limits";
import { emitGenerateServeLog } from "@/lib/api/generate-serve-log";
import { newGenerateRequestId, ridHeaders } from "@/lib/api/request-id";
import { readLimitedJson } from "@/lib/api/read-json-body";
import { generateGameSpecWithMeta } from "@/lib/generate-spec";
import { createRunTraceRecorder } from "@/lib/orchestration/run-trace";
import { getOwnerKey } from "@/lib/owner";
import { parseGeneratePayload } from "@/lib/parse-generate-request";
import { gateGenerationQuota } from "@/lib/commerce/generation-gate";
import { rateLimit } from "@/lib/rate-limit";
import { getThrottleKey } from "@/lib/request-key";

export async function POST(req: Request) {
  const codes = generationErrorCodes();
  const requestId = newGenerateRequestId();
  const quotaBlock = await gateGenerationQuota("game");
  if (quotaBlock) {
    const body = await quotaBlock.json();
    return NextResponse.json(body, { status: 402, headers: ridHeaders(requestId) });
  }
  const rl = generateRateLimits();
  const ownerKey = (await getOwnerKey()) ?? "anon";
  const throttleKey = await getThrottleKey("gen", ownerKey);
  if (!rateLimit(throttleKey, rl.postMax, rl.windowMs)) {
    return NextResponse.json(
      localizedApiErrorPayload(req, "generateRateLimited", {
        code: codes.RATE_LIMITED,
        requestId,
      }),
      { status: 429, headers: ridHeaders(requestId) },
    );
  }

  const json = await readLimitedJson(req, requestId);
  if (!json.ok) {
    return NextResponse.json(json.payload, {
      status: json.status,
      headers: ridHeaders(requestId),
    });
  }

  const parsed = parseGeneratePayload(json.body);
  if (!parsed.ok) {
    return NextResponse.json(
      localizedApiErrorPayload(req, parsed.errorKey, { code: codes.BAD_REQUEST, requestId }),
      { status: parsed.status, headers: ridHeaders(requestId) },
    );
  }

  const orch = createRunTraceRecorder();
  const startedAt = Date.now();
  try {
    const { spec, source, web, debug } = await generateGameSpecWithMeta(parsed.prompt, {
      searchEnhance: parsed.searchEnhance,
      templateHint: parsed.templateHint,
      enhancePass: parsed.enhancePass,
      orchestration: orch,
      ...(parsed.assetManifestSummary ? { assetManifestSummary: parsed.assetManifestSummary } : {}),
    });
    emitGenerateServeLog({
      phase: "generate",
      requestId,
      durationMs: Date.now() - startedAt,
      byteLength: json.byteLength,
      promptChars: parsed.prompt.length,
      source,
      llmProvider: typeof debug.provider === "string" ? debug.provider : String(debug.provider ?? ""),
    });
    return NextResponse.json(
      { spec, source, web, debug },
      { headers: ridHeaders(requestId) },
    );
  } catch {
    return NextResponse.json(
      localizedApiErrorPayload(req, "generateFailed", { code: codes.INTERNAL, requestId }),
      { status: 500, headers: ridHeaders(requestId) },
    );
  }
}
