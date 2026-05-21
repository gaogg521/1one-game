import { NextResponse } from "next/server";
import { generationErrorCodes } from "@/lib/api/json-error-response";
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
  novelLlmTimeoutMs,
  novelMinAcceptChars,
  resolveNovelLengthTier,
} from "@/lib/novel-generate-config";
import { extractNovelTitleFromContent, validateNovelTitleInput } from "@/lib/novel-display";
import { generateNovelSynopsis } from "@/lib/novel-synopsis";
import { truncateNovelToMaxChars } from "@/lib/novel-chapters";
import {
  generateLongNovelBody,
  planLongNovelSegments,
  usesSegmentedLongGeneration,
} from "@/lib/novel-long-generate";
import { persistNovelGenerationMeta } from "@/lib/novel-pipeline-meta-db";
import { parseChildrenTargetAge } from "@/lib/children-age-length";
import { finalizeChildrenNovelContent } from "@/lib/children-novel-postprocess";
import { persistChildrenNovelMeta } from "@/lib/children-novel-meta-db";
import {
  isChildrenNovelTier,
  novelMaxChars,
  type NovelLengthOptions,
} from "@/lib/novel-length";
import { persistNovelLengthTier } from "@/lib/novel-length-tier-db";
import { getOwnerKey } from "@/lib/owner";
import { rateLimit } from "@/lib/rate-limit";
import { getThrottleKey } from "@/lib/request-key";
import { prisma } from "@/lib/prisma";
import { resolveMediaCreativeBrief } from "@/lib/creative-brief/resolve-media-brief";
import { parseNovelCreativeBrief, type NovelBriefUserRevision } from "@/lib/literary-brief";
import { PRODUCT } from "@/lib/product-config";
import {
  saveNovelCreativeBriefJson,
  serializeNovelCreativeBrief,
} from "@/lib/novel-creative-brief-db";
import { buildNovelBriefSeed, getNovelGenreTag } from "@/lib/novel-genre-tags";

export const maxDuration = 3600;

export async function POST(req: Request) {
  const codes = generationErrorCodes();
  const requestId = newGenerateRequestId();
  const rl = generateRateLimits();
  const ownerKey = (await getOwnerKey()) ?? "anon";
  const throttleKey = await getThrottleKey("novel_gen", ownerKey);
  if (!rateLimit(throttleKey, rl.postMax, rl.windowMs)) {
    return NextResponse.json(
      { error: "生成次数过多，请稍后再试", code: codes.RATE_LIMITED, requestId },
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
    childrenTargetAge: childrenTargetAgeRaw,
  } = json.body as {
    prompt?: string;
    title?: string;
    lengthTier?: string;
    creativeBrief?: unknown;
    briefRevision?: NovelBriefUserRevision;
    novelGenreTag?: string;
    childrenTargetAge?: number;
  };
  const lengthTier = resolveNovelLengthTier({
    genreTagId: novelGenreTag,
    lengthTierPick: lengthTierRaw,
  });
  const lengthOpts: NovelLengthOptions | undefined = isChildrenNovelTier(lengthTier)
    ? { childrenTargetAge: parseChildrenTargetAge(childrenTargetAgeRaw) }
    : undefined;
  if (!prompt || typeof prompt !== "string" || prompt.trim().length < 2) {
    return NextResponse.json(
      { error: "请提供小说创意描述（至少 2 个字符）", code: codes.BAD_REQUEST, requestId },
      { status: 400, headers: ridHeaders(requestId) },
    );
  }

  if (title?.trim()) {
    const tv = validateNovelTitleInput(title.trim());
    if (!tv.ok) {
      return NextResponse.json(
        { error: tv.error, code: codes.BAD_REQUEST, requestId },
        { status: 400, headers: ridHeaders(requestId) },
      );
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
    let briefToPersist: import("@/lib/literary-brief").NovelCreativeBrief | null = null;
    const genreTag = getNovelGenreTag(novelGenreTag);
    const titleTrim = title?.trim();
    if (PRODUCT.novel.creativeBriefExpand) {
      const preParsed = parseNovelCreativeBrief(creativeBriefRaw);
      const seed =
        titleTrim && genreTag ? buildNovelBriefSeed(titleTrim, genreTag) : prompt.trim();
      const briefResult = await resolveMediaCreativeBrief(seed, "novel", {
        preExpanded: preParsed ?? undefined,
        userRevision: briefRevisionRaw ?? undefined,
        novelGenreId: genreTag?.id,
        title: titleTrim,
      });
      if (briefResult) {
        pipelinePrompt = briefResult.augmentedPrompt;
        briefToPersist = briefResult.brief;
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
      } else {
        const result = await llmNovelText(
          {
            model,
            system: getNovelSystemPrompt(lengthTier, lengthOpts),
            user: userMsg,
            temperature: 0.85,
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
        { error: "小说生成失败，模型未返回足够内容", code: codes.LLM_FAILED, requestId },
        { status: 502, headers: ridHeaders(requestId) },
      );
    }

    const maxCharsLimit = novelMaxChars(lengthTier, lengthOpts);
    let finalContent = truncateNovelToMaxChars(content, maxCharsLimit);
    let finalTitle = extractNovelTitleFromContent(finalContent, title?.trim(), prompt.trim());
    let parentReadingTip: string | undefined;

    if (isChildrenNovelTier(lengthTier) && lengthOpts?.childrenTargetAge !== undefined) {
      const finalized = finalizeChildrenNovelContent(finalContent, {
        targetAge: parseChildrenTargetAge(lengthOpts.childrenTargetAge),
        fallbackTitle: title?.trim(),
      });
      finalTitle = finalized.dbTitle;
      finalContent = finalized.body;
      parentReadingTip = finalized.parentReadingTip || undefined;
    }

    const summary = await generateNovelSynopsis({
      model: modelUsed || cascade[0]!,
      title: finalTitle,
      prompt: prompt.trim(),
      content: finalContent,
      lengthTier,
    });

    const novel = await prisma.novel.create({
      data: {
        ownerKey,
        title: finalTitle,
        prompt: prompt.trim(),
        content: finalContent,
        summary: parentReadingTip
          ? `${summary ?? ""}\n\n【家长共读】${parentReadingTip}`.trim()
          : summary,
        status: "ready",
      },
    });
    await persistNovelLengthTier(novel.id, lengthTier);
    if (lengthOpts?.childrenTargetAge !== undefined) {
      await persistChildrenNovelMeta(novel.id, {
        kind: "children",
        targetAge: parseChildrenTargetAge(lengthOpts.childrenTargetAge),
        maxChars: maxCharsLimit,
        ...(parentReadingTip ? { parentReadingTip } : {}),
        storyTitle: finalTitle,
      });
    } else if (pipelineMeta) {
      await persistNovelGenerationMeta(novel.id, pipelineMeta);
    }
    if (briefToPersist) {
      await saveNovelCreativeBriefJson(novel.id, serializeNovelCreativeBrief(briefToPersist));
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
