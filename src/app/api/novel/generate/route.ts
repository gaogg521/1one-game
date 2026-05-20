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
  parseNovelLengthTier,
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
import { novelMaxChars } from "@/lib/novel-length";
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
  } = json.body as {
    prompt?: string;
    title?: string;
    lengthTier?: string;
    creativeBrief?: unknown;
    briefRevision?: NovelBriefUserRevision;
    novelGenreTag?: string;
  };
  const lengthTier = parseNovelLengthTier(lengthTierRaw);
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

    const minChars = novelMinAcceptChars(lengthTier);
    const timeoutMs = novelLlmTimeoutMs(lengthTier);
    const maxTokens = novelLlmMaxOutputTokens(lengthTier);
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
    const userMsg = buildNovelUserMessage(prompt.trim(), title?.trim(), lengthTier, pipelinePrompt);
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
            system: getNovelSystemPrompt(lengthTier),
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

    content = truncateNovelToMaxChars(content, novelMaxChars(lengthTier));

    const extractedTitle = extractNovelTitleFromContent(content, title?.trim(), prompt.trim());
    const summary = await generateNovelSynopsis({
      model: modelUsed || cascade[0]!,
      title: extractedTitle,
      prompt: prompt.trim(),
      content,
      lengthTier,
    });

    const novel = await prisma.novel.create({
      data: {
        ownerKey,
        title: extractedTitle,
        prompt: prompt.trim(),
        content,
        summary,
        status: "ready",
      },
    });
    await persistNovelLengthTier(novel.id, lengthTier);
    if (pipelineMeta) {
      await persistNovelGenerationMeta(novel.id, pipelineMeta);
    }
    if (briefToPersist) {
      await saveNovelCreativeBriefJson(novel.id, serializeNovelCreativeBrief(briefToPersist));
    }

    const coverGenre = resolveNovelCoverGenre({
      genreTagCoverGenre: genreTag?.coverGenre,
      title: extractedTitle,
      summary,
      prompt: prompt.trim(),
      contentSnippet: content.slice(0, 1200),
    });
    const coverPath = await ensureNovelCoverAfterCreate(
      novel.id,
      extractedTitle,
      summary,
      [prompt.trim(), content.slice(0, 600)].filter(Boolean).join(" "),
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
