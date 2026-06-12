import { PRODUCT } from "@/lib/product-config";
import {
  resolveNovelOutputLocale,
  type BriefInputLocale,
} from "@/lib/creative-brief/detect-input-locale";
import {
  buildChildrenNovelUserMessage,
  CHILDREN_NOVEL_LLM_TEMPERATURE,
  getChildrenNovelSystemPrompt,
} from "@/lib/children-novel-creative";
import { parseChildrenTargetAge } from "@/lib/children-age-length";
import {
  novelLengthConfig,
  novelMaxChars,
  type NovelLengthOptions,
  type NovelLengthTier,
} from "@/lib/novel-length";
import { novelChapterHint, novelPlannedWritingRule } from "@/lib/novel-locale-prompts";

function resolveNovelOutputLanguage(prompt?: string): BriefInputLocale {
  return resolveNovelOutputLocale(prompt ?? "");
}

function buildLocalizedNovelPromptParts(prompt?: string): {
  language: BriefInputLocale;
  system: string;
  userPrefix: string;
  titleHint: (title: string) => string;
} {
  const language = resolveNovelOutputLanguage(prompt);
  if (language === "en") {
    return {
      language,
      system:
        "You are a skilled web-novel writer. Expand the user's concept into a complete serialized-style novel. All visible output must stay in English.",
      userPrefix:
        "Write a complete novel from the following concept. Keep the entire visible output in English, use multiple titled chapters, finish the main plot, and provide a clear ending:",
      titleHint: (title) => `Suggested title: ${title}`,
    };
  }
  if (language === "ja") {
    return {
      language,
      system:
        "あなたはWeb小説に強い作家です。ユーザーの発想を、入力言語を保ったまま、起承転結のある完成した小説に拡張してください。",
      userPrefix:
        "以下の着想から、複数章・各章見出し付きの完成した小説本文を書いてください。出力は日本語を保ち、主筋を完結させ、明確な結末まで書いてください：",
      titleHint: (title) => `推奨タイトル：${title}`,
    };
  }
  if (language === "ms") {
    return {
      language,
      system:
        "Anda ialah penulis novel web yang mahir. Kembangkan idea pengguna menjadi novel lengkap, dan semua output yang kelihatan mesti kekal dalam Bahasa Melayu.",
      userPrefix:
        "Tulis novel lengkap berdasarkan idea berikut. Kekalkan seluruh output dalam Bahasa Melayu, gunakan beberapa bab bertajuk, selesaikan konflik utama, dan berikan penutup yang jelas:",
      titleHint: (title) => `Tajuk dicadangkan: ${title}`,
    };
  }
  if (language === "th") {
    return {
      language,
      system:
        "คุณคือนักเขียนเว็บโนเวลที่ชำนาญ จงขยายแนวคิดของผู้ใช้ให้เป็นนิยายที่สมบูรณ์ และข้อความทั้งหมดที่แสดงต้องคงเป็นภาษาไทย",
      userPrefix:
        "เขียนนิยายที่สมบูรณ์จากแนวคิดต่อไปนี้ โดยคงผลลัพธ์ทั้งหมดเป็นภาษาไทย ใช้หลายบทพร้อมชื่อบท ปิดเส้นเรื่องหลัก และมีตอนจบที่ชัดเจน:",
      titleHint: (title) => `ชื่อเรื่องที่แนะนำ: ${title}`,
    };
  }
  if (language === "zh-Hant") {
    return {
      language,
      system:
        "你是一位擅長繁體中文網路小說的 AI 作家。用戶會給出一句话創意，你需要擴展為一篇結構完整的繁體中文網路小說。全文必須使用繁體中文，不得混用簡體字。",
      userPrefix:
        "請根據以下創意寫完整小說正文。必須使用繁體中文，寫完主線、情節緊湊、最後有明確結局，不能只寫開頭或停在懸念處：",
      titleHint: (title) => `建議標題：${title}`,
    };
  }
  return {
    language,
    system: "你是一位擅长中文网络小说的 AI 作家。用户会给出一句话创意，你需要扩展为一篇结构完整的中文网络小说。",
    userPrefix:
      "请根据以下创意写完整小说正文。必须写完主线、情节紧凑、最后有明确结局，不能只写开头或停在悬念处：",
    titleHint: (title) => `建议标题：${title}`,
  };
}

/** @deprecated 使用 getNovelSystemPrompt(tier) */
export const NOVEL_SYSTEM_PROMPT = getNovelSystemPrompt("medium");

