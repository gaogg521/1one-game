/**
 * Bulk i18n catalog merge — genre tags, children age, reader/comic UI, SSE progress, API errors.
 * Run: node scripts/i18n-bulk-catalog.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { comicStylesByLocale, createFlowByLocale } from "./i18n-create-flow-comic.mjs";
import { mergeProgressLongComic } from "./i18n-progress-long-comic.mjs";
import { adminChartsByLocale, adminPageByLocale, superAdminByLocale } from "./i18n-admin.mjs";
import { mergePlayGameExtras } from "./i18n-play-game.mjs";
import { novelCreatePageByLocale } from "./i18n-novel-create-page.mjs";
import { uiPatchByLocale } from "./i18n-ui-patches.mjs";
import { apiErrorsByLocale } from "./i18n-api-errors.mjs";
import { createStudioNarrativeByLocale } from "./i18n-create-studio-narrative.mjs";
import { comicPanelServerByLocale } from "./i18n-comic-panel-server.mjs";
import { ingestWarningsByLocale } from "./i18n-ingest-warnings.mjs";
import { assetGenByLocale } from "./i18n-asset-gen.mjs";
import { mergeNovelComicConsistency } from "./i18n-novel-comic-consistency.mjs";
import { mergeNovelChapterDisplay } from "./i18n-novel-chapter-display.mjs";
import { mergeUiMisc } from "./i18n-ui-misc.mjs";

const root = path.resolve(import.meta.dirname, "..");
const locales = ["zh-Hans", "zh-Hant", "en", "ms", "th"];

const genreTagsZhHans = {
  transmigration: { label: "穿越", desc: "古今/异世穿梭、身份错位、改写命运" },
  fantasy: { label: "玄幻", desc: "异界大陆、升级体系、血脉与机缘" },
  xianxia: { label: "仙侠", desc: "修仙问道、宗门灵根、渡劫飞升" },
  wuxia: { label: "武侠", desc: "江湖门派、侠义恩仇、武功秘籍" },
  historical: { label: "历史", desc: "王朝权谋、考据架空、名将风云" },
  urban: { label: "都市", desc: "现代职场、豪门商战、逆袭打脸" },
  romance: { label: "言情", desc: "甜宠虐恋、婚恋成长、情感拉扯" },
  scifi: { label: "科幻", desc: "未来科技、星际末世、AI 与机甲" },
  mystery: { label: "悬疑", desc: "推理刑侦、密室真相、层层反转" },
  horror: { label: "灵异", desc: "诡秘怪谈、生存惊悚、未知禁忌" },
  children: { label: "儿童短篇", desc: "童真童趣、寓教于乐、浅语暖心" },
};

const genreTagsEn = {
  transmigration: { label: "Transmigration", desc: "Time travel, identity swaps, rewriting fate" },
  fantasy: { label: "Fantasy", desc: "Otherworld realms, progression systems, bloodlines and destiny" },
  xianxia: { label: "Xianxia", desc: "Cultivation, sects, spiritual roots, ascension" },
  wuxia: { label: "Wuxia", desc: "Jianghu sects, honor and vendetta, martial arts manuals" },
  historical: { label: "Historical", desc: "Dynastic politics, alternate history, legendary generals" },
  urban: { label: "Urban", desc: "Modern city life, business wars, comeback arcs" },
  romance: { label: "Romance", desc: "Sweetness and angst, relationships, emotional tension" },
  scifi: { label: "Sci-Fi", desc: "Future tech, space opera, apocalypse, AI and mecha" },
  mystery: { label: "Mystery", desc: "Detective work, locked rooms, layered twists" },
  horror: { label: "Supernatural", desc: "Eerie folklore, survival horror, forbidden unknowns" },
  children: { label: "Children", desc: "Playful, gentle, educational, age-appropriate warmth" },
};

const childrenAgeZhHans = {
  infant_0_3: {
    label: "0-3 岁",
    stage: "婴幼儿启蒙",
    charRangeLabel: "90-110 字",
    features: "短句叠词、极简画面、哄睡磨耳朵",
  },
  kindergarten_3_6: {
    label: "3-6 岁",
    stage: "幼儿园",
    charRangeLabel: "100-250 字",
    features: "童趣可爱、角色简单、浅白道理",
  },
  primary_6_8: {
    label: "6-8 岁",
    stage: "1-2 年级",
    charRangeLabel: "300-500 字",
    features: "情节完整、适量好词、低年级阅读",
  },
  grade_9: {
    label: "9 岁",
    stage: "3 年级",
    charRangeLabel: "500-700 字",
    features: "人物关系、成语典故、独立阅读",
  },
  grade_10: {
    label: "10 岁",
    stage: "4 年级",
    charRangeLabel: "700-900 字",
    features: "情节饱满、有深度、贴合课内素养",
  },
};

const childrenAgeEn = {
  infant_0_3: {
    label: "0–3 years",
    stage: "Toddler",
    charRangeLabel: "90–110 chars",
    features: "Short rhythmic lines, simple visuals, bedtime listening",
  },
  kindergarten_3_6: {
    label: "3–6 years",
    stage: "Preschool",
    charRangeLabel: "100–250 chars",
    features: "Playful tone, simple characters, gentle lessons",
  },
  primary_6_8: {
    label: "6–8 years",
    stage: "Grades 1–2",
    charRangeLabel: "300–500 chars",
    features: "Complete plot, age-appropriate vocabulary",
  },
  grade_9: {
    label: "9 years",
    stage: "Grade 3",
    charRangeLabel: "500–700 chars",
    features: "Richer relationships, idioms and references",
  },
  grade_10: {
    label: "10 years",
    stage: "Grade 4",
    charRangeLabel: "700–900 chars",
    features: "Full plot depth, literacy-aligned themes",
  },
};

const readerThemesZhHans = { paper: "护眼", night: "夜间", green: "绿豆" };
const readerThemesEn = { paper: "Easy on eyes", night: "Night", green: "Soft green" };

const novelReaderZhHans = {
  tocMobile: "目录 · {count}",
  tocTitle: "章节目录",
  tocDesktop: "目录 · {count} 章",
  readingBg: "阅读背景",
  listen: "听书",
  pauseListen: "暂停朗读",
  resumeListen: "继续朗读",
  startListen: "从当前章开始听",
  chapterHeading: "第{num}章 {title}",
};

const novelReaderEn = {
  tocMobile: "Contents · {count}",
  tocTitle: "Table of contents",
  tocDesktop: "Contents · {count} chapters",
  readingBg: "Reading theme",
  listen: "Listen",
  pauseListen: "Pause narration",
  resumeListen: "Resume narration",
  startListen: "Listen from current chapter",
  chapterHeading: "Ch. {num} {title}",
};

const comicOptionsZhHans = {
  styleLabel: "漫画画风",
  childrenStyleLocked:
    "类型为儿童短篇时，漫画固定为现代 Q 版小人书五格分镜（上小下大、中通栏、圆角粗线框），画风已锁定。",
  readModeSegment: "段落精读（快）",
  readModeFull: "全书精读（慢·更贴剧情）",
  scopeLabelChildren: "改编模块",
  scopeLabelNovel: "改编范围",
  modeAllChildren: "全书",
  modeAllNovel: "全书",
  modeSingle: "单章",
  modeRange: "章范围",
  chapterOption: "第{num}章 · {title}",
  chapterShort: "第{num}章",
  moduleLabel: "模块{num}",
  moduleRange: "{from}–{to}",
  chapterRange: "第{from}–{to}章",
  rangeTo: "至",
  willAdapt: "将一次改编 {label}",
  childrenHint: "画漫画分镜默认已选「儿童故事」正文；创意解读仅供阅读，一般不必改编进格子里。",
  rosterHide: "收起人设存档",
  rosterShow: "人设存档（可选，全片统一外貌）",
  charName: "角色名",
  charAppearance: "外貌（脸型发型身高）",
  charOutfit: "固定服饰",
  addCharacter: "+ 添加角色",
  childrenStoryTitle: "儿童故事",
};

const comicOptionsEn = {
  styleLabel: "Comic style",
  childrenStyleLocked:
    "For children's short stories, the comic uses a locked modern Q-version picture-book layout (five panels, rounded thick borders).",
  readModeSegment: "Segment read (fast)",
  readModeFull: "Full-book read (slow, closer to plot)",
  scopeLabelChildren: "Adapt modules",
  scopeLabelNovel: "Adaptation scope",
  modeAllChildren: "Full book",
  modeAllNovel: "Full book",
  modeSingle: "Single chapter",
  modeRange: "Chapter range",
  chapterOption: "Ch. {num} · {title}",
  chapterShort: "Ch. {num}",
  moduleLabel: "Module {num}",
  moduleRange: "{from}–{to}",
  chapterRange: "Ch. {from}–{to}",
  rangeTo: "to",
  willAdapt: "This run adapts {label}",
  childrenHint:
    "Storyboard generation defaults to the children's story body; the creative interpretation is for reading only.",
  rosterHide: "Hide character roster",
  rosterShow: "Character roster (optional, consistent looks)",
  charName: "Character name",
  charAppearance: "Appearance (face, hair, height)",
  charOutfit: "Default outfit",
  addCharacter: "+ Add character",
  childrenStoryTitle: "Children's story",
};

const progressNovelZhHans = {
  bibleStart: "正在整理世界观与人物设定…",
  bibleReady: "设定完成：《{title}》，{count} 位主要角色",
  chapterPlanStart: "正在按篇幅规划章节目录…",
  chapterPlanReady: "章提纲完成，共 {count} 章，开始按提纲写作…",
  checkpointCreated: "已创建生成草稿，每批写完自动保存",
  resumeStart: "从断点续写长篇…",
  batchSaved: "第 {index} 批已保存，可断点续写",
  completionPass: "正文正在自动补完结尾：{reason}",
  completenessFail: "正文未通过完整性校验：{reason}",
  synopsisStart: "正在撰写剧情简介…",
  coverPending: "正文已完成，封面将在阅读页后台生成",
  generateFailed: "小说生成失败：模型未返回足够内容或全部出错，可尝试改选中篇/短篇或稍后重试",
  processError: "生成过程异常",
  rateLimited: "生成次数过多，请稍后再试",
  startLong: "长篇流水线：设定圣经 → 章规划 → 分批写作{polish}（{eta}）…",
  startShort: "已开始生成，正文将逐段推送（{eta}）…",
  polishSegment: " → 分批润色",
  draftTitle: "生成中…",
  plannedShortFailed: "短篇正文生成失败",
};

const progressNovelEn = {
  bibleStart: "Building world and character bible…",
  bibleReady: "Bible ready: \"{title}\", {count} main characters",
  chapterPlanStart: "Planning chapter outline…",
  chapterPlanReady: "Outline ready — {count} chapters, starting draft…",
  checkpointCreated: "Draft created; each batch auto-saves for resume",
  resumeStart: "Resuming long-form novel from checkpoint…",
  batchSaved: "Batch {index} saved — you can resume later",
  completionPass: "Auto-completing ending: {reason}",
  completenessFail: "Completeness check failed: {reason}",
  synopsisStart: "Writing synopsis…",
  coverPending: "Body complete — cover will generate on the reading page",
  generateFailed: "Generation failed: models returned too little. Try a shorter length or retry later.",
  processError: "Generation process error",
  rateLimited: "Too many generation requests. Please try again later.",
  startLong: "Long pipeline: bible → chapter plan → segmented writing{polish} ({eta})…",
  startShort: "Generation started — body streams in segments ({eta})…",
  polishSegment: " → segmented polish",
  draftTitle: "Generating…",
  plannedShortFailed: "Short-form body generation failed",
};

const novelLengthEtaZhHans = {
  children: "儿童短篇约 1–3 分钟",
  short: "短篇约 1–3 分钟",
  medium: "中篇约 5–15 分钟",
  long: "长篇分段续写约 1–3 小时（约 8 万字级），请勿关闭页面",
};

const novelLengthEtaEn = {
  children: "Children's short story ~1–3 min",
  short: "Short story ~1–3 min",
  medium: "Medium length ~5–15 min",
  long: "Long-form segmented writing ~1–3 hours — keep this page open",
};

const streamInterruptEn = {
  streamInterruptLong:
    "Generation stream interrupted (often gateway timeout). Long-form batches are auto-saved — resume from this page or the create page. {eta}",
  streamInterruptShort:
    "Generation stream interrupted (often gateway timeout). {eta} Keep this page open and retry.",
};

const apiErrorsZhHans = {
  rateLimited: "生成次数过多，请稍后再试",
  needTitleGenre: "请提供书名并选择类型",
  resumeNotFound: "无法续写：草稿不存在或无权访问",
  resumeCheckpointMissing: "无法续写：断点数据缺失，请重新生成",
};

const apiErrorsEn = {
  rateLimited: "Too many generation requests. Please try again later.",
  needTitleGenre: "Please provide a title and select a genre",
  resumeNotFound: "Cannot resume: draft not found or access denied",
  resumeCheckpointMissing: "Cannot resume: checkpoint data missing, please regenerate",
};

function deepMerge(target, source) {
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      target[k] = deepMerge(target[k] ?? {}, v);
    } else {
      target[k] = v;
    }
  }
  return target;
}

const patchByLocale = {
  "zh-Hans": {
    genreTags: genreTagsZhHans,
    childrenAge: childrenAgeZhHans,
    readerThemes: readerThemesZhHans,
    novelReader: novelReaderZhHans,
    comicOptions: comicOptionsZhHans,
    progressNovel: progressNovelZhHans,
    apiErrors: apiErrorsZhHans,
    novelLength: {
      eta: novelLengthEtaZhHans,
      streamInterruptLong:
        "生成连接中断（多为网关或代理超时）。长篇每批正文已自动保存，可在本页或创作页点击「断点续写」继续；{eta}",
      streamInterruptShort:
        "生成连接中断（多为网关或代理超时）。{eta}，请保持页面打开后重试；若反复失败请联系管理员检查 LLM 网关超时设置。",
    },
  },
  "zh-Hant": {
    genreTags: {
      transmigration: { label: "穿越", desc: "古今/異世穿梭、身份錯位、改寫命運" },
      fantasy: { label: "玄幻", desc: "異界大陸、升級體系、血脈與機緣" },
      xianxia: { label: "仙俠", desc: "修仙問道、宗門靈根、渡劫飛升" },
      wuxia: { label: "武俠", desc: "江湖門派、俠義恩仇、武功秘籍" },
      historical: { label: "歷史", desc: "王朝權謀、考據架空、名將風雲" },
      urban: { label: "都市", desc: "現代職場、豪門商戰、逆襲打臉" },
      romance: { label: "言情", desc: "甜寵虐戀、婚戀成長、情感拉扯" },
      scifi: { label: "科幻", desc: "未來科技、星際末世、AI 與機甲" },
      mystery: { label: "懸疑", desc: "推理刑偵、密室真相、層層反轉" },
      horror: { label: "靈異", desc: "詭秘怪談、生存驚悚、未知禁忌" },
      children: { label: "兒童短篇", desc: "童真童趣、寓教於樂、淺語暖心" },
    },
    childrenAge: {
      infant_0_3: {
        label: "0-3 歲",
        stage: "嬰幼兒啟蒙",
        charRangeLabel: "90-110 字",
        features: "短句疊詞、極簡畫面、哄睡磨耳朵",
      },
      kindergarten_3_6: {
        label: "3-6 歲",
        stage: "幼兒園",
        charRangeLabel: "100-250 字",
        features: "童趣可愛、角色簡單、淺白道理",
      },
      primary_6_8: {
        label: "6-8 歲",
        stage: "1-2 年級",
        charRangeLabel: "300-500 字",
        features: "情節完整、適量好詞、低年級閱讀",
      },
      grade_9: {
        label: "9 歲",
        stage: "3 年級",
        charRangeLabel: "500-700 字",
        features: "人物關係、成語典故、獨立閱讀",
      },
      grade_10: {
        label: "10 歲",
        stage: "4 年級",
        charRangeLabel: "700-900 字",
        features: "情節飽滿、有深度、貼合課內素養",
      },
    },
    readerThemes: { paper: "護眼", night: "夜間", green: "綠豆" },
    novelReader: {
      tocMobile: "目錄 · {count}",
      tocTitle: "章節目錄",
      tocDesktop: "目錄 · {count} 章",
      readingBg: "閱讀背景",
      listen: "聽書",
      pauseListen: "暫停朗讀",
      resumeListen: "繼續朗讀",
      startListen: "從當前章開始聽",
      chapterHeading: "第{num}章 {title}",
    },
    comicOptions: {
      ...comicOptionsZhHans,
      styleLabel: "漫畫畫風",
      scopeLabelChildren: "改編模組",
      scopeLabelNovel: "改編範圍",
      childrenHint: "畫漫畫分鏡預設已選「兒童故事」正文；創意解讀僅供閱讀，一般不必改編進格子裡。",
      rosterHide: "收起人設存檔",
      rosterShow: "人設存檔（可選，全片統一外貌）",
      charAppearance: "外貌（臉型髮型身高）",
      childrenStoryTitle: "兒童故事",
    },
    progressNovel: {
      ...progressNovelZhHans,
      bibleStart: "正在整理世界觀與人物設定…",
      chapterPlanStart: "正在按篇幅規劃章節目錄…",
      synopsisStart: "正在撰寫劇情簡介…",
      resumeStart: "從斷點續寫長篇…",
      generateFailed: "小說生成失敗：模型未返回足夠內容或全部出錯，可嘗試改選中篇/短篇或稍後重試",
      startLong: "長篇流水線：設定聖經 → 章規劃 → 分批寫作{polish}（{eta}）…",
      startShort: "已開始生成，正文將逐段推送（{eta}）…",
      polishSegment: " → 分批潤飾",
      draftTitle: "生成中…",
    },
    apiErrors: apiErrorsZhHans,
    novelLength: {
      eta: {
        children: "兒童短篇約 1–3 分鐘",
        short: "短篇約 1–3 分鐘",
        medium: "中篇約 5–15 分鐘",
        long: "長篇分段續寫約 1–3 小時（約 8 萬字級），請勿關閉頁面",
      },
      streamInterruptLong:
        "生成連線中斷（多為閘道或代理逾時）。長篇每批正文已自動保存，可在本頁或創作頁點擊「斷點續寫」繼續；{eta}",
      streamInterruptShort:
        "生成連線中斷（多為閘道或代理逾時）。{eta}，請保持頁面打開後重試；若反覆失敗請聯繫管理員檢查 LLM 閘道逾時設定。",
    },
  },
  en: {
    genreTags: genreTagsEn,
    childrenAge: childrenAgeEn,
    readerThemes: readerThemesEn,
    novelReader: novelReaderEn,
    comicOptions: comicOptionsEn,
    progressNovel: progressNovelEn,
    apiErrors: apiErrorsEn,
    novelLength: { eta: novelLengthEtaEn, ...streamInterruptEn },
  },
  ms: {
    genreTags: genreTagsEn,
    childrenAge: childrenAgeEn,
    readerThemes: { paper: "Mata selesa", night: "Malam", green: "Hijau lembut" },
    novelReader: {
      tocMobile: "Isi kandungan · {count}",
      tocTitle: "Senarai bab",
      tocDesktop: "Isi kandungan · {count} bab",
      readingBg: "Tema bacaan",
      listen: "Dengar",
      pauseListen: "Jeda bacaan",
      resumeListen: "Sambung bacaan",
      startListen: "Dengar dari bab semasa",
      chapterHeading: "Bab {num} {title}",
    },
    comicOptions: {
      styleLabel: "Gaya komik",
      childrenStyleLocked:
        "Untuk cerita pendek kanak-kanak, komik menggunakan susun atur buku bergambar Q-version lima panel yang dikunci.",
      readModeSegment: "Bacaan segmen (pantas)",
      readModeFull: "Bacaan penuh (perlahan, lebih dekat plot)",
      scopeLabelChildren: "Modul adaptasi",
      scopeLabelNovel: "Skop adaptasi",
      modeAllChildren: "Buku penuh",
      modeAllNovel: "Buku penuh",
      modeSingle: "Satu bab",
      modeRange: "Julat bab",
      chapterOption: "Bab {num} · {title}",
      chapterShort: "Bab {num}",
      moduleLabel: "Modul {num}",
      moduleRange: "{from}–{to}",
      chapterRange: "Bab {from}–{to}",
      rangeTo: "hingga",
      willAdapt: "Adaptasi kali ini: {label}",
      childrenHint:
        "Storyboard lalai menggunakan badan cerita kanak-kanak; interpretasi kreatif hanya untuk bacaan.",
      rosterHide: "Sembunyikan senarai watak",
      rosterShow: "Senarai watak (pilihan, rupa konsisten)",
      charName: "Nama watak",
      charAppearance: "Rupa (muka, rambut, ketinggian)",
      charOutfit: "Pakaian tetap",
      addCharacter: "+ Tambah watak",
      childrenStoryTitle: "Cerita kanak-kanak",
    },
    progressNovel: progressNovelEn,
    apiErrors: apiErrorsEn,
    novelLength: { eta: novelLengthEtaEn, ...streamInterruptEn },
  },
  th: {
    genreTags: genreTagsEn,
    childrenAge: {
      infant_0_3: {
        label: "0–3 ปี",
        stage: "วัยทารก",
        charRangeLabel: "90–110 ตัวอักษร",
        features: "ประโยคสั้น ภาพเรียบง่าย ฟังก่อนนอน",
      },
      kindergarten_3_6: {
        label: "3–6 ปี",
        stage: "อนุบาล",
        charRangeLabel: "100–250 ตัวอักษร",
        features: "โทนสนุก ตัวละครง่าย บทเรียนเบาๆ",
      },
      primary_6_8: {
        label: "6–8 ปี",
        stage: "ป.1–2",
        charRangeLabel: "300–500 ตัวอักษร",
        features: "โครงเรื่องครบ คำศัพท์เหมาะวัย",
      },
      grade_9: {
        label: "9 ปี",
        stage: "ป.3",
        charRangeLabel: "500–700 ตัวอักษร",
        features: "ความสัมพันธ์ลึกขึ้น สำนวนและ典故",
      },
      grade_10: {
        label: "10 ปี",
        stage: "ป.4",
        charRangeLabel: "700–900 ตัวอักษร",
        features: "โครงเรื่องเต็ม มีความลึก",
      },
    },
    readerThemes: { paper: "ถนอมสายตา", night: "กลางคืน", green: "เขียวอ่อน" },
    novelReader: {
      tocMobile: "สารบัญ · {count}",
      tocTitle: "สารบัญบท",
      tocDesktop: "สารบัญ · {count} บท",
      readingBg: "ธีมการอ่าน",
      listen: "ฟัง",
      pauseListen: "หยุดฟังชั่วคราว",
      resumeListen: "ฟังต่อ",
      startListen: "ฟังจากบทปัจจุบัน",
      chapterHeading: "บทที่ {num} {title}",
    },
    comicOptions: {
      styleLabel: "สไตล์การ์ตูน",
      childrenStyleLocked:
        "สำหรับเรื่องสั้นเด็ก การ์ตูนจะใช้เลย์เอาต์หนังสือภาพ Q-version ห้าช่องที่ล็อกไว้",
      readModeSegment: "อ่านเป็นช่วง (เร็ว)",
      readModeFull: "อ่านทั้งเล่ม (ช้า ใกล้พล็อต)",
      scopeLabelChildren: "โมดูลดัดแปลง",
      scopeLabelNovel: "ขอบเขตดัดแปลง",
      modeAllChildren: "ทั้งเล่ม",
      modeAllNovel: "ทั้งเล่ม",
      modeSingle: "บทเดียว",
      modeRange: "ช่วงบท",
      chapterOption: "บท {num} · {title}",
      chapterShort: "บท {num}",
      moduleLabel: "โมดูล {num}",
      moduleRange: "{from}–{to}",
      chapterRange: "บท {from}–{to}",
      rangeTo: "ถึง",
      willAdapt: "รอบนี้ดัดแปลง {label}",
      childrenHint: "สตอรีบอร์ดเลือกเนื้อเรื่องเด็กเป็นค่าเริ่มต้น การตีความสร้างสรรค์สำหรับอ่านเท่านั้น",
      rosterHide: "ซ่อนรายชื่อตัวละคร",
      rosterShow: "รายชื่อตัวละคร (ไม่บังคับ รูปลักษณ์สม่ำเสมอ)",
      charName: "ชื่อตัวละคร",
      charAppearance: "รูปลักษณ์ (หน้า ผม ส่วนสูง)",
      charOutfit: "ชุดประจำ",
      addCharacter: "+ เพิ่มตัวละคร",
      childrenStoryTitle: "เรื่องเด็ก",
    },
    progressNovel: progressNovelEn,
    apiErrors: apiErrorsEn,
    novelLength: { eta: novelLengthEtaEn, ...streamInterruptEn },
  },
};

for (const locale of locales) {
  const file = path.join(root, "src/messages", `${locale}.json`);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const { progressNovelLong, progressComic, apiErrorsExtra } = mergeProgressLongComic(locale);
  const consistencyPack = mergeNovelComicConsistency(locale);
  const chapterDisplayPack = mergeNovelChapterDisplay(locale);
  const uiMiscPack = mergeUiMisc(locale);
  const { playGame, commercePlans, devBanner, gamePlayer, billing, novelReaderBlurb, godotWeb } = mergePlayGameExtras(locale);
  deepMerge(data, patchByLocale[locale]);
  deepMerge(data, {
    comicStyles: comicStylesByLocale[locale],
    createFlow: createFlowByLocale[locale],
    novelCreatePage: novelCreatePageByLocale[locale] ?? novelCreatePageByLocale.en,
    adminPage: adminPageByLocale[locale] ?? adminPageByLocale.en,
    adminCharts: adminChartsByLocale[locale] ?? adminChartsByLocale.en,
    superAdmin: superAdminByLocale[locale] ?? superAdminByLocale.en,
    playGame,
    commercePlans,
    devBanner,
  });
  deepMerge(data, { gamePlayer, billing, novelReader: novelReaderBlurb, godotWeb });
  deepMerge(data, {
    progressNovel: { ...progressNovelLong, ...consistencyPack.progressNovelExtra },
    progressComic,
    apiErrors: apiErrorsExtra,
  });
  deepMerge(data, { apiErrors: apiErrorsByLocale[locale] ?? apiErrorsByLocale.en });
  deepMerge(data, {
    novelCompleteness: consistencyPack.novelCompleteness,
    novelConsistency: consistencyPack.novelConsistency,
    comicConsistency: consistencyPack.comicConsistency,
    novelChapterLabels: chapterDisplayPack.novelChapterLabels,
    comicDisplay: chapterDisplayPack.comicDisplay,
    gameDisplay: chapterDisplayPack.gameDisplay,
    novelContinuation: uiMiscPack.novelContinuation,
    novelContinuePhase: uiMiscPack.novelContinuePhase,
    godotBuildHint: uiMiscPack.godotBuildHint,
    formatDuration: uiMiscPack.formatDuration,
    novelSynopsis: uiMiscPack.novelSynopsis,
  });
  deepMerge(data, { novelBrief: uiMiscPack.novelBriefExtra });
  deepMerge(data, {
    createStudioNarrative:
      createStudioNarrativeByLocale[locale] ?? createStudioNarrativeByLocale.en,
  });
  deepMerge(data, uiPatchByLocale[locale]);
  deepMerge(data, comicPanelServerByLocale[locale] ?? comicPanelServerByLocale.en);
  deepMerge(data, { ingestWarnings: ingestWarningsByLocale[locale] ?? ingestWarningsByLocale.en });
  deepMerge(data, { assetGen: assetGenByLocale[locale] ?? assetGenByLocale.en });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log("bulk patched", locale);
}
