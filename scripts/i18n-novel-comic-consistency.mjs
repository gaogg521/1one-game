/** Novel completeness / consistency + comic panel consistency — merge via i18n-bulk-catalog.mjs */

export const novelCompletenessZhHans = {
  tooShort: "正文长度明显不足，仍像半成品",
  planIncomplete: "提纲规划 {planned} 章，正文仅写完 {written} 章",
  shortTooFewChapters: "短篇章节过少，尚未形成完整起承转合",
  mediumTooFewChapters: "中篇章节过少，尚未形成完整主线",
  unfinishedEnding: "结尾仍停在悬念或下一章提示，没有真正收束",
  tailTooShort: "结尾过短，像未完成截断",
  longTooFewChapters: "长篇章节过少，尚未写到收束阶段",
  noEndingSignal: "结尾缺少明确收束信号，主线可能未完结",
  okComplete: "结构完整且已收束到结尾",
};

export const novelCompletenessEn = {
  tooShort: "Body is too short and still reads like a draft",
  planIncomplete: "Outline plans {planned} chapters but the body only has {written}",
  shortTooFewChapters: "Too few chapters for a short story — setup, conflict, and resolution are incomplete",
  mediumTooFewChapters: "Too few chapters for a medium-length story — the main arc is incomplete",
  unfinishedEnding: "Ending still teases a cliffhanger or next chapter instead of resolving",
  tailTooShort: "Ending is too short — looks like an unfinished cut-off",
  longTooFewChapters: "Too few chapters for a long novel — not yet in the closing phase",
  noEndingSignal: "Ending lacks a clear wrap-up signal — the main plot may be unfinished",
  okComplete: "Structure is complete and the story reaches a proper ending",
};

export const novelConsistencyZhHans = {
  noChapterMarkers: "本段未解析到「=== 第X章 标题 ===」章节标记",
  duplicateChapterNum: "重复章节号：{nums}",
  unexpectedChapter: "出现计划外章节第{num}章",
  chapterRewind: "第{num}章号不应 ≤ 已写最大章号 {prevMax}",
  missingPlannedChapter: "缺少计划章节第{num}章《{title}》",
  characterAbsentInSegment: "本段未出现主要角色「{name}」（前文已登场）",
};

export const novelConsistencyEn = {
  noChapterMarkers: 'This segment has no "=== Chapter X Title ===" markers',
  duplicateChapterNum: "Duplicate chapter numbers: {nums}",
  unexpectedChapter: "Unexpected chapter {num} outside the plan",
  chapterRewind: "Chapter {num} must be greater than the previous max chapter {prevMax}",
  missingPlannedChapter: 'Missing planned chapter {num}: "{title}"',
  characterAbsentInSegment: 'Main character "{name}" is missing in this segment (already appeared earlier)',
};

export const comicConsistencyZhHans = {
  unknownCharacterId: "第 {scene} 格引用了未知角色 id：{id}",
  unknownLocationId: "第 {scene} 格引用了未知场景 id：{id}",
  tabooKeywordInPanel: "第 {scene} 格文案含禁忌词「{taboo}」",
  leadMissingOpening: "开篇格建议出现主角 {name}（{id}）",
  missingCaption: "第 {scene} 格缺少叠字文案（漫画须图文搭配，不能纯画面）",
};

export const comicConsistencyEn = {
  unknownCharacterId: "Panel {scene} references unknown character id: {id}",
  unknownLocationId: "Panel {scene} references unknown location id: {id}",
  tabooKeywordInPanel: 'Panel {scene} text contains taboo keyword "{taboo}"',
  leadMissingOpening: "Opening panel should feature lead {name} ({id})",
  missingCaption: "Panel {scene} is missing overlay text (comics need words + art, not art alone)",
};

export const progressNovelConsistencyExtraZhHans = {
  segmentEmpty: "第 {index} 批未返回正文",
};

export const progressNovelConsistencyExtraEn = {
  segmentEmpty: "Batch {index} returned no body text",
};

