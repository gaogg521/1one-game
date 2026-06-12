import { NextResponse } from "next/server";
import { defaultWorkVisibility } from "@/lib/auth/work-visibility";
import { generationErrorCodes } from "@/lib/api/json-error-response";
import { localizedApiErrorPayload } from "@/lib/api/localized-error";
import { generateRateLimits } from "@/lib/api/generate-limits";
import { emitGenerateServeLog } from "@/lib/api/generate-serve-log";
import { newGenerateRequestId, ridHeaders } from "@/lib/api/request-id";
import { readLimitedJson } from "@/lib/api/read-json-body";
import { getActiveProvider, getNovelStyleTextModelCascade, llmNovelText } from "@/lib/llm";
import { ensureNovelCoverAfterCreate } from "@/lib/cover-generation";
import { resolveNovelCoverGenre } from "@/lib/cover-genre";
import {
  getNovelSystemPrompt,
  buildNovelUserMessage,
  novelLlmMaxOutputTokens,
  novelLlmTemperature,
  novelLlmTimeoutMs,
  novelMinAcceptChars,
  resolveNovelLengthTier,
} from "@/lib/novel-generate-config";
import { extractNovelTitleFromContent, validateNovelTitleInput } from "@/lib/novel-display";
import { localizedJsonError } from "@/lib/api/localized-error";
import { generateNovelSynopsis } from "@/lib/novel-synopsis";
import {
  generateLongNovelBody,
  planLongNovelSegments,
  usesSegmentedLongGeneration,
} from "@/lib/novel-long-generate";
import { generatePlannedNovelBody } from "@/lib/novel-planned-generate";
import { fitNovelContentToMaxChars } from "@/lib/novel-chapters";
import { persistNovelGenerationMeta } from "@/lib/novel-pipeline-meta-db";
import { getChildrenAgeTier, parseChildrenTargetAge } from "@/lib/children-age-length";
import { finalizeChildrenNovelContent } from "@/lib/children-novel-postprocess";
import { persistChildrenNovelMeta } from "@/lib/children-novel-meta-db";
import {
  isChildrenNovelTier,
  novelMaxChars,
  type NovelLengthOptions,
} from "@/lib/novel-length";
import { persistNovelLengthTier } from "@/lib/novel-length-tier-db";
import { gateGenerationQuota } from "@/lib/commerce/generation-gate";
import { getOwnerKey } from "@/lib/owner";
import { rateLimit } from "@/lib/rate-limit";
import { getThrottleKey } from "@/lib/request-key";
import { prisma } from "@/lib/prisma";
import { resolveMediaCreativeBrief } from "@/lib/creative-brief/resolve-media-brief";
import { detectBriefInputLocale } from "@/lib/creative-brief/detect-input-locale";
import {
  parseChildrenCreativeBrief,
  parseNovelCreativeBrief,
  type ChildrenBriefUserRevision,
  type NovelBriefUserRevision,
} from "@/lib/literary-brief";
import { buildChildrenBriefSeed } from "@/lib/literary-brief/children-brief-types";
import { PRODUCT } from "@/lib/product-config";
import {
  saveNovelCreativeBriefJson,
  serializeChildrenCreativeBrief,
  serializeNovelCreativeBrief,
} from "@/lib/novel-creative-brief-db";
import { buildNovelBriefSeed, getNovelGenreTag, isChildrenGenreTag } from "@/lib/novel-genre-tags";
import { assessNovelCompleteness } from "@/lib/novel-completeness";
import { extendNovelToEnding } from "@/lib/novel-completion-pass";
import { resolveRequestLocaleSync } from "@/lib/i18n/request-locale";

export const maxDuration = 3600;

