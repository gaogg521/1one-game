import {
  detectBriefInputLocale,
  type BriefInputLocale,
} from "@/lib/creative-brief/detect-input-locale";

/** 从小说创意 + 正文推断漫画叠字（caption）语言 */
export function resolveComicOutputLocale(novelPrompt: string, novelContent: string): BriefInputLocale {
  const combined = `${novelPrompt.trim()}\n${novelContent.slice(0, 6000)}`;
  return detectBriefInputLocale(combined);
}

function captionLanguageLabel(locale: BriefInputLocale): string {
  switch (locale) {
    case "zh-Hant":
      return "繁體中文";
    case "en":
      return "English";
    case "ja":
      return "日本語";
    case "ms":
      return "Bahasa Melayu";
    case "th":
      return "ภาษาไทย";
    default:
      return "简体中文";
  }
}

/** 非中文短篇优先走轻量分镜（导演 JSON 对拉丁/泰文正文更 fragile） */
export function shouldPreferLightComicPipeline(
  pageCount: number,
  lengthTier: "short" | "children" | "medium" | "long" | null | undefined,
  outputLocale: BriefInputLocale,
  directorMinPages: number,
): boolean {
  if (lengthTier === "long") return false;
  if (pageCount >= directorMinPages) return false;
  return !["zh", "zh-Hant", "ja"].includes(outputLocale);
}

/** 非 CJK 正文缩小分镜批大小，降低 strict JSON schema 失败率 */
export function resolveStoryboardChunkPages(
  outputLocale: BriefInputLocale,
  defaultChunkPages: number,
): number {
  if (["zh", "zh-Hant", "ja"].includes(outputLocale)) return defaultChunkPages;
  return 1;
}

/** 非中文短篇默认四宫格，减少单次 JSON 格数（32→16） */
export function resolveComicLayoutForLocale(
  layoutId: import("@/lib/comic-layout").ComicLayoutId,
  outputLocale: BriefInputLocale,
  pageCount: number,
): import("@/lib/comic-layout").ComicLayoutId {
  if (["zh", "zh-Hant", "ja"].includes(outputLocale)) return layoutId;
  if (pageCount <= 4 && layoutId === "grid_8") return "grid_4";
  return layoutId;
}

export function panelContinuationSuffix(locale: BriefInputLocale): string {
  if (locale === "zh" || locale === "zh-Hant") return "（续）";
  if (locale === "ja") return "（続き）";
  if (locale === "th") return " (ต่อ)";
  if (locale === "ms") return " (samb.)";
  return " (cont.)";
}