export function getNovelSystemPrompt(
  tier: NovelLengthTier,
  opts?: NovelLengthOptions,
  prompt?: string,
): string {
  const cfg = novelLengthConfig(tier, opts);
  if (tier === "children") {
    const age = parseChildrenTargetAge(opts?.childrenTargetAge);
    return getChildrenNovelSystemPrompt(age, opts?.childrenUserPrompt);
  }
  const localized = buildLocalizedNovelPromptParts(prompt);
  const chapterHint = novelChapterHint(tier, localized.language);
  const plannedRule = novelPlannedWritingRule(localized.language, cfg.minChars, cfg.maxChars);
  if (localized.language === "en") {
    return `${localized.system}

Requirements:
1. Length target: approximately ${cfg.minChars}-${cfg.maxChars} characters; ${chapterHint}.
2. ${plannedRule}
3. Deliver a complete narrative arc with setup, escalation, climax, and resolution.
4. Use at least 2-3 clearly named major characters with distinct motivations.
5. Output only the novel body, no JSON, no markdown code fences, no metadata.
6. Every chapter must have a visible title, separated strictly as "=== Chapter X: Title ===".
7. Do not stop mid-suspense. Short and medium works must finish in one pass with a clear ending; long works must complete each assigned segment cleanly, and the final segment must reach a real resolution.`;
  }
  if (localized.language === "ja") {
    return `${localized.system}

要件：
1. 分量目安：全体で約 ${cfg.minChars}-${cfg.maxChars} 字。${chapterHint}。
2. ${plannedRule}
3. 導入・展開・山場・結末まで含む、完結した物語にすること。
4. 名前のある主要人物を 2-3 人以上入れ、性格差を出すこと。
5. 出力は小説本文のみ。JSON、コードブロック、メタ説明は禁止。
6. 各章には明確な章題を付け、章区切りは「=== 第X章 章題 ===」形式を用いること。
7. 短編・中編は一度で最後まで書き切り、長編も担当分を中途半端にせず締め、最終批は必ず結末まで到達すること。`;
  }
  if (localized.language === "ms") {
    return `${localized.system}

Keperluan:
1. Sasaran panjang: kira-kira ${cfg.minChars}-${cfg.maxChars} aksara; ${chapterHint}.
2. ${plannedRule}
3. Cerita mesti lengkap dengan pembukaan, perkembangan, klimaks dan penutup.
4. Gunakan sekurang-kurangnya 2-3 watak utama bernama dengan motivasi yang jelas.
5. Keluarkan teks novel sahaja, tanpa JSON, kod blok, atau metadata.
6. Setiap bab mesti mempunyai tajuk yang jelas dan dipisahkan secara ketat sebagai "=== Chapter X: Title ===".
7. Jangan berhenti di tengah saspens. Cerpen dan novel sederhana mesti tamat dalam satu pusingan dengan penutup jelas; segmen akhir panjang mesti sampai ke resolusi sebenar.`;
  }
  if (localized.language === "th") {
    return `${localized.system}

ข้อกำหนด:
1. ความยาวเป้าหมายประมาณ ${cfg.minChars}-${cfg.maxChars} อักขระ; ${chapterHint}
2. ${plannedRule}
3. เรื่องต้องสมบูรณ์ มีการปูเรื่อง พัฒนา จุดพีก และบทสรุป
4. ใช้ตัวละครหลักที่มีชื่ออย่างน้อย 2-3 คน และมีแรงจูงใจชัดเจน
5. ส่งออกเฉพาะเนื้อหานิยาย ห้ามมี JSON, code block หรือ metadata
6. ทุกบทต้องมีชื่อบทชัดเจน และคั่นบทด้วยรูปแบบ "=== Chapter X: Title ==="
7. ห้ามจบค้างกลางความลุ้น เรื่องสั้นและเรื่องขนาดกลางต้องจบครบในรอบเดียวพร้อมตอนจบชัดเจน ส่วนสุดท้ายของเรื่องยาวต้องถึงบทสรุปจริง`;
  }
  if (localized.language === "zh-Hant") {
    return `${localized.system}

要求：
1. **篇幅（硬性）**：全文 **${cfg.minChars}–${cfg.maxChars} 個繁體中文漢字**；${chapterHint}。${plannedRule}
2. 結構完整：有起承轉合，包含開端、發展、高潮、收束；禁止半成品爛尾，**最後必須給出明確結局**。
3. 角色鮮明：至少 2–3 個有名字的主要角色，性格立體。
4. 文筆流暢：適合線上閱讀，段落分明，對話生動。
5. 只輸出小說正文，不要輸出 JSON、markdown 程式碼塊、總結或元數據。
6. **每一章必須有醒目標題**；章節之間嚴格使用「=== 第X章 章節標題 ===」分隔（X 為阿拉伯數字，標題 2–12 字為宜）。
7. 開篇第一句或第一章標題要吸引人，貼合創意核心。
8. **禁止停在懸念半截**：短篇和中篇必須一次寫完整部作品；長篇每批必須完成本批章節推進，最後一批必須真正寫到結尾。`;
  }
  return `${localized.system}

要求：
1. **篇幅（硬性）**：全文 **${cfg.minChars}–${cfg.maxChars} 汉字**；${chapterHint}。${plannedRule}
2. 结构完整：有起承转合，包含开端、发展、高潮、收束；禁止半成品烂尾，**最后必须给出明确结局**。
3. 角色鲜明：至少 2–3 个有名字的主要角色，性格立体。
4. 文笔流畅：适合在线阅读，段落分明，对话生动。
5. 只输出小说正文，不要输出 JSON、markdown 代码块、总结或元数据。
6. **每一章必须有醒目标题**；章节之间严格使用「=== 第X章 章节标题 ===」分隔（X 为阿拉伯数字，标题 2–12 字为宜）。
7. 开篇第一句或第一章标题要吸引人，贴合创意核心。
8. **禁止停在悬念半截**：短篇和中篇必须一次写完整部作品；长篇每批必须完成本批章节推进，最后一批必须真正写到结尾。`;
}