function hantify(obj) {
  const map = {
    正文: "正文",
    长度: "長度",
    明显: "明顯",
    不足: "不足",
    仍像: "仍像",
    半成品: "半成品",
    提纲: "提綱",
    规划: "規劃",
    章: "章",
    仅: "僅",
    写完: "寫完",
    短篇: "短篇",
    章节: "章節",
    过少: "過少",
    尚未: "尚未",
    形成: "形成",
    完整: "完整",
    起承转合: "起承轉合",
    篇章: "篇章",
    主线: "主線",
    结尾: "結尾",
    停在: "停在",
    悬念: "懸念",
    下一章: "下一章",
    提示: "提示",
    没有: "沒有",
    真正: "真正",
    收束: "收束",
    过短: "過短",
    像: "像",
    未完成: "未完成",
    截断: "截斷",
    长篇: "長篇",
    写到: "寫到",
    阶段: "階段",
    缺少: "缺少",
    明确: "明確",
    信号: "信號",
    可能: "可能",
    未完结: "未完結",
    结构: "結構",
    且: "且",
    已: "已",
    到: "到",
    本段: "本段",
    未解析: "未解析",
    标记: "標記",
    重复: "重複",
    章节号: "章節號",
    出现: "出現",
    计划外: "計劃外",
    号不应: "號不應",
    已写: "已寫",
    最大: "最大",
    缺少计划: "缺少計劃",
    未出现: "未出現",
    主要: "主要",
    角色: "角色",
    前文: "前文",
    已登场: "已登場",
    格引用: "格引用",
    未知: "未知",
    场景: "場景",
    文案: "文案",
    含: "含",
    禁忌词: "禁忌詞",
    开篇: "開篇",
    建议: "建議",
    主角: "主角",
    叠字: "疊字",
    漫画: "漫畫",
    须: "須",
    图文: "圖文",
    搭配: "搭配",
    不能: "不能",
    纯画面: "純畫面",
    批: "批",
    返回: "返回",
  };
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    let s = v;
    for (const [from, to] of Object.entries(map)) {
      s = s.replaceAll(from, to);
    }
    out[k] = s;
  }
  return out;
}

const msCompleteness = {
  tooShort: "Isi terlalu pendek dan masih terasa seperti draf",
  planIncomplete: "Rangka merancang {planned} bab tetapi badan hanya ada {written}",
  shortTooFewChapters: "Bab terlalu sedikit untuk cerita pendek — struktur belum lengkap",
  mediumTooFewChapters: "Bab terlalu sedikit untuk cerita sederhana — garis utama belum lengkap",
  unfinishedEnding: "Penutup masih menggantung atau menunjuk bab seterusnya",
  tailTooShort: "Penutup terlalu pendek — seperti terpotong separuh jalan",
  longTooFewChapters: "Bab terlalu sedikit untuk novel panjang — belum sampai fasa penutup",
  noEndingSignal: "Penutup tiada isyarat penyelesaian yang jelas",
  okComplete: "Struktur lengkap dan cerita sampai penutup yang wajar",
};

const msConsistency = {
  noChapterMarkers: 'Segmen ini tiada penanda "=== Bab X Tajuk ==="',
  duplicateChapterNum: "Nombor bab berganda: {nums}",
  unexpectedChapter: "Bab {num} di luar rancangan",
  chapterRewind: "Bab {num} mesti lebih besar daripada bab maksimum sebelumnya {prevMax}",
  missingPlannedChapter: 'Bab dirancang {num} hilang: "{title}"',
  characterAbsentInSegment: 'Watak utama "{name}" tiada dalam segmen ini (sudah muncul sebelumnya)',
};

const msComic = {
  unknownCharacterId: "Panel {scene} merujuk id watak tidak dikenali: {id}",
  unknownLocationId: "Panel {scene} merujuk id lokasi tidak dikenali: {id}",
  tabooKeywordInPanel: 'Panel {scene} mengandungi kata larangan "{taboo}"',
  leadMissingOpening: "Panel pembuka patut memaparkan watak utama {name} ({id})",
  missingCaption: "Panel {scene} tiada teks overlay (komik perlukan teks + gambar)",
};