export function buildComicMasterQualityBlock(locale: BriefInputLocale): string {
  const captionLang = captionLanguageLabel(locale);
  const overlayBlock =
    locale === "zh" || locale === "zh-Hant"
      ? `5. 中文叠字体系（画进网页，不画进图里）：
   - textType=dialogue：人物台词，caption 只写台词正文，speaker 写说话人名
   - textType=narration：页面叙事旁白（老式小人书解说）
   - textType=inner：内心独白，caption 用（……）包裹
   - textType=scene_note：场景/道具/环境注解
   - textType=time_place：时间地点标注`
      : `5. Overlay text system (rendered on the web page, NOT drawn in the image) — **caption must be in ${captionLang}**, matching the novel's language:
   - textType=dialogue: spoken line; caption = dialogue only; speaker = character name
   - textType=narration: story narration / caption box
   - textType=inner: inner monologue; wrap caption in parentheses
   - textType=scene_note: scene or prop note
   - textType=time_place: time/place stamp`;

  const rule1 =
    locale === "zh" || locale === "zh-Hant"
      ? "1. 严格按原文小说剧情制作连载漫画：每一格都必须对应**明确关键情节**，禁止私自篡改、脑补无关画面。"
      : "1. Adapt strictly from the source novel: every panel must map to a **clear story beat** from the text. Do not invent unrelated scenes.";

  const rule2 =
    locale === "zh" || locale === "zh-Hant"
      ? "2. 每一格必须还原该情节的动作、神态、场景氛围、人物站位；区分打斗/对话/独处/回忆，情绪贴合原文。"
      : "2. Each panel must reflect action, expression, mood, blocking, and setting from the source beat.";

  const rule3 =
    locale === "zh" || locale === "zh-Hant"
      ? "3. 全程固定所有人物外貌、发型、服饰、身高与标志性特征，整本人设统一。"
      : "3. Lock every character's face, hair, outfit, height, and signature traits across all panels.";

  const rule4 =
    locale === "zh" || locale === "zh-Hant"
      ? "4. 规范漫画分镜：合理搭配远景( wide )交代场景、中景( medium )互动、特写( close )表情、必要时过肩( over_shoulder )。"
      : "4. Use proper manga framing: wide for establishing shots, medium for interaction, close for expressions, over_shoulder when needed.";

  const rule6 =
    locale === "zh" || locale === "zh-Hant"
      ? "6. prompt 仅英文描述可见画面，禁止 dialogue / speech bubble / 可读文字 / 网红厚涂美颜 / 夸张二次元浓妆特效。"
      : "6. prompt field = English visual description only. No dialogue, speech bubbles, or readable text in the image. No influencer-style thick makeup or exaggerated anime glam.";

  const rule7 =
    locale === "zh" || locale === "zh-Hant"
      ? `7. **prompt 质量要求（极重要）**：每一格 prompt 必须是 **80–150 词的完整英文画面描述**，不可偷懒写成"角色在房间里"这类空泛短语。必须包含：
   - 具体场景环境（室内/室外、天气、光源方向、材质）
   - 人物外貌+服饰+动作+表情（若有人设锁定则严格按人设描述）
   - shotType 对应的构图（wide=全景交代空间关系，medium=中景两人互动，close=表情特写）
   - 画面氛围关键词（lighting, mood, color temperature）
   - 禁止在 prompt 中写对话内容或文字气泡`
      : `7. **prompt quality (critical)**: each prompt must be **80–150 English words** with environment, character look/outfit/pose/expression, shot framing, lighting/mood. Never use vague placeholders like "a character in a room". Do not put dialogue in prompt.`;

  const rule8 =
    locale === "zh" || locale === "zh-Hant"
      ? "8. **漫画感（重要）**：动作场面可加入 speed lines（速度线）、motion blur、impact frames；紧张场面可用 dramatic shadows、dutch angle；抒情场面用 soft focus、浅景深。prompt 中应体现这些漫画技法关键词。"
      : "8. **Manga feel**: action panels may use speed lines, motion blur, impact frames; tense scenes dramatic shadows or dutch angle; tender scenes soft focus or shallow depth of field.";

  const header =
    locale === "zh" || locale === "zh-Hant"
      ? "【改编总则 — 必须遵守】"
      : "【Adaptation rules — mandatory】";

  return `${header}
${rule1}
${rule2}
${rule3}
${rule4}
${overlayBlock}
${rule6}
${rule7}
${rule8}`;
}

export function buildComicLightUserMessage(opts: {
  locale: BriefInputLocale;
  chunkStart: number;
  chunkEnd: number;
  chunkPages: number;
  panelsPerPage: number;
  chunkPanels: number;
  pageCount: number;
  novelTitle: string;
  storySource: string;
}): string {
  const captionLang = captionLanguageLabel(opts.locale);
  if (opts.locale === "zh" || opts.locale === "zh-Hant") {
    return `请为以下小说改编漫画，输出第 ${opts.chunkStart}～${opts.chunkEnd} 页（共 ${opts.chunkPages} 页，每页 ${opts.panelsPerPage} 格，共 ${opts.chunkPanels} 格）。
全书共 ${opts.pageCount} 页。本批应优先依据【关键情节】组织分镜，每格对应一个清晰故事瞬间；sourceSegmentIndex 尽量填写相关段落号减 1。
区分 textType（对白/旁白/内心/场景/时间）；shotType 搭配远景/中景/特写；禁止脑补段落外剧情。caption 使用${captionLang}。

小说标题：${opts.novelTitle}

${opts.storySource}

请输出 JSON，根对象包含长度为 ${opts.chunkPages} 的 "pages" 数组。`;
  }

  return `Adapt the following novel into comic storyboard pages ${opts.chunkStart}–${opts.chunkEnd} (${opts.chunkPages} pages, ${opts.panelsPerPage} panels each, ${opts.chunkPanels} panels total).
Total book length: ${opts.pageCount} pages. Organize by **key beats**; one panel = one clear story moment. Set sourceSegmentIndex to segment# minus 1 when applicable.
Use textType (dialogue/narration/inner/scene_note/time_place) and shotType (wide/medium/close/over_shoulder/extreme_close). Do not invent off-text plot. **caption must be in ${captionLang}**.

Novel title: ${opts.novelTitle}

${opts.storySource}

Output JSON with a "pages" array of length ${opts.chunkPages}.`;
}

