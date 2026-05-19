import { parseNovelChapters } from "@/lib/novel-chapters";
import { looksLikeOutlineOrPrompt } from "@/lib/novel-display";
import { llmNovelText } from "@/lib/llm";
import type { NovelLengthTier } from "@/lib/novel-length";

/** 无 LLM 时从创意 / 开篇 / 章节目录拼一段可读梗概（客户端可用）。 */
export function buildNovelSynopsisHeuristic(
  content: string,
  prompt: string,
  title: string,
): string {
  const cleanPrompt = prompt.trim().replace(/\s+/g, " ");

  if (
    cleanPrompt.length >= 16 &&
    cleanPrompt.length <= 220 &&
    !looksLikeOutlineOrPrompt(cleanPrompt) &&
    /[。！？]/.test(cleanPrompt)
  ) {
    return cleanPrompt;
  }

  const chapters = parseNovelChapters(content.trim());
  const ch1 = chapters[0]?.body ?? content;
  const paras = ch1
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 30);
  let hook = (paras[0] ?? ch1.replace(/\s+/g, " ").trim()).replace(/\s+/g, " ");

  if (hook.startsWith(title)) hook = hook.slice(title.length).replace(/^[：:，,\s]+/, "");
  if (hook.length > 130) {
    const cut = hook.slice(0, 130);
    const comma = cut.lastIndexOf("，");
    hook = (comma > 50 ? cut.slice(0, comma + 1) : cut.slice(0, 120)) + "…";
  }

  const arcTitles = chapters
    .slice(0, 8)
    .map((c) => c.title.trim())
    .filter(
      (t) =>
        t &&
        t !== "开篇" &&
        t !== "正文" &&
        !/^第\s*\d+\s*章/.test(t) &&
        t.length >= 2 &&
        t.length <= 14,
    );

  if (hook.length >= 20) {
    if (arcTitles.length >= 2 && chapters.length > 1) {
      const arc = arcTitles.slice(0, 3).join("、");
      const tail = `全书 ${chapters.length} 章，含「${arc}」等情节。`;
      const merged = `${hook.replace(/…$/, "")} ${tail}`;
      return merged.length > 200 ? merged.slice(0, 198) + "…" : merged;
    }
    return hook.length > 200 ? hook.slice(0, 198) + "…" : hook;
  }

  if (cleanPrompt.length >= 8) {
    const p = cleanPrompt.length > 100 ? `${cleanPrompt.slice(0, 98)}…` : cleanPrompt;
    return `${title}：${p}`;
  }

  return `${title}：一部 AI 生成的原创连载故事。`;
}

/** 生成入库用简介：优先 LLM 梗概，失败则启发式。 */
export async function generateNovelSynopsis(params: {
  model: string;
  title: string;
  prompt: string;
  content: string;
  lengthTier?: NovelLengthTier;
}): Promise<string> {
  const excerpt = params.content.trim().slice(0, 4000);
  try {
    const result = await llmNovelText(
      {
        model: params.model,
        system: `你是中文网文平台的文案编辑。根据书名、创意与正文节选，写一段小说简介（剧情梗概）。
硬性要求：2–3 句；80–160 个汉字；第三人称；写清主角处境、世界观与核心矛盾；不要剧透结局；不要章节列表、不要 JSON、不要 markdown。`,
        user: `书名：${params.title}\n创意：${params.prompt.trim().slice(0, 700)}\n\n正文节选：\n${excerpt}`,
        temperature: 0.65,
        maxTokens: 320,
        timeoutMs: 90_000,
      },
      params.lengthTier ?? "short",
    );
    if (result.ok) {
      const t = result.text.trim().replace(/\s+/g, " ");
      if (t.length >= 24 && !looksLikeOutlineOrPrompt(t)) {
        return t.length > 200 ? `${t.slice(0, 198)}…` : t;
      }
    }
  } catch {
    /* fallback */
  }
  return buildNovelSynopsisHeuristic(params.content, params.prompt, params.title);
}
