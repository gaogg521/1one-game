import { PRODUCT } from "@/lib/product-config";
import {
  novelLengthConfig,
  novelMaxChars,
  parseNovelLengthTier,
  type NovelLengthTier,
} from "@/lib/novel-length";

/** @deprecated 使用 getNovelSystemPrompt(tier) */
export const NOVEL_SYSTEM_PROMPT = getNovelSystemPrompt("medium");

export function getNovelSystemPrompt(tier: NovelLengthTier): string {
  const cfg = novelLengthConfig(tier);
  return `你是一位擅长中文网络小说的 AI 作家。用户会给出一句话创意，你需要扩展为一篇**结构完整的${cfg.label}小说**。

要求：
1. **篇幅（硬性）**：全文 **${cfg.minChars}–${cfg.maxChars} 汉字**，不得超过 ${cfg.maxChars} 字；${cfg.chapterHint}。接近上限时必须在**当前章节内**写完高潮与结局，**禁止**继续新开章节。
2. 结构完整：有起承转合，包含开端、发展、高潮、收束；禁止半成品烂尾。
3. 角色鲜明：至少 2–3 个有名字的主要角色，性格立体。
4. 文笔流畅：适合在线阅读，段落分明，对话生动。
5. 只输出小说正文，不要输出 JSON、markdown 代码块、总结或元数据。
6. **每一章必须有醒目标题**；章节之间严格使用「=== 第X章 章节标题 ===」分隔（X 为阿拉伯数字，标题 2–12 字为宜）。
7. 开篇第一句或第一章标题要吸引人，贴合创意核心。`;
}

/** 单次小说 LLM 调用超时（流式/非流式、网关 x-openclaw-timeout-ms 对齐）。 */
export function novelLlmTimeoutMs(tier?: NovelLengthTier): number {
  const t = tier ?? "medium";
  return PRODUCT.novel.llmTimeoutMs[t];
}

export function novelLlmMaxOutputTokens(tier?: NovelLengthTier): number {
  const t = tier ?? "medium";
  const base = PRODUCT.novel.maxOutputTokens;
  const cap = novelMaxChars(t);
  const estimated = Math.ceil(cap * 1.35) + 512;
  if (t === "short") return Math.min(base, Math.max(2_048, estimated));
  if (t === "medium") return Math.min(base, Math.max(8_192, estimated));
  return base;
}

export { novelMaxChars };

export function novelMinAcceptChars(tier?: NovelLengthTier): number {
  const t = tier ?? "medium";
  const cfg = novelLengthConfig(t);
  const floor = PRODUCT.novel.minAcceptCharsFloor[t];
  const ratio = PRODUCT.novel.minAcceptCharsRatio[t];
  return Math.max(200, Math.max(floor, Math.floor(cfg.minChars * ratio)));
}

export function buildNovelUserMessage(
  prompt: string,
  title?: string,
  lengthTier?: NovelLengthTier,
  /** 含 Creative Brief 扩写块时使用完整上下文 */
  pipelinePrompt?: string,
): string {
  const tier = lengthTier ?? "medium";
  const cfg = novelLengthConfig(tier);
  const t = title?.trim();
  const creativeBlock = (pipelinePrompt ?? prompt).trim();
  return `请根据以下创意写完整${cfg.label}小说正文（目标 ${cfg.minChars}–${cfg.maxChars} 字，多章、每章带标题）：\n\n${creativeBlock}\n\n${t ? `建议标题：${t}` : ""}`;
}

export { parseNovelLengthTier, type NovelLengthTier };