export function buildStoryboardChunkUserMessage(opts: {
  locale: BriefInputLocale;
  directorBlock: string;
  chunkStart: number;
  chunkEnd: number;
  chunkPages: number;
  totalPages: number;
  panelsPerPage: number;
}): string {
  const captionLang = captionLanguageLabel(opts.locale);
  if (opts.locale === "zh" || opts.locale === "zh-Hant") {
    return `${opts.directorBlock}

请输出第 ${opts.chunkStart}～${opts.chunkEnd} 页分镜 JSON（共 ${opts.chunkPages} 页，全书 ${opts.totalPages} 页）。
每页尽量 ${opts.panelsPerPage} 格；每格对应关键情节，不要机械平均切段；scene 为全书递增格序号。caption 使用${captionLang}。`;
  }

  return `${opts.directorBlock}

Output storyboard JSON for pages ${opts.chunkStart}–${opts.chunkEnd} (${opts.chunkPages} pages of ${opts.totalPages} total).
Up to ${opts.panelsPerPage} panels per page; each panel = one key beat; scene = global panel index. caption in ${captionLang}.`;
}

export function buildDirectorSystemPrompt(locale: BriefInputLocale): string {
  const block = buildComicMasterQualityBlock(locale);
  if (locale === "zh" || locale === "zh-Hant") {
    return `你是长篇漫画改编的「导演」。通读小说节选后输出 JSON 导演包（ComicDirectorPack），锁定全片视觉一致性。

${block}

要求：
- characters：每人固定 id（char_1…）、appearanceEn/outfitEn 英文可视描述，整本不得改脸型服装
- locations：场景 id（loc_1…）与 descriptionEn
- pageBeats：恰好覆盖全书每一页，keyEvents 写该页应发生的**原文情节**（禁止脑补）
- visualStyleEn：全片画风英文（必须与用户指定画风一致）
- taboos：禁止网红厚涂、夸张二次元浓妆、图内可读文字`;
  }

  return `You are the director for a serialized comic adaptation. Read the novel excerpt and output a ComicDirectorPack JSON that locks visual consistency.

${block}

Requirements:
- characters: stable ids (char_1…), appearanceEn/outfitEn in English; never redesign faces/outfits
- locations: ids (loc_1…) with descriptionEn
- pageBeats: exactly one entry per page; keyEvents describe **source plot beats** (no invention)
- visualStyleEn: English style lock matching the user's preset
- taboos: no readable text in image, no influencer thick makeup, no random redesigns`;
}

export function buildStoryboardSystemPrompt(locale: BriefInputLocale, panelsPerPage: number): string {
  const block = buildComicMasterQualityBlock(locale);
  if (locale === "zh" || locale === "zh-Hant") {
    return `你是漫画分镜师。必须严格使用导演包中的角色 id、场景 id 与页节拍，不得发明新主角外貌。

${block}

每格输出：textType、speaker（对白时）、caption、sceneDescriptionEn、characterIds、locationId、shotType、sourceSegmentIndex（若提供段落编号）。
全片 ${panelsPerPage} 格/页；格间叙事连贯；约 1 段落 1～2 格。`;
  }

  return `You are a manga storyboard artist. Strictly use character ids, location ids, and page beats from the director pack. Do not invent new lead character designs.

${block}

Each panel: textType, speaker (if dialogue), caption (same language as the novel), sceneDescriptionEn, characterIds, locationId, shotType, sourceSegmentIndex when segment numbers are provided.
${panelsPerPage} panels per page; coherent pacing; roughly 1–2 panels per source segment.`;
}

export function lightStoryboardHeaderLabels(locale: BriefInputLocale): {
  prompt: string;
  summary: string;
  beats: string;
  segments: string;
  truncated: string;
} {
  if (locale === "zh" || locale === "zh-Hant") {
    return {
      prompt: "改编要点 / 创意构思：",
      summary: "故事简介：",
      beats: "【本批关键情节（优先一格对应一个关键瞬间）】",
      segments: "【本批可参考的原文段落】",
      truncated: "…（后续段落于下一批分镜继续）",
    };
  }
  return {
    prompt: "Adaptation brief / creative intent:",
    summary: "Story summary:",
    beats: "[Key beats for this batch — one panel per moment]",
    segments: "[Source segments for this batch]",
    truncated: "…(continued in next storyboard batch)",
  };
}

export function formatSegmentFallback(locale: BriefInputLocale): string {
  if (locale === "zh" || locale === "zh-Hant") return "（正文过短，请结合标题与简介改编）";
  return "(Source text too short — adapt from title and summary)";
}

export function formatDialogueHintLabel(locale: BriefInputLocale): string {
  if (locale === "zh" || locale === "zh-Hant") {
    return "【本段对白提取 — 请用 dialogue+speaker 填入分镜】";
  }
  return "[Extracted dialogue — use dialogue + speaker in panels]";
}

export function captionFieldInstruction(locale: BriefInputLocale, maxLen = 48): string {
  const lang = captionLanguageLabel(locale);
  if (locale === "zh" || locale === "zh-Hant") {
    return `caption：${lang}叠字（≤${maxLen} 字）`;
  }
  return `caption: ${lang} overlay text (≤${maxLen} chars)`;
}
