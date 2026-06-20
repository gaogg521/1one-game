import type { AppLocale } from "@/i18n/routing";
import { isGenericNovelChapterTitle, novelSynopsisMessage } from "@/lib/i18n/chapter-labels";
import { parseNovelChapters } from "@/lib/novel-chapters";
import { looksLikeOutlineOrPrompt } from "@/lib/novel-display";
import { llmNovelText } from "@/lib/llm";
import type { NovelLengthTier } from "@/lib/novel-length";
import { resolveNovelOutputLocale } from "@/lib/creative-brief/detect-input-locale";

/** 无 LLM 时从创意 / 开篇 / 章节目录拼一段可读梗概（客户端可用）。 */
export function buildNovelSynopsisHeuristic(
  content: string,
  prompt: string,
  title: string,
  uiLocale: AppLocale = "zh-Hans",
): string {
  const cleanPrompt = prompt.trim().replace(/\s+/g, " ");
  const listSep = uiLocale.startsWith("zh") ? "、" : ", ";

  if (
    cleanPrompt.length >= 16 &&
    cleanPrompt.length <= 220 &&
    !looksLikeOutlineOrPrompt(cleanPrompt) &&
    /[。！？.!?]/.test(cleanPrompt)
  ) {
    return cleanPrompt;
  }

  const chapters = parseNovelChapters(content.trim(), uiLocale);
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
    .filter((t) => t && !isGenericNovelChapterTitle(t) && t.length >= 2 && t.length <= 14);

  if (hook.length >= 20) {
    if (arcTitles.length >= 2 && chapters.length > 1) {
      const arc = arcTitles.slice(0, 3).join(listSep);
      const tail = novelSynopsisMessage(uiLocale, "arcTail", { count: chapters.length, arc });
      const merged = `${hook.replace(/…$/, "")} ${tail}`;
      return merged.length > 200 ? merged.slice(0, 198) + "…" : merged;
    }
    return hook.length > 200 ? hook.slice(0, 198) + "…" : hook;
  }

  if (cleanPrompt.length >= 8) {
    const p = cleanPrompt.length > 100 ? `${cleanPrompt.slice(0, 98)}…` : cleanPrompt;
    return `${title}：${p}`;
  }

  return novelSynopsisMessage(uiLocale, "aiFallback", { title });
}

/** 从正文中提取首章+末章+章节标题，总控制在 6000 字以内，让摘要覆盖完整弧线。
 * M4 修复：4000→6000 提升超长小说摘要质量（60000+ 字小说末章 1000 字覆盖不足）。 */
function buildSynopsisExcerpt(content: string, uiLocale: AppLocale): string {
  const chapters = parseNovelChapters(content.trim(), uiLocale);
  if (chapters.length === 0) return content.trim().slice(0, 6000);

  const titles = chapters
    .map((c) => c.title?.trim())
    .filter(Boolean)
    .join(" / ");
  const titlesBlock = titles ? `[目录] ${titles}\n\n` : "";

  // 超长小说（>30 章）给首末章更多篇幅
  const isLongNovel = chapters.length > 30;
  const firstBody = chapters[0]!.body.trim().slice(0, isLongNovel ? 2200 : 1500);
  const lastBody = chapters.length > 1
    ? chapters[chapters.length - 1]!.body.trim().slice(0, isLongNovel ? 1600 : 1000)
    : "";

  const parts = [titlesBlock, `[首章]\n${firstBody}`];
  if (lastBody) parts.push(`[末章]\n${lastBody}`);
  return parts.join("\n\n").slice(0, 6000);
}

/** 生成入库用简介：优先 LLM 梗概，失败则启发式。 */
export async function generateNovelSynopsis(params: {
  model: string;
  title: string;
  prompt: string;
  content: string;
  lengthTier?: NovelLengthTier;
  uiLocale?: AppLocale;
}): Promise<string> {
  const uiLocale = params.uiLocale ?? "zh-Hans";
  const excerpt = buildSynopsisExcerpt(params.content, uiLocale);
  try {
    // 产品优化：system prompt 按输出语言适配（原硬编码中文，非中文小说摘要质量差）
    const outputLocale = resolveNovelOutputLocale(params.prompt);
    const systemByLocale: Record<string, string> = {
      zh: `你是中文网文平台的文案编辑。根据书名、创意与正文节选，写一段小说简介（剧情梗概）。
硬性要求：2–3 句；80–160 个汉字；第三人称；写清主角处境、世界观与核心矛盾；不要剧透结局；不要章节列表、不要 JSON、不要 markdown。`,
      en: `You are a copy editor for a fiction platform. Based on the title, concept, and excerpt, write a novel synopsis.
Requirements: 2-3 sentences; 40-100 English words; third person; clarify the protagonist's situation, world-building, and core conflict; do not spoil the ending; no chapter lists, no JSON, no markdown.`,
      ja: `あなたは小説プラットフォームの編集者です。タイトル、コンセプト、本文抜粋に基づいて小説のあらすじを書いてください。
要件：2〜3文；80〜160文字；三人称；主人公の状況、世界観、核心の葛藤を明確に；結末のネタバレ禁止；章リスト・JSON・markdown禁止。`,
      ms: `Anda adalah editor salinan untuk platform fiksyen. Berdasarkan tajuk, konsep, dan petikan, tulis sinopsis novel.
Keperluan: 2-3 ayat; 40-100 perkataan; orang ketiga; jelaskan situasi protagonis, pembinaan dunia, dan konflik teras; jangan rosakkan pengakhiran; tiada senarai bab, JSON, markdown.`,
      th: `คุณเป็นบรรณาธิการสำหรับแพลตฟอร์มนิยาย จากชื่อ แนวคิด และบทคัดย่อ เขียนเรื่องย่อนิยาย
ข้อกำหนด: 2-3 ประโยค; 40-100 คำ; บุคคลที่สาม; อธิบายสถานการณ์พระเอก การสร้างโลก และความขัดแย้งหลัก; ห้ามสปอยยอด; ห้ามลิสต์บท JSON markdown`,
    };
    const system = systemByLocale[outputLocale] ?? systemByLocale.zh;
    const result = await llmNovelText(
      {
        model: params.model,
        system,
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
  return buildNovelSynopsisHeuristic(params.content, params.prompt, params.title, uiLocale);
}
