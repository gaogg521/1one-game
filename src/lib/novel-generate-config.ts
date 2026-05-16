import { envIntPositive } from "@/lib/llm/openai-token-param";
import { novelLengthConfig, parseNovelLengthTier, type NovelLengthTier } from "@/lib/novel-length";

/** @deprecated 使用 getNovelSystemPrompt(tier) */
export const NOVEL_SYSTEM_PROMPT = getNovelSystemPrompt("medium");

export function getNovelSystemPrompt(tier: NovelLengthTier): string {
  const cfg = novelLengthConfig(tier);
  return `你是一位擅长中文网络小说的 AI 作家。用户会给出一句话创意，你需要扩展为一篇**结构完整的${cfg.label}小说**。

要求：
1. **篇幅**：全文 **不少于约 ${cfg.minChars} 汉字**，尽量充实但不超过约 ${cfg.maxChars} 字；${cfg.chapterHint}。
2. 结构完整：有起承转合，包含开端、发展、高潮、收束；禁止半成品烂尾。
3. 角色鲜明：至少 2–3 个有名字的主要角色，性格立体。
4. 文笔流畅：适合在线阅读，段落分明，对话生动。
5. 只输出小说正文，不要输出 JSON、markdown 代码块、总结或元数据。
6. **每一章必须有醒目标题**；章节之间严格使用「=== 第X章 章节标题 ===」分隔（X 为阿拉伯数字，标题 2–12 字为宜）。
7. 开篇第一句或第一章标题要吸引人，贴合创意核心。`;
}

export function novelLlmTimeoutMs(): number {
  return envIntPositive("NOVEL_LLM_TIMEOUT_MS", 600_000);
}

export function novelLlmMaxOutputTokens(tier?: NovelLengthTier): number {
  const base = envIntPositive("NOVEL_LLM_MAX_OUTPUT_TOKENS", 65_536);
  if (tier === "short") return Math.min(base, 8_192);
  if (tier === "long") return base;
  return base;
}

export function novelMinAcceptChars(tier?: NovelLengthTier): number {
  const t = tier ?? "medium";
  const cfg = novelLengthConfig(t);
  const envKey =
    t === "short"
      ? "NOVEL_MIN_ACCEPT_CHARS_SHORT"
      : t === "long"
        ? "NOVEL_MIN_ACCEPT_CHARS_LONG"
        : "NOVEL_MIN_ACCEPT_CHARS_MEDIUM";
  const fallback =
    t === "short" ? Math.max(180, Math.floor(cfg.minChars * 0.6)) : t === "long" ? Math.max(8000, Math.floor(cfg.minChars * 0.85)) : Math.max(1600, Math.floor(cfg.minChars * 0.85));
  return Math.max(200, envIntPositive(envKey, fallback));
}

export function buildNovelUserMessage(prompt: string, title?: string, lengthTier?: NovelLengthTier): string {
  const tier = lengthTier ?? "medium";
  const cfg = novelLengthConfig(tier);
  const t = title?.trim();
  return `请根据以下创意写完整${cfg.label}小说正文（目标 ${cfg.minChars}–${cfg.maxChars} 字，多章、每章带标题）：\n\n创意：${prompt.trim()}\n\n${t ? `建议标题：${t}` : ""}`;
}

export { parseNovelLengthTier, type NovelLengthTier };
