import { getNovelStyleTextModelCascade, llmText } from "@/lib/llm";
import { PRODUCT } from "@/lib/product-config";

const MIN_COMIC_BODY_CHARS = 280;

/** 一句话创意是否过短，需先扩写成可改编正文 */
export function comicCreativeNeedsExpansion(text: string): boolean {
  const t = text.trim();
  return t.length > 0 && t.length < MIN_COMIC_BODY_CHARS;
}

/**
 * 将短创意扩写为漫画可改编的短篇正文（2～4 段叙事，含对白场景）。
 * 失败时回退为带场景提示的原文。
 */
export async function expandComicCreativeToStoryBody(
  pitch: string,
  title?: string,
): Promise<{ body: string; expanded: boolean }> {
  const trimmed = pitch.trim();
  if (!comicCreativeNeedsExpansion(trimmed)) {
    return { body: trimmed, expanded: false };
  }

  const cascade = getNovelStyleTextModelCascade();
  const system = `你是漫画改编前的故事扩写助手。用户只给了一句话创意，你需要写成可供分镜改编的短篇叙事正文。
要求：
- 800～1800 汉字，2～4 个自然段，可含 1～2 句人物对白（写在正文里）
- 有明确场景、人物动作与情绪，禁止只列大纲
- 不要写「第X章」标题，不要 JSON
- 语言与创意一致（中文创意用中文）`;

  const user = [
    title?.trim() ? `标题参考：${title.trim()}` : "",
    `创意：${trimmed}`,
    "请直接输出正文，不要前言后记。",
  ]
    .filter(Boolean)
    .join("\n");

  let lastErr = "";
  for (const model of cascade) {
    const result = await llmText({
      model,
      system,
      user,
      temperature: 0.75,
      maxTokens: 2_400,
      timeoutMs: Math.min(PRODUCT.comic.briefExpandTimeoutMs * 3, 72_000),
    });
    if (result.ok && result.text && result.text.trim().length >= MIN_COMIC_BODY_CHARS) {
      return { body: result.text.trim(), expanded: true };
    }
    lastErr = !result.ok ? result.error : "扩写过短";
  }

  const fallback = [
    trimmed,
    "",
    "【场景展开】角色在具体环境中行动，通过对白与旁白推进情节，等待分镜改编。",
  ].join("\n");
  console.warn("[comic-creative-expand] 回退原文", lastErr);
  return { body: fallback, expanded: false };
}
