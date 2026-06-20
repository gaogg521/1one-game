import type { AppLocale } from "@/i18n/routing";
import { untitledNovelLabel } from "@/lib/i18n/chapter-labels";
import type { BriefInputLocale } from "@/lib/creative-brief/detect-input-locale";
import { resolveNovelOutputLocale } from "@/lib/creative-brief/detect-input-locale";
import { llmNovelJson } from "@/lib/llm";
import { buildLongNovelBibleSystemPrompt } from "@/lib/novel-locale-prompts";
import type { LongNovelSegmentPlan } from "@/lib/novel-long-config";
import { novelLengthConfig, type NovelLengthTier } from "@/lib/novel-length";
import {
  buildNovelBibleJsonSchema,
  type NovelBible,
  parseNovelBible,
} from "@/lib/novel-long-pipeline-types";
import { estimateLongNovelChapterCount, LONG_NOVEL_PRODUCT } from "@/lib/novel-long-config";

export function formatNovelBibleForPrompt(bible: NovelBible, locale: BriefInputLocale = "zh"): string {
  const charLines = (fmt: (c: (typeof bible.characters)[0]) => string) =>
    bible.characters.map(fmt).join("\n");
  const taboos = bible.taboos?.filter(Boolean) ?? [];

  switch (locale) {
    case "en":
      return `[Title] ${bible.title}
[World] ${bible.worldSetting}
${bible.tone ? `[Tone] ${bible.tone}\n` : ""}[Characters]
${charLines((c) => `- ${c.name} (${c.role}): ${c.traits}${c.relationships ? `; ${c.relationships}` : ""}`)}
[Core conflict] ${bible.coreConflict}
[Ending direction] ${bible.endingDirection}${taboos.length ? `\n[Taboos] ${taboos.join("; ")}` : ""}`;
    case "ja":
      return `【タイトル】${bible.title}
【世界観】${bible.worldSetting}
${bible.tone ? `【トーン】${bible.tone}\n` : ""}【主要人物】
${charLines((c) => `- ${c.name}（${c.role}）：${c.traits}${c.relationships ? `；${c.relationships}` : ""}`)}
【核心矛盾】${bible.coreConflict}
【結末の方向】${bible.endingDirection}${taboos.length ? `\n【禁忌】${taboos.join("；")}` : ""}`;
    case "ms":
      return `[Tajuk] ${bible.title}
[Dunia] ${bible.worldSetting}
${bible.tone ? `[Nada] ${bible.tone}\n` : ""}[Watak]
${charLines((c) => `- ${c.name} (${c.role}): ${c.traits}${c.relationships ? `; ${c.relationships}` : ""}`)}
[Konflik teras] ${bible.coreConflict}
[Arah penutup] ${bible.endingDirection}${taboos.length ? `\n[Tabu] ${taboos.join("; ")}` : ""}`;
    case "th":
      return `[ชื่อเรื่อง] ${bible.title}
[โลก] ${bible.worldSetting}
${bible.tone ? `[โทน] ${bible.tone}\n` : ""}[ตัวละคร]
${charLines((c) => `- ${c.name} (${c.role}): ${c.traits}${c.relationships ? `; ${c.relationships}` : ""}`)}
[ความขัดแย้งหลัก] ${bible.coreConflict}
[ทิศทางตอนจบ] ${bible.endingDirection}${taboos.length ? `\n[ข้อห้าม] ${taboos.join("; ")}` : ""}`;
    case "zh-Hant":
      return `【書名】${bible.title}
【世界觀】${bible.worldSetting}
${bible.tone ? `【基調】${bible.tone}\n` : ""}【主要人物】
${charLines((c) => `- ${c.name}（${c.role}）：${c.traits}${c.relationships ? `；${c.relationships}` : ""}`)}
【核心矛盾】${bible.coreConflict}
【結局方向】${bible.endingDirection}${taboos.length ? `\n【禁忌】${taboos.join("；")}` : ""}`;
    default:
      return `【书名】${bible.title}
【世界观】${bible.worldSetting}
${bible.tone ? `【基调】${bible.tone}\n` : ""}【主要人物】
${charLines((c) => `- ${c.name}（${c.role}）：${c.traits}${c.relationships ? `；${c.relationships}` : ""}`)}
【核心矛盾】${bible.coreConflict}
【结局方向】${bible.endingDirection}${taboos.length ? `\n【禁忌】${taboos.join("；")}` : ""}`;
  }
}