export async function POST(req: Request) {
  const codes = generationErrorCodes();
  const requestId = newGenerateRequestId();
  const uiLocale = resolveRequestLocaleSync(req);
  const rl = generateRateLimits();
  const ownerKey = (await getOwnerKey()) ?? "anon";
  const throttleKey = await getThrottleKey("novel_gen", ownerKey);
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

  const {
    prompt,
    title,
    lengthTier: lengthTierRaw,
    creativeBrief: creativeBriefRaw,
    briefRevision: briefRevisionRaw,
    novelGenreTag,
    genreId,
    childrenTargetAge: childrenTargetAgeRaw,
  } = json.body as {
    prompt?: string;
    title?: string;
    lengthTier?: string;
    creativeBrief?: unknown;
    briefRevision?: NovelBriefUserRevision | ChildrenBriefUserRevision;
    novelGenreTag?: string;
    genreId?: string;
    childrenTargetAge?: number;
  };
  const normalizedGenreTag = (novelGenreTag ?? genreId)?.trim() || undefined;
  const lengthTier = resolveNovelLengthTier({
    genreTagId: normalizedGenreTag,
    lengthTierPick: lengthTierRaw,
  });
  const quotaBlock = await gateGenerationQuota("novel", {
    long: usesSegmentedLongGeneration(lengthTier),
  });
  if (quotaBlock) {
    const body = await quotaBlock.json();
    return NextResponse.json(body, { status: 402, headers: ridHeaders(requestId) });
  }
  if (!prompt || typeof prompt !== "string" || prompt.trim().length < 2) {
    return NextResponse.json(
      localizedApiErrorPayload(req, "needNovelPrompt", {
        code: codes.BAD_REQUEST,
        requestId,
      }),
      { status: 400, headers: ridHeaders(requestId) },
    );
  }

  const promptTrim = prompt.trim();
  const lengthOpts: NovelLengthOptions | undefined = isChildrenNovelTier(lengthTier)
    ? {
        childrenTargetAge: parseChildrenTargetAge(childrenTargetAgeRaw),
        childrenUserPrompt: promptTrim,
      }
    : undefined;

  if (title?.trim()) {
    const tv = validateNovelTitleInput(title.trim());
    if (!tv.ok) {
      return localizedJsonError(req, tv.errorKey, 400, {
        code: codes.BAD_REQUEST,
        requestId,
        params: { max: 15 },
      });
    }
  }

  const startedAt = Date.now();
  const cascade = getNovelStyleTextModelCascade();

  try {
    let content = "";
    let pipelineMeta: Awaited<ReturnType<typeof generateLongNovelBody>>["pipelineMeta"] | null = null;
    let providerUsed = "";
    let modelUsed = "";

    const minChars = novelMinAcceptChars(lengthTier, lengthOpts);
    const timeoutMs = novelLlmTimeoutMs(lengthTier);
    const maxTokens = novelLlmMaxOutputTokens(lengthTier, lengthOpts);
    let pipelinePrompt = prompt.trim();
    let briefJsonToPersist: string | null = null;
    const genreTag = getNovelGenreTag(normalizedGenreTag);
    const titleTrim = title?.trim();
    if (PRODUCT.novel.creativeBriefExpand) {
      const preExpanded =
        parseChildrenCreativeBrief(creativeBriefRaw) ??
        parseNovelCreativeBrief(creativeBriefRaw) ??
        undefined;
      const isChild = isChildrenGenreTag(genreTag?.id) || isChildrenNovelTier(lengthTier);
      const inputLocale = detectBriefInputLocale(prompt.trim());
      const seed =
        titleTrim && genreTag && isChild
          ? buildChildrenBriefSeed(
              titleTrim,
              prompt.trim(),
              parseChildrenTargetAge(lengthOpts?.childrenTargetAge),
            )
          : titleTrim && genreTag
            ? buildNovelBriefSeed(titleTrim, genreTag, "", undefined, inputLocale)
            : prompt.trim();
      const briefResult = await resolveMediaCreativeBrief(seed, "novel", {
        preExpanded,
        userRevision: briefRevisionRaw ?? undefined,
        novelGenreId: genreTag?.id,
        title: titleTrim,
        childrenTargetAge: lengthOpts?.childrenTargetAge ?? undefined,
        inputLocale,
      });
      if (briefResult) {
        pipelinePrompt = briefResult.augmentedPrompt;
        briefJsonToPersist =
          briefResult.kind === "children"
            ? serializeChildrenCreativeBrief(briefResult.brief)
            : serializeNovelCreativeBrief(briefResult.brief);
      }
    }
    const userMsg = buildNovelUserMessage(
      prompt.trim(),
      title?.trim(),
      lengthTier,
      pipelinePrompt,
      lengthOpts,
    );
    const longPlan = usesSegmentedLongGeneration(lengthTier) ? planLongNovelSegments(lengthTier) : null;

    for (const model of cascade) {
      if (longPlan) {
        try {
          const longResult = await generateLongNovelBody({
            model,
            promptTrim: pipelinePrompt,
            titleTrim: title?.trim(),
            plan: longPlan,
            lengthTier,
            uiLocale,
          });
          if (longResult.content.length >= longPlan.minAcceptChars) {
            content = longResult.content;
            pipelineMeta = longResult.pipelineMeta;
            modelUsed = model;
            providerUsed = getActiveProvider();
            break;
          }
        } catch {
          continue;
        }
      } else if (lengthTier === "short" || lengthTier === "medium") {
        try {
          const planned = await generatePlannedNovelBody({
            model,
            promptTrim: pipelinePrompt,
            titleTrim: title?.trim(),
            lengthTier,
            lengthOpts,
          });
          if (planned.content.length >= minChars) {
            content = planned.content;
            pipelineMeta = planned.pipelineMeta;
            modelUsed = model;
            providerUsed = getActiveProvider();
            break;
          }
        } catch {
          continue;
        }
      } else {
        const result = await llmNovelText(
          {
            model,
            system: getNovelSystemPrompt(lengthTier, lengthOpts, prompt.trim()),
            user: userMsg,
            temperature: novelLlmTemperature(lengthTier),
            maxTokens,
            timeoutMs,
          },
          lengthTier,
        );
        if (result.ok && result.text.length >= minChars) {
          content = result.text;
          providerUsed = result.provider;
          modelUsed = result.model;
          break;
        }
      }
    }

    if (!content || content.length < minChars) {
      return NextResponse.json(
        localizedApiErrorPayload(req, "novelGenerateFailed", {
          code: codes.LLM_FAILED,
          requestId,
        }),
        { status: 502, headers: ridHeaders(requestId) },
      );
    }

    const maxCharsLimit = novelMaxChars(lengthTier, lengthOpts);
    let finalContent = fitNovelContentToMaxChars(content, maxCharsLimit);
    let finalTitle = extractNovelTitleFromContent(finalContent, title?.trim(), prompt.trim(), uiLocale);
    let parentReadingTip: string | undefined;
    let childrenSynopsisBody: string | undefined;
    let childrenInterpretation: string | undefined;

    if (isChildrenNovelTier(lengthTier) && lengthOpts?.childrenTargetAge !== undefined) {
      const finalized = finalizeChildrenNovelContent(finalContent, {
        targetAge: parseChildrenTargetAge(lengthOpts.childrenTargetAge),
        fallbackTitle: title?.trim(),
        userPrompt: promptTrim,
        uiLocale,
      });
      finalTitle = finalized.dbTitle;
      finalContent = finalized.publishedContent;
      parentReadingTip = finalized.parentReadingTip || undefined;
      childrenSynopsisBody = finalized.body;
      childrenInterpretation = finalized.interpretation || undefined;
    }

    let completeness = assessNovelCompleteness(
      finalContent,
      lengthTier,
      lengthOpts,
      promptTrim,
      pipelineMeta?.chapterPlan,
      uiLocale,
    );
    if (!completeness.ok && !isChildrenNovelTier(lengthTier)) {
      finalContent = await extendNovelToEnding({
        model: modelUsed || cascade[0]!,
        title: finalTitle,
        prompt: promptTrim,
        content: finalContent,
        lengthTier,
        lengthOpts,
      });
      completeness = assessNovelCompleteness(
        finalContent,
        lengthTier,
        lengthOpts,
        promptTrim,
        pipelineMeta?.chapterPlan,
        uiLocale,
      );
    }
    if (!completeness.ok) {
      return NextResponse.json(
        localizedApiErrorPayload(req, "novelIncomplete", {
          code: codes.LLM_FAILED,
          requestId,
          params: { reason: completeness.reason },
        }),
        { status: 502, headers: ridHeaders(requestId) },
      );
    }

    const summary = await generateNovelSynopsis({
      model: modelUsed || cascade[0]!,
      title: finalTitle,
      prompt: prompt.trim(),
      content: childrenSynopsisBody ?? finalContent,
      lengthTier,
      uiLocale,
    });

    const novel = await prisma.novel.create({
      data: {
        ownerKey,
        title: finalTitle,
        prompt: prompt.trim(),
        content: finalContent,
        summary:
          parentReadingTip && lengthOpts?.childrenTargetAge !== undefined
            ? `${summary ?? ""}\n\n${getChildrenAgeTier(parseChildrenTargetAge(lengthOpts.childrenTargetAge)).closingMark}\n${parentReadingTip}`.trim()
            : summary,
        status: "ready",
        visibility: defaultWorkVisibility(),
      },
    });
    await persistNovelLengthTier(novel.id, lengthTier);
    if (lengthOpts?.childrenTargetAge !== undefined) {
      await persistChildrenNovelMeta(novel.id, {
        kind: "children",
        targetAge: parseChildrenTargetAge(lengthOpts.childrenTargetAge),
        maxChars: maxCharsLimit,
        ...(childrenInterpretation ? { sourceInterpretation: childrenInterpretation } : {}),
        ...(parentReadingTip ? { parentReadingTip } : {}),
        storyTitle: finalTitle,
      });
    } else if (pipelineMeta) {
      await persistNovelGenerationMeta(novel.id, pipelineMeta);
    }
    if (briefJsonToPersist) {
      await saveNovelCreativeBriefJson(novel.id, briefJsonToPersist);
    }

    const coverGenre = resolveNovelCoverGenre({
      genreTagCoverGenre: genreTag?.coverGenre,
      title: finalTitle,
      summary,
      prompt: prompt.trim(),
      contentSnippet: finalContent.slice(0, 1200),
    });
    const coverPath = await ensureNovelCoverAfterCreate(
      novel.id,
      finalTitle,
      summary,
      [prompt.trim(), finalContent.slice(0, 600)].filter(Boolean).join(" "),
      600_000,
      coverGenre,
    );
    const novelOut = coverPath
      ? await prisma.novel.findUnique({ where: { id: novel.id } })
      : novel;

    emitGenerateServeLog({
      phase: "novel_generate",
      requestId,
      durationMs: Date.now() - startedAt,
      byteLength: json.byteLength,
      promptChars: prompt.length,
      source: "llm",
      llmProvider: providerUsed,
    });

    return NextResponse.json(
      { ok: true, novel: novelOut ?? novel, coverPath: coverPath ?? null, provider: providerUsed, model: modelUsed },
      { headers: ridHeaders(requestId) },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message, code: codes.LLM_FAILED, requestId },
      { status: 502, headers: ridHeaders(requestId) },
    );
  }
}