/** 单次小说 LLM 调用超时（流式/非流式、网关 x-openclaw-timeout-ms 对齐）。 */
export function novelLlmTimeoutMs(tier?: NovelLengthTier): number {
  const t = tier ?? "medium";
  if (t === "children") return PRODUCT.novel.llmTimeoutMs.short;
  return PRODUCT.novel.llmTimeoutMs[t];
}

/** 儿童短篇略低温度，利于连贯叙事、减少乱跳 */
export function novelLlmTemperature(tier?: NovelLengthTier): number {
  if (tier === "children") return CHILDREN_NOVEL_LLM_TEMPERATURE;
  return 0.85;
}

export function novelLlmMaxOutputTokens(tier?: NovelLengthTier, opts?: NovelLengthOptions): number {
  const t = tier ?? "medium";
  const base = PRODUCT.novel.maxOutputTokens;
  const cap = novelMaxChars(t, opts);
  const estimated = Math.ceil(cap * 1.35) + 512;
  if (t === "short" || t === "children") return Math.min(base, Math.max(2_048, estimated));
  if (t === "medium") return Math.min(base, Math.max(8_192, estimated));
  return base;
}

export { novelMaxChars };

export function novelMinAcceptChars(tier?: NovelLengthTier, opts?: NovelLengthOptions): number {
  const t = tier ?? "medium";
  const cfg = novelLengthConfig(t, opts);
  if (t === "children") return cfg.minChars;
  const key = t;
  const floor = PRODUCT.novel.minAcceptCharsFloor[key];
  const ratio = PRODUCT.novel.minAcceptCharsRatio[key];
  return Math.max(200, Math.max(floor, Math.floor(cfg.minChars * ratio)));
}

export function buildNovelUserMessage(
  prompt: string,
  title?: string,
  lengthTier?: NovelLengthTier,
  /** 含 Creative Brief 扩写块时使用完整上下文 */
  pipelinePrompt?: string,
  lengthOpts?: NovelLengthOptions,
): string {
  const tier = lengthTier ?? "medium";
  const cfg = novelLengthConfig(tier, lengthOpts);
  const t = title?.trim();
  const creativeBlock = (pipelinePrompt ?? prompt).trim();
  const localized = buildLocalizedNovelPromptParts(prompt);
  if (tier === "children") {
    return buildChildrenNovelUserMessage(
      creativeBlock,
      t,
      parseChildrenTargetAge(lengthOpts?.childrenTargetAge),
    );
  }
  if (localized.language === "en") {
    return `${localized.userPrefix}\n\n${creativeBlock}\n\n${
      t ? localized.titleHint(t) : ""
    }\n\nTarget length: about ${cfg.minChars}-${cfg.maxChars} characters.`;
  }
  if (localized.language === "ja") {
    return `${localized.userPrefix}\n\n${creativeBlock}\n\n${
      t ? localized.titleHint(t) : ""
    }\n\n目安の分量：およそ ${cfg.minChars}-${cfg.maxChars} 字。`;
  }
  if (localized.language === "ms") {
    return `${localized.userPrefix}\n\n${creativeBlock}\n\n${
      t ? localized.titleHint(t) : ""
    }\n\nSasaran panjang: kira-kira ${cfg.minChars}-${cfg.maxChars} aksara.`;
  }
  if (localized.language === "th") {
    return `${localized.userPrefix}\n\n${creativeBlock}\n\n${
      t ? localized.titleHint(t) : ""
    }\n\nความยาวเป้าหมาย: ประมาณ ${cfg.minChars}-${cfg.maxChars} อักขระ`;
  }
  if (localized.language === "zh-Hant") {
    return `${localized.userPrefix}\n\n${creativeBlock}\n\n${
      t ? localized.titleHint(t) : ""
    }\n\n目標篇幅：${cfg.minChars}–${cfg.maxChars} 個繁體中文漢字，多章、每章帶標題。`;
  }
  return `请根据以下创意写完整${cfg.label}小说正文（目标 ${cfg.minChars}–${cfg.maxChars} 字，多章、每章带标题）。必须写完主线、情节紧凑、最后有明确结局，不能只写开头或停在悬念处：\n\n${creativeBlock}\n\n${
    t ? localized.titleHint(t) : ""
  }`;
}

export { parseNovelLengthTier, type NovelLengthTier } from "@/lib/novel-length";
export { resolveNovelLengthTier } from "@/lib/novel-length";
