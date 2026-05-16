import { NextResponse } from "next/server";
import { generationErrorCodes } from "@/lib/api/json-error-response";
import { generateRateLimits } from "@/lib/api/generate-limits";
import { emitGenerateServeLog } from "@/lib/api/generate-serve-log";
import { newGenerateRequestId, ridHeaders } from "@/lib/api/request-id";
import { readLimitedJson } from "@/lib/api/read-json-body";
import { llmText, getNovelStyleTextModelCascade } from "@/lib/llm";
import { ensureNovelCoverAfterCreate } from "@/lib/cover-generation";
import {
  getNovelSystemPrompt,
  buildNovelUserMessage,
  novelLlmMaxOutputTokens,
  novelLlmTimeoutMs,
  novelMinAcceptChars,
  parseNovelLengthTier,
} from "@/lib/novel-generate-config";
import { extractNovelTitleFromContent, validateNovelTitleInput } from "@/lib/novel-display";
import { getOwnerKey } from "@/lib/owner";
import { rateLimit } from "@/lib/rate-limit";
import { getThrottleKey } from "@/lib/request-key";
import { prisma } from "@/lib/prisma";

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

  const { prompt, title, lengthTier: lengthTierRaw } = json.body as {
    prompt?: string;
    title?: string;
    lengthTier?: string;
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
    let providerUsed = "";
    let modelUsed = "";

    const minChars = novelMinAcceptChars(lengthTier);
    const timeoutMs = novelLlmTimeoutMs();
    const maxTokens = novelLlmMaxOutputTokens(lengthTier);
    const userMsg = buildNovelUserMessage(prompt.trim(), title?.trim(), lengthTier);

    for (const model of cascade) {
      const result = await llmText({
        model,
        system: getNovelSystemPrompt(lengthTier),
        user: userMsg,
        temperature: 0.85,
        maxTokens,
        timeoutMs,
      });
      if (result.ok && result.text.length >= minChars) {
        content = result.text;
        providerUsed = result.provider;
        modelUsed = result.model;
        break;
      }
    }

    if (!content || content.length < minChars) {
      return NextResponse.json(
        { error: "小说生成失败，模型未返回足够内容", code: codes.LLM_FAILED, requestId },
        { status: 502, headers: ridHeaders(requestId) },
      );
    }

    const extractedTitle = extractNovelTitleFromContent(content, title?.trim(), prompt.trim());
    const summary = content.slice(0, 300).replace(/\n/g, " ").slice(0, 200) + "…";

    const novel = await prisma.novel.create({
      data: {
        ownerKey,
        title: extractedTitle,
        prompt: prompt.trim(),
        content,
        summary,
        lengthTier,
        status: "ready",
      },
    });

    const coverPath = await ensureNovelCoverAfterCreate(
      novel.id,
      extractedTitle,
      summary,
      prompt.trim(),
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
