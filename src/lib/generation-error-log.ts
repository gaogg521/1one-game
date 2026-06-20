import { prisma } from "@/lib/prisma";

export type GenerationContentType = "game" | "novel" | "comic";

export type GenerationErrorType =
  | "timeout"
  | "rate_limit"
  | "context_length"
  | "parse_error"
  | "upstream"
  | "unknown";

function classifyError(err: unknown): GenerationErrorType {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("etimedout") || msg.includes("deadline")) return "timeout";
  if (msg.includes("rate limit") || msg.includes("429") || msg.includes("ratelimit") || msg.includes("too many requests")) return "rate_limit";
  if (msg.includes("context length") || msg.includes("max_tokens") || msg.includes("token limit") || msg.includes("context window") || msg.includes("maximum context") || msg.includes("finish_reason") && msg.includes("length")) return "context_length";
  if (msg.includes("parse") || msg.includes("invalid json") || msg.includes("unexpected token") || msg.includes("json parse") || msg.includes("syntax error")) return "parse_error";
  if (msg.includes("upstream") || msg.includes("502") || msg.includes("503") || msg.includes("504") || msg.includes("context canceled") || msg.includes("econnrefused") || msg.includes("econnreset")) return "upstream";
  return "unknown";
}

/** 静默记录生成失败（不抛出，不阻塞主流程） */
export async function logGenerationError(params: {
  contentType: GenerationContentType;
  prompt: string;
  error: unknown;
  ownerKey?: string;
}): Promise<void> {
  try {
    const errorType = classifyError(params.error);
    const errorMessage = params.error instanceof Error
      ? params.error.message.slice(0, 512)
      : String(params.error).slice(0, 512);
    await prisma.generationError.create({
      data: {
        contentType: params.contentType,
        promptSnippet: params.prompt.trim().slice(0, 512),
        errorType,
        errorMessage,
        ownerKey: params.ownerKey ?? null,
      },
    });
  } catch {
    // 日志写入失败不影响主流程
  }
}