const thCompleteness = {
  tooShort: "เนื้อหาสั้นเกินไปและยังเหมือนฉบับร่าง",
  planIncomplete: "โครงร่างวาง {planned} บท แต่เนื้อหามีเพียง {written} บท",
  shortTooFewChapters: "บทน้อยเกินไปสำหรับเรื่องสั้น — โครงสร้างยังไม่ครบ",
  mediumTooFewChapters: "บทน้อยเกินไปสำหรับเรื่องปานกลาง — เส้นเรื่องหลักยังไม่ครบ",
  unfinishedEnding: "ตอนจบยังค้างความลุ้นหรือชี้ไปบทถัดไป",
  tailTooShort: "ตอนจบสั้นเกินไป — เหมือนถูกตัดกลางคัน",
  longTooFewChapters: "บทน้อยเกินไปสำหรับนิยายยาว — ยังไม่ถึงช่วงปิดเรื่อง",
  noEndingSignal: "ตอนจบไม่มีสัญญาณปิดเรื่องที่ชัดเจน",
  okComplete: "โครงสร้างครบและจบเรื่องอย่างเหมาะสม",
};

const thConsistency = {
  noChapterMarkers: 'ส่วนนี้ไม่มีเครื่องหมาย "=== บท X ชื่อ ==="',
  duplicateChapterNum: "เลขบทซ้ำ: {nums}",
  unexpectedChapter: "บท {num} อยู่นอกแผน",
  chapterRewind: "บท {num} ต้องมากกว่าบทสูงสุดก่อนหน้า {prevMax}",
  missingPlannedChapter: 'ขาดบทตามแผน {num}: "{title}"',
  characterAbsentInSegment: 'ตัวละครหลัก "{name}" ไม่ปรากฏในส่วนนี้ (เคยปรากฏก่อนหน้า)',
};

const thComic = {
  unknownCharacterId: "ช่อง {scene} อ้าง id ตัวละครที่ไม่รู้จัก: {id}",
  unknownLocationId: "ช่อง {scene} อ้าง id ฉากที่ไม่รู้จัก: {id}",
  tabooKeywordInPanel: 'ช่อง {scene} มีคำต้องห้าม "{taboo}"',
  leadMissingOpening: "ช่องเปิดควรมีตัวเอก {name} ({id})",
  missingCaption: "ช่อง {scene} ไม่มีข้อความซ้อน (การ์ตูนต้องมีทั้งคำและภาพ)",
};

export function mergeNovelComicConsistency(locale) {
  const byLocale = {
    "zh-Hans": {
      novelCompleteness: novelCompletenessZhHans,
      novelConsistency: novelConsistencyZhHans,
      comicConsistency: comicConsistencyZhHans,
      progressNovelExtra: progressNovelConsistencyExtraZhHans,
    },
    "zh-Hant": {
      novelCompleteness: hantify(novelCompletenessZhHans),
      novelConsistency: hantify(novelConsistencyZhHans),
      comicConsistency: hantify(comicConsistencyZhHans),
      progressNovelExtra: hantify(progressNovelConsistencyExtraZhHans),
    },
    en: {
      novelCompleteness: novelCompletenessEn,
      novelConsistency: novelConsistencyEn,
      comicConsistency: comicConsistencyEn,
      progressNovelExtra: progressNovelConsistencyExtraEn,
    },
    ms: {
      novelCompleteness: msCompleteness,
      novelConsistency: msConsistency,
      comicConsistency: msComic,
      progressNovelExtra: { segmentEmpty: "Kelompok {index} tidak mengembalikan teks" },
    },
    th: {
      novelCompleteness: thCompleteness,
      novelConsistency: thConsistency,
      comicConsistency: thComic,
      progressNovelExtra: { segmentEmpty: "ชุดที่ {index} ไม่ได้ส่งเนื้อหากลับมา" },
    },
  };
  return byLocale[locale] ?? byLocale.en;
}
