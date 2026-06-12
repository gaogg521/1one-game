/** Novel chapter parse fallbacks + comic display suffix — merge via i18n-bulk-catalog.mjs */

export const novelChapterLabelsZhHans = {
  body: "正文",
  opening: "开篇",
  section: "第{num}节",
};

export const novelChapterLabelsEn = {
  body: "Body",
  opening: "Opening",
  section: "Section {num}",
};

export const comicDisplayZhHans = {
  editionSuffix: " · 漫画版",
};

export const comicDisplayEn = {
  editionSuffix: " · Comic edition",
};

export const gameDisplayZhHans = {
  untitledGame: "未命名小游戏",
};

export const gameDisplayEn = {
  untitledGame: "Untitled mini game",
};

function hantifyChapter(obj) {
  const map = { 正文: "正文", 开篇: "開篇", 节: "節" };
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    let s = v;
    for (const [from, to] of Object.entries(map)) s = s.replaceAll(from, to);
    out[k] = s;
  }
  return out;
}

function hantifyComic(obj) {
  return { editionSuffix: " · 漫畫版" };
}

export function mergeNovelChapterDisplay(locale) {
  const byLocale = {
    "zh-Hans": {
      novelChapterLabels: novelChapterLabelsZhHans,
      comicDisplay: comicDisplayZhHans,
      gameDisplay: gameDisplayZhHans,
    },
    "zh-Hant": {
      novelChapterLabels: hantifyChapter(novelChapterLabelsZhHans),
      comicDisplay: hantifyComic(comicDisplayZhHans),
      gameDisplay: { untitledGame: "未命名小遊戲" },
    },
    en: {
      novelChapterLabels: novelChapterLabelsEn,
      comicDisplay: comicDisplayEn,
      gameDisplay: gameDisplayEn,
    },
    ms: {
      novelChapterLabels: { body: "Isi", opening: "Pembukaan", section: "Bahagian {num}" },
      comicDisplay: { editionSuffix: " · Edisi komik" },
      gameDisplay: { untitledGame: "Permainan mini tanpa tajuk" },
    },
    th: {
      novelChapterLabels: { body: "เนื้อหา", opening: "เปิดเรื่อง", section: "ตอนที่ {num}" },
      comicDisplay: { editionSuffix: " · ฉบับการ์ตูน" },
      gameDisplay: { untitledGame: "มินิเกมไม่มีชื่อ" },
    },
  };
  return byLocale[locale] ?? byLocale.en;
}
