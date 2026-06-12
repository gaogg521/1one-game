/** Misc UI strings — continuation, Godot hints, duration, synopsis, brief — merge via i18n-bulk-catalog.mjs */

export const novelBriefExtraZhHans = {
  narrativeModeRetelling: "典故复述（主人公讲源故事）",
  narrativeModeListenerExtension: "听后延伸（孩子+伙伴学寓意）",
};

export const novelBriefExtraEn = {
  narrativeModeRetelling: "Classic retelling (lead tells the source tale)",
  narrativeModeListenerExtension: "After-listening extension (child + friends learn the moral)",
};

export const novelContinuationZhHans = {
  notLongForm: "仅长篇支持 AI 续写",
  atCharLimit: "已达长篇字数上限",
  chaptersRemaining: "尚有 {count} 章未完成，可继续写作",
  planComplete: "原章规划已写完，可续写新章节",
  resumeFromBody: "将根据正文与创意恢复设定后续写",
};

export const novelContinuationEn = {
  notLongForm: "AI continue is only available for long novels",
  atCharLimit: "Long-novel character limit reached",
  chaptersRemaining: "{count} planned chapters remain — you can keep writing",
  planComplete: "Original chapter plan is complete — you can add new chapters",
  resumeFromBody: "Settings will be recovered from the body and prompt to continue",
};

export const novelContinuePhaseZhHans = {
  opening: "续写开篇",
  climax: "续写高潮",
  closing: "续写收束",
  progress: "续写推进",
};

export const novelContinuePhaseEn = {
  opening: "Continue — opening",
  climax: "Continue — climax",
  closing: "Continue — closing",
  progress: "Continue — progression",
};

export const godotBuildHintZhHans = {
  loadingWithRefs: "正在构建 Godot 在线版，将尝试写入 {count} 张参考图…",
  loading: "正在构建 Godot 在线版（约 10～30 秒）…",
  refsWritten: "参考图已写入 Godot 构建：{count} 张{detail}{cache}",
  detailMap: "地图/背景",
  detailMonster: "怪物×{count}",
  detailTower: "炮塔×{count}",
  detailProtagonist: "主角/守点",
  cacheHit: " · 命中缓存",
  queuedButFailed: "已排队参考图，但未能写入 Godot 构建（将使用默认造型）。请重新「解析素材」后点 Godot 重试。",
  noRefs: "本次 Godot 构建未包含参考贴图（仅使用默认造型）。",
};

export const godotBuildHintEn = {
  loadingWithRefs: "Building Godot online build — attempting to write {count} reference image(s)…",
  loading: "Building Godot online build (~10–30s)…",
  refsWritten: "Reference images written to Godot build: {count}{detail}{cache}",
  detailMap: "map/background",
  detailMonster: "monsters×{count}",
  detailTower: "towers×{count}",
  detailProtagonist: "hero/defense point",
  cacheHit: " · cache hit",
  queuedButFailed:
    "References were queued but could not be written to the Godot build (default look will be used). Re-run ingest, then retry Godot.",
  noRefs: "This Godot build has no reference textures (default look only).",
};

export const formatDurationZhHans = {
  secOnly: "{sec} 秒",
  minSec: "{min} 分 {sec} 秒",
  minOnly: "{min} 分钟",
};

export const formatDurationEn = {
  secOnly: "{sec}s",
  minSec: "{min}m {sec}s",
  minOnly: "{min}m",
};

export const novelSynopsisZhHans = {
  arcTail: "全书 {count} 章，含「{arc}」等情节。",
  aiFallback: "{title}：一部 AI 生成的原创连载故事。",
};

export const novelSynopsisEn = {
  arcTail: "{count} chapters including “{arc}” and more.",
  aiFallback: "{title}: an AI-generated original serial story.",
};

function hantify(obj, map) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    let s = v;
    for (const [from, to] of Object.entries(map)) s = s.replaceAll(from, to);
    out[k] = s;
  }
  return out;
}

