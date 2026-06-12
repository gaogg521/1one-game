import { NextResponse } from "next/server";
import { generationErrorCodes } from "@/lib/api/json-error-response";
import { localizedApiErrorPayload } from "@/lib/api/localized-error";
import { emitGenerateServeLog } from "@/lib/api/generate-serve-log";
import { generateRateLimits } from "@/lib/api/generate-limits";
import { newGenerateRequestId, ridHeaders } from "@/lib/api/request-id";
import { readLimitedJson } from "@/lib/api/read-json-body";
import { generateGameSpecVariantBatch } from "@/lib/generate-spec";
import { getOwnerKey } from "@/lib/owner";
import { parseGeneratePayload } from "@/lib/parse-generate-request";
import { gateGenerationQuota } from "@/lib/commerce/generation-gate";
import { rateLimit } from "@/lib/rate-limit";
import { getThrottleKey } from "@/lib/request-key";

/** 并行生成 2～3 套不同风味的小游戏规格，供用户挑选预览。 */
export async function POST(req: Request) {
  const codes = generationErrorCodes();
  const requestId = newGenerateRequestId();
  const quotaBlock = await gateGenerationQuota("variants");
  if (quotaBlock) {
    const body = await quotaBlock.json();
    return NextResponse.json(body, { status: 402, headers: ridHeaders(requestId) });
  }
  const rl = generateRateLimits();
  const ownerKey = (await getOwnerKey()) ?? "anon";
  const throttleKey = await getThrottleKey("gen_variants", ownerKey);
  if (!rateLimit(throttleKey, rl.variantsMax, rl.windowMs)) {
    return NextResponse.json(
      localizedApiErrorPayload(req, "variantsRateLimited", {
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

  let count = 3;
  if (typeof json.body === "object" && json.body !== null && "count" in json.body) {
    const c = Number((json.body as { count?: unknown }).count);
    if (c === 2 || c === 3) count = c;
  }

  const startedAt = Date.now();
  try {
    const variants = await generateGameSpecVariantBatch(parsed.prompt, count === 2 ? 2 : 3, {
      searchEnhance: parsed.searchEnhance,
      templateHint: parsed.templateHint,
      enhancePass: parsed.enhancePass,
    });
    emitGenerateServeLog({
      phase: "variants",
      requestId,
      durationMs: Date.now() - startedAt,
      byteLength: json.byteLength,
      promptChars: parsed.prompt.length,
      manifestItemCount: parsed.assetManifestSummary?.itemCount,
    });
    const showDirector =
      process.env.NODE_ENV !== "production" && process.env.VARIANTS_DIRECTOR_SUMMARY === "1";
    const payload = showDirector
      ? {
          variants: variants.map((v) => ({
            ...v,
            directorSummary: {
              actCount: v.spec.director?.acts?.length ?? 0,
              eventTypes: (v.spec.director?.events ?? []).map((e) => e.type),
            },
          })),
        }
      : { variants };

    return NextResponse.json(payload, { headers: ridHeaders(requestId) });
  } catch {
    return NextResponse.json(
      localizedApiErrorPayload(req, "variantsFailed", {
        code: codes.INTERNAL,
        requestId,
      }),
      { status: 500, headers: ridHeaders(requestId) },
    );
  }
}