export function buildNovelBibleUserMessage(
  prompt: string,
  title: string | undefined,
  plan: LongNovelSegmentPlan,
  locale: BriefInputLocale = "zh",
): string {
  const cfg = novelLengthConfig("long");
  const chapterCount = estimateLongNovelChapterCount(plan);
  const concept = prompt.trim();
  const titleLine = title?.trim();

  switch (locale) {
    case "en":
      return `User concept: ${concept}
${titleLine ? `Suggested title: ${titleLine}` : ""}

Target length: ${cfg.minChars}–${cfg.maxChars} characters, about ${chapterCount} chapters across ${plan.totalSegments} writing batches.
Output bible JSON (title, worldSetting, at least 3 characters, coreConflict, endingDirection). All strings in English.`;
    case "ja":
      return `ユーザー創意：${concept}
${titleLine ? `推奨タイトル：${titleLine}` : ""}

目標分量：${cfg.minChars}–${cfg.maxChars} 字、約 ${chapterCount} 章、${plan.totalSegments} 批で完成。
設定聖書 JSON を日本語で出力（title, worldSetting, characters 3人以上, coreConflict, endingDirection）。`;
    case "ms":
      return `Idea pengguna: ${concept}
${titleLine ? `Tajuk dicadangkan: ${titleLine}` : ""}

Panjang sasaran: ${cfg.minChars}–${cfg.maxChars} aksara, ~${chapterCount} bab, ${plan.totalSegments} batch.
Keluarkan bible JSON dalam Bahasa Melayu (title, worldSetting, sekurang-kurangnya 3 watak, coreConflict, endingDirection).`;
    case "th":
      return `แนวคิด: ${concept}
${titleLine ? `ชื่อที่แนะนำ: ${titleLine}` : ""}

ความยาวเป้าหมาย: ${cfg.minChars}–${cfg.maxChars} อักขระ ~${chapterCount} บท ${plan.totalSegments} ชุด
ส่งออก bible JSON เป็นภาษาไทย (title, worldSetting, ตัวละครอย่างน้อย 3, coreConflict, endingDirection)`;
    case "zh-Hant":
      return `用戶創意：${concept}
${titleLine ? `建議書名：${titleLine}` : ""}

目標篇幅：${cfg.minChars}–${cfg.maxChars} 字，約 ${chapterCount} 章，分 ${plan.totalSegments} 次寫作批次完成。
請輸出設定聖經 JSON（含 title、worldSetting、characters 至少 3 人、coreConflict、endingDirection），全文繁體中文。`;
    default:
      return `用户创意：${concept}
${titleLine ? `建议书名：${titleLine}` : ""}

目标篇幅：${cfg.minChars}–${cfg.maxChars} 字，约 ${chapterCount} 章，分 ${plan.totalSegments} 次写作批次完成。
请输出设定圣经 JSON（含 title、worldSetting、characters 至少 3 人、coreConflict、endingDirection）。`;
  }
}

