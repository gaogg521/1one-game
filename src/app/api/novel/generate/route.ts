import { NextResponse } from "next/server";
import { generationErrorCodes } from "@/lib/api/json-error-response";
import { generateRateLimits } from "@/lib/api/generate-limits";
import { emitGenerateServeLog } from "@/lib/api/generate-serve-log";
import { newGenerateRequestId, ridHeaders } from "@/lib/api/request-id";
import { readLimitedJson } from "@/lib/api/read-json-body";
import { llmText, getProviderModelCascade } from "@/lib/llm";
import { generateNovelCover } from "@/lib/cover-generation";
import { getOwnerKey } from "@/lib/owner";
import { rateLimit } from "@/lib/rate-limit";
import { getThrottleKey } from "@/lib/request-key";
import { prisma } from "@/lib/prisma";

const SYSTEM_PROMPT = `你是一位擅长中文网络小说的 AI 作家。用户会给出一句话创意，你需要将其扩展为一篇**超过 1 万字**的完整长篇小说。

要求：
1. 必须超过 10000 字（约 15-20 章，每章 600-1000 字）
2. 结构完整：有起承转合，包含序幕、发展、高潮、结局
3. 角色鲜明：至少 3 个有名字的主要角色，性格立体
4. 文笔流畅：适合在线阅读，段落分明，对话生动
5. 只输出小说正文，不要输出 JSON、markdown 代码块、总结或元数据
6. 章节之间用「=== 第X章 章节标题 ===」分隔
7. 标题要吸引人，贴合创意核心`;

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

  const { prompt, title } = json.body as { prompt?: string; title?: string };
  if (!prompt || typeof prompt !== "string" || prompt.trim().length < 2) {
    return NextResponse.json(
      { error: "请提供小说创意描述（至少 2 个字符）", code: codes.BAD_REQUEST, requestId },
      { status: 400, headers: ridHeaders(requestId) },
    );
  }

  const startedAt = Date.now();
  const cascade = ["deepseek-v4-pro", ...getProviderModelCascade()];

  try {
    let content = "";
    let providerUsed = "";
    let modelUsed = "";

    for (const model of cascade) {
      const result = await llmText({
        model,
        system: SYSTEM_PROMPT,
        user: `请根据以下创意，创作一篇超过 1 万字的长篇小说：\n\n创意：${prompt.trim()}\n\n${title ? `建议标题：${title}` : ""}`,
        temperature: 0.85,
        maxTokens: 16_000,
        timeoutMs: 60_000,
      });
      if (result.ok && result.text.length >= 1000) {
        content = result.text;
        providerUsed = result.provider;
        modelUsed = result.model;
        break;
      }
    }

    if (!content || content.length < 1000) {
      return NextResponse.json(
        { error: "小说生成失败，模型未返回足够内容", code: codes.LLM_FAILED, requestId },
        { status: 502, headers: ridHeaders(requestId) },
      );
    }

    const extractedTitle = title?.trim() || content.split("\n")[0].replace(/^#+\s*/, "").slice(0, 80) || "未命名小说";
    const summary = content.slice(0, 300).replace(/\n/g, " ").slice(0, 200) + "…";

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

    // Fire-and-forget cover generation
    void generateNovelCover(novel.id, extractedTitle, summary).catch(() => {});

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
      { ok: true, novel, provider: providerUsed, model: modelUsed },
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
