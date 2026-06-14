/**
 * Operone 产品信息架构：双层策略（惊艳入口 + 创作者工作台）共享文案与路由。
 */

import type { AppLocale } from "@/i18n/routing";
import enMessages from "@/messages/en.json";
import msMessages from "@/messages/ms.json";
import thMessages from "@/messages/th.json";
import zhHansMessages from "@/messages/zh-Hans.json";
import zhHantMessages from "@/messages/zh-Hant.json";

export type CreationMode = "game" | "novel" | "comic";

const localeMessages = {
  "zh-Hans": zhHansMessages,
  "zh-Hant": zhHantMessages,
  en: enMessages,
  ms: msMessages,
  th: thMessages,
} as const;

function messagesFor(locale: AppLocale) {
  return localeMessages[locale];
}

export function getProductPromise(locale: AppLocale) {
  const m = messagesFor(locale).productIa;
  return {
    headline: m.headline,
    subhead: m.subhead,
    primaryCta: m.primaryCta,
    secondaryCta: m.secondaryCta,
  } as const;
}

export function getWowSteps(locale: AppLocale) {
  const m = messagesFor(locale).productIa.steps;
  return [
    { n: "01", title: m.step1Title, body: m.step1Body },
    { n: "02", title: m.step2Title, body: m.step2Body },
    { n: "03", title: m.step3Title, body: m.step3Body },
  ] as const;
}

export function getCreationModes(locale: AppLocale): Record<
  CreationMode,
  { label: string; tagline: string; eta: string; href: string; wow: string }
> {
  const m = messagesFor(locale).productIa.modes;
  return {
    game: {
      label: m.gameLabel,
      tagline: m.gameTagline,
      eta: m.gameEta,
      href: "/create",
      wow: m.gameWow,
    },
    novel: {
      label: m.novelLabel,
      tagline: m.novelTagline,
      eta: m.novelEta,
      href: "/novel/create",
      wow: m.novelWow,
    },
    comic: {
      label: m.comicLabel,
      tagline: m.comicTagline,
      eta: m.comicEta,
      href: "/comic/create",
      wow: m.comicWow,
    },
  };
}

const GAME_HINT =
  /游戏|塔防|射击|平台|试玩|关卡|玩|收集|生存|躲避|Phaser|Godot|像素|萝卜|蘿蔔|僵尸|tower defense|tower-defense|platformer|shooter|survival game|puzzle game|physics game|arcade|mini-?game|stress-?relief|playable game|pertahanan menara|menara anak panah|ป้องกันฐาน|หอคอย/i;
const NOVEL_HINT =
  /小说|小說|章节|章節|长篇|長篇|短篇|故事|正文|续写|續寫|儿童|兒童|童话|童話|听书|聽書|穿越|历史走向|歷史走向|改变历史|改變歷史|novel|chapter|short story|children'?s story|fairy tale|time traveler|historical fiction|write a .*story|cerita pendek|kanak-kanak|pengembara masa|sejarah|นิทาน|เด็ก|ข้ามเวลา|ประวัติศาสตร์/i;
const COMIC_HINT =
  /漫画|分镜|格|动漫|条漫|绘本|画面|配图|comic|storyboard|panel|manga|webtoon|four-?panel|strip comic|komik|สตอรีบอร์ด|คอมิก/i;

/** 根据用户输入推荐创作载体；默认游戏（最快 wow）。 */
export function inferCreationMode(text: string): CreationMode {
  const t = text.trim();
  if (!t) return "game";
  if (COMIC_HINT.test(t)) return "comic";
  if (NOVEL_HINT.test(t)) return "novel";
  if (GAME_HINT.test(t)) return "game";
  return "game";
}

export function creationEntryHref(mode: CreationMode, prompt: string, locale: AppLocale = "zh-Hans"): string {
  const q = encodeURIComponent(prompt.trim().slice(0, 4000));
  const modes = getCreationModes(locale);
  if (!q) return modes[mode].href;
  switch (mode) {
    case "novel":
      return `/novel/create?prefill=${q}`;
    case "comic":
      return `/comic/create?prefill=${q}`;
    default:
      return `/create?prefill=${q}`;
  }
}

export function getStarterPrompts(locale: AppLocale) {
  return messagesFor(locale).productIa.starterPrompts;
}

export function getDiscoverIntake(locale: AppLocale) {
  const m = messagesFor(locale).productIa;
  return {
    title: m.discoverIntakeTitle,
    body: m.discoverIntakeBody,
    cta: m.discoverIntakeCta,
    href: "/start",
  } as const;
}