export function mergeUiMisc(locale) {
  const hantMap = {
    典故: "典故",
    复述: "複述",
    主人公: "主人公",
    源故事: "源故事",
    听后: "聽後",
    延伸: "延伸",
    孩子: "孩子",
    伙伴: "夥伴",
    学: "學",
    寓意: "寓意",
    仅: "僅",
    长篇: "長篇",
    支持: "支持",
    续写: "續寫",
    已达: "已達",
    字数: "字數",
    上限: "上限",
    尚有: "尚有",
    章: "章",
    未完成: "未完成",
    可: "可",
    继续: "繼續",
    写作: "寫作",
    原: "原",
    规划: "規劃",
    已写完: "已寫完",
    新章节: "新章節",
    将: "將",
    根据: "根據",
    正文: "正文",
    与: "與",
    创意: "創意",
    恢复: "恢復",
    设定: "設定",
    后续: "後續",
    开篇: "開篇",
    高潮: "高潮",
    收束: "收束",
    推进: "推進",
    正在: "正在",
    构建: "構建",
    在线版: "線上版",
    尝试: "嘗試",
    写入: "寫入",
    张: "張",
    参考图: "參考圖",
    约: "約",
    秒: "秒",
    已: "已",
    构建: "構建",
    地图: "地圖",
    背景: "背景",
    怪物: "怪物",
    炮塔: "炮塔",
    主角: "主角",
    守点: "守點",
    命中: "命中",
    缓存: "快取",
    排队: "排隊",
    但: "但",
    未能: "未能",
    默认: "預設",
    造型: "造型",
    请: "請",
    重新: "重新",
    解析: "解析",
    素材: "素材",
    后点: "後點",
    重试: "重試",
    本次: "本次",
    未包含: "未包含",
    贴图: "貼圖",
    分: "分",
    分钟: "分鐘",
    全书: "全書",
    含: "含",
    等情节: "等情節",
    一部: "一部",
    生成: "生成",
    原创: "原創",
    连载: "連載",
    故事: "故事",
  };

  const byLocale = {
    "zh-Hans": {
      novelBriefExtra: novelBriefExtraZhHans,
      novelContinuation: novelContinuationZhHans,
      novelContinuePhase: novelContinuePhaseZhHans,
      godotBuildHint: godotBuildHintZhHans,
      formatDuration: formatDurationZhHans,
      novelSynopsis: novelSynopsisZhHans,
    },
    "zh-Hant": {
      novelBriefExtra: hantify(novelBriefExtraZhHans, hantMap),
      novelContinuation: hantify(novelContinuationZhHans, hantMap),
      novelContinuePhase: hantify(novelContinuePhaseZhHans, hantMap),
      godotBuildHint: hantify(godotBuildHintZhHans, hantMap),
      formatDuration: hantify(formatDurationZhHans, hantMap),
      novelSynopsis: hantify(novelSynopsisZhHans, hantMap),
    },
    en: {
      novelBriefExtra: novelBriefExtraEn,
      novelContinuation: novelContinuationEn,
      novelContinuePhase: novelContinuePhaseEn,
      godotBuildHint: godotBuildHintEn,
      formatDuration: formatDurationEn,
      novelSynopsis: novelSynopsisEn,
    },
    ms: {
      novelBriefExtra: novelBriefExtraEn,
      novelContinuation: {
        notLongForm: "Sambungan AI hanya untuk novel panjang",
        atCharLimit: "Had aksara novel panjang dicapai",
        chaptersRemaining: "{count} bab dirancang belum siap — boleh sambung menulis",
        planComplete: "Rancangan bab asal siap — boleh tambah bab baharu",
        resumeFromBody: "Tetapan akan dipulihkan daripada badan dan prompt untuk sambung",
      },
      novelContinuePhase: {
        opening: "Sambung — pembukaan",
        climax: "Sambung — klimaks",
        closing: "Sambung — penutup",
        progress: "Sambung — kemajuan",
      },
      godotBuildHint: godotBuildHintEn,
      formatDuration: formatDurationEn,
      novelSynopsis: novelSynopsisEn,
    },
    th: {
      novelBriefExtra: novelBriefExtraEn,
      novelContinuation: {
        notLongForm: "การเขียนต่อด้วย AI ใช้ได้เฉพาะนิยายยาว",
        atCharLimit: "ถึงขีดจำกัดตัวอักษรนิยายยาวแล้ว",
        chaptersRemaining: "ยังเหลือ {count} บทตามแผน — เขียนต่อได้",
        planComplete: "แผนบทเดิมครบแล้ว — เพิ่มบทใหม่ได้",
        resumeFromBody: "จะกู้คืนบริบทจากเนื้อหาและ prompt เพื่อเขียนต่อ",
      },
      novelContinuePhase: {
        opening: "เขียนต่อ — เปิดเรื่อง",
        climax: "เขียนต่อ — จุดพีก",
        closing: "เขียนต่อ — ปิดเรื่อง",
        progress: "เขียนต่อ — ดำเนินเรื่อง",
      },
      godotBuildHint: godotBuildHintEn,
      formatDuration: formatDurationEn,
      novelSynopsis: novelSynopsisEn,
    },
  };
  return byLocale[locale] ?? byLocale.en;
}