export function fallbackNovelBible(
  prompt: string,
  title: string | undefined,
  plan: LongNovelSegmentPlan,
  uiLocale: AppLocale = "zh-Hans",
): NovelBible {
  const outputLocale = resolveNovelOutputLocale(prompt);
  const t = title?.trim() || untitledNovelLabel(uiLocale);
  const concept = prompt.trim().slice(0, 200);
  const conflict = prompt.trim().slice(0, 400);

  switch (outputLocale) {
    case "en":
      return {
        title: t,
        worldSetting: `A fictional world derived from the user's concept: ${concept}`,
        tone: "Fast-paced serialised fiction",
        characters: [
          { name: "Protagonist", role: "Hero", traits: "Resilient, strong character arc" },
          { name: "Antagonist", role: "Villain", traits: "Drives the core conflict" },
          { name: "Ally", role: "Companion", traits: "Helps the protagonist advance the main plot" },
        ],
        coreConflict: conflict,
        endingDirection: `Resolve the main storyline within ~${plan.targetTotalChars} characters, echoing the original concept.`,
        taboos: ["No world-reset endings", "No unexplained character death/resurrection"],
      };
    case "ja":
      return {
        title: t,
        worldSetting: `ユーザーの創意に基づく架空世界：${concept}`,
        tone: "テンポの速い連載小説",
        characters: [
          { name: "主人公", role: "ヒーロー", traits: "芯が強く、成長弧がある" },
          { name: "敵役", role: "ヴィラン", traits: "核心の対立を生み出す" },
          { name: "仲間", role: "相棒", traits: "主人公の物語を前進させる" },
        ],
        coreConflict: conflict,
        endingDirection: `約${plan.targetTotalChars}文字以内にメインストーリーを収束させる。`,
        taboos: ["世界観リセット禁止", "根拠なき主要キャラの死亡・復活禁止"],
      };
    case "ms":
      return {
        title: t,
        worldSetting: `Dunia rekaan berdasarkan idea pengguna: ${concept}`,
        tone: "Fiksyen bersiri pantas",
        characters: [
          { name: "Protagonis", role: "Wira", traits: "Tabah, perkembangan watak yang kuat" },
          { name: "Antagonis", role: "Penjahat", traits: "Mencipta konflik teras" },
          { name: "Rakan", role: "Sahabat", traits: "Membantu protagonis maju dalam plot utama" },
        ],
        coreConflict: conflict,
        endingDirection: `Selesaikan jalan cerita utama dalam ~${plan.targetTotalChars} aksara.`,
        taboos: ["Tiada pengakhiran set semula dunia", "Tiada kematian/kebangkitan watak tanpa sebab"],
      };
    case "th":
      return {
        title: t,
        worldSetting: `โลกสมมุติที่ได้จากแนวคิดของผู้ใช้: ${concept}`,
        tone: "นิยายซีรีส์ดำเนินเรื่องเร็ว",
        characters: [
          { name: "ตัวเอก", role: "ผู้นำ", traits: "เข้มแข็ง มีการเติบโตของตัวละคร" },
          { name: "ผู้ร้าย", role: "ตัวร้าย", traits: "สร้างความขัดแย้งหลัก" },
          { name: "เพื่อน", role: "พันธมิตร", traits: "ช่วยตัวเอกขับเคลื่อนเรื่องราวหลัก" },
        ],
        coreConflict: conflict,
        endingDirection: `แก้ไขเรื่องราวหลักภายใน ~${plan.targetTotalChars} ตัวอักษร`,
        taboos: ["ห้ามรีเซ็ตโลก", "ห้ามตัวละครหลักตายหรือฟื้นคืนชีพโดยไม่มีเหตุผล"],
      };
    case "zh-Hant":
      return {
        title: t,
        worldSetting: `故事發生於與用戶創意相關的虛構世界：${concept}`,
        tone: "網路連載、節奏明快",
        characters: [
          { name: "主角", role: "主人公", traits: "堅韌、有成長弧光" },
          { name: "對手", role: "對立面", traits: "製造核心衝突" },
          { name: "同伴", role: "盟友", traits: "協助主角推進主線" },
        ],
        coreConflict: conflict,
        endingDirection: `在約 ${plan.targetTotalChars} 字內完成主線收束，呼應創意核心。`,
        taboos: ["禁止重啟世界觀", "禁止主要角色無故改名或死亡復活（無鋪墊）"],
      };
    default:
      return {
        title: t,
        worldSetting: `故事发生于与用户创意相关的虚构世界：${concept}`,
        tone: "网络连载、节奏明快",
        characters: [
          { name: "主角", role: "主人公", traits: "坚韧、有成长弧光" },
          { name: "对手", role: "对立面", traits: "制造核心冲突" },
          { name: "同伴", role: "盟友", traits: "协助主角推进主线" },
        ],
        coreConflict: conflict,
        endingDirection: `在约 ${plan.targetTotalChars} 字内完成主线收束，呼应创意核心。`,
        taboos: ["禁止重启世界观", "禁止主要角色无故改名或死亡复活（无铺垫）"],
      };
  }
}

export async function fetchNovelBible(
  model: string,
  prompt: string,
  title: string | undefined,
  plan: LongNovelSegmentPlan,
  lengthTier: NovelLengthTier,
  uiLocale: AppLocale = "zh-Hans",
): Promise<NovelBible> {
  const locale = resolveNovelOutputLocale(prompt);
  const result = await llmNovelJson(
    {
      model,
      system: buildLongNovelBibleSystemPrompt(locale),
      user: buildNovelBibleUserMessage(prompt, title, plan, locale),
      jsonSchema: buildNovelBibleJsonSchema(),
      temperature: 0.65,
      mode: "json_schema",
      timeoutMs: LONG_NOVEL_PRODUCT.bibleTimeoutMs,
    },
    lengthTier,
  );
  if (result.ok) {
    const parsed = parseNovelBible(result.raw);
    if (parsed) {
      if (title?.trim() && parsed.title.length < 2) parsed.title = title.trim();
      return parsed;
    }
  }
  return fallbackNovelBible(prompt, title, plan, uiLocale);
}
