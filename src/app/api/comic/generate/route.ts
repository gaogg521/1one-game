import { generationErrorCodes } from "@/lib/api/json-error-response";
import { localizedApiErrorPayload } from "@/lib/api/localized-error";
import { generateRateLimits } from "@/lib/api/generate-limits";
import { newGenerateRequestId, ridHeaders } from "@/lib/api/request-id";
import { readLimitedJson } from "@/lib/api/read-json-body";
import { runComicGeneration, ComicGenerateError, resolveComicRunErrorMessage } from "@/lib/comic-generate-run";
import { resolveRequestLocaleSync } from "@/lib/i18n/request-locale";
import { getOwnerKey } from "@/lib/owner";
import { gateGenerationQuota } from "@/lib/commerce/generation-gate";
import { rateLimit } from "@/lib/rate-limit";
import { getThrottleKey } from "@/lib/request-key";
import { NextResponse } from "next/server";

export const maxDuration = 3600;

export async function POST(req: Request) {
  const codes = generationErrorCodes();
  const requestId = newGenerateRequestId();
  const quotaBlock = await gateGenerationQuota("comic");
  if (quotaBlock) {
    const body = await quotaBlock.json();
    return NextResponse.json(body, { status: 402, headers: ridHeaders(requestId) });
  }
  const rl = generateRateLimits();
  const ownerKey = (await getOwnerKey()) ?? "anon";
  const throttleKey = await getThrottleKey("comic_gen", ownerKey);
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
    return NextResponse.json(json.payload, { status: json.status, headers: ridHeaders(requestId) });
  }

  const body = json.body as {
    novelId?: string;
    content?: string;
    title?: string;
    pageCount?: number;
    lengthTier?: string;
    stylePreset?: string;
    readMode?: string;
    chapterScope?: { fromChapter: number; toChapter: number; label?: string };
    characterRoster?: unknown;
    resumeComicId?: string;
  };

  try {
    const result = await runComicGeneration({
      ownerKey,
      novelId: body.novelId,
      content: body.content,
      title: body.title,
      pageCount: body.pageCount,
      lengthTier: body.lengthTier,
      stylePreset: body.stylePreset,
      readMode: body.readMode === "full" ? "full" : "segment",
      chapterScope: body.chapterScope
        ? {
            fromChapter: body.chapterScope.fromChapter,
            toChapter: body.chapterScope.toChapter,
            label: body.chapterScope.label ?? "",
          }
        : null,
      characterRoster: body.characterRoster as import("@/lib/comic-character-roster").ComicCharacterRoster | null,
      resumeComicId: body.resumeComicId?.trim() || undefined,
    });

    return NextResponse.json(
      {
        ok: true,
        comic: { id: result.comicId },
        pageCount: result.pageCount,
        panelCount: result.panelCount,
        panelsRendered: result.panelsRendered,
        pipeline: result.pipeline,
        storyboardSource: result.storyboardSource,
        provider: result.provider,
        model: result.model,
        imageSource: result.imageSource,
        consistencyWarnings: result.consistencyWarnings,
        imagesWarning: result.imagesWarning,
      },
      { headers: ridHeaders(requestId) },
    );
  } catch (err) {
    if (err instanceof ComicGenerateError) {
      return NextResponse.json(
        localizedApiErrorPayload(req, err.errorKey, { code: codes.LLM_FAILED, requestId }),
        { status: err.status, headers: ridHeaders(requestId) },
      );
    }
    return NextResponse.json(
      {
        error: resolveComicRunErrorMessage(resolveRequestLocaleSync(req), err),
        code: codes.LLM_FAILED,
        requestId,
      },
      { status: 502, headers: ridHeaders(requestId) },
    );
  }
}
