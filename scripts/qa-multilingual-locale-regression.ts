import assert from "node:assert/strict";
import { detectBriefInputLocale, detectChineseScriptVariant } from "@/lib/creative-brief/detect-input-locale";
import { buildComicSystemPrompt, shouldUseLongComicPipeline } from "@/lib/comic-generate-config";
import {
  resolveComicOutputLocale,
  resolveComicLayoutForLocale,
  resolveStoryboardChunkPages,
} from "@/lib/comic-locale-prompts";
import { splitNovelIntoSegments } from "@/lib/comic-storyboard-segments";
import { localizeNovelBriefPack } from "@/lib/literary-brief/novel-pack-i18n";
import { getNovelBriefPack } from "@/lib/literary-brief/novel-packs";
import { buildNovelBriefSeed, getNovelGenreTag } from "@/lib/novel-genre-tags";
import { buildNovelUserMessage, getNovelSystemPrompt } from "@/lib/novel-generate-config";

function main() {
  const cases = [
    {
      locale: "en",
      prompt: "Write a short wuxia story in English about the first Jinyiwei of the Ming dynasty.",
      expect: /English/i,
    },
    {
      locale: "ms",
      prompt: "Tulis cerpen wuxia dalam Bahasa Melayu tentang pengawal Jinyiwei pertama pada zaman Dinasti Ming.",
      expect: /Bahasa Melayu/i,
    },
    {
      locale: "th",
      prompt: "เขียนนิยายกำลังภายในสั้นภาษาไทยเกี่ยวกับองครักษ์จิ่นอี้เว่ยคนแรกแห่งราชวงศ์หมิง",
      expect: /ภาษาไทย/i,
    },
    {
      locale: "zh-Hant",
      prompt: "請用繁體中文寫一篇短篇武俠小說，主角是明朝第一位錦衣衛。",
      expect: /繁體中文/,
    },
  ] as const;

  for (const item of cases) {
    assert.equal(detectBriefInputLocale(item.prompt), item.locale, `${item.locale} 输入应被正确识别`);
    const system = getNovelSystemPrompt("short", undefined, item.prompt);
    assert.match(system, item.expect, `${item.locale} 系统提示词应锁定目标语言`);
    const user = buildNovelUserMessage(item.prompt, "Test Title", "short");
    assert.match(user, item.expect, `${item.locale} 用户提示词应锁定目标语言`);
  }

  assert.equal(detectChineseScriptVariant("請用繁體中文寫一篇武俠"), "zh-Hant");
  assert.equal(detectChineseScriptVariant("请用简体中文写一篇武侠"), "zh");

  const wuxia = getNovelGenreTag("wuxia")!;
  const msSeed = buildNovelBriefSeed("Pengawal Pertama", wuxia, "", undefined, "ms");
  assert.match(msSeed, /Kembangkan ini menjadi rangka konsep/i);

  const localized = localizeNovelBriefPack(getNovelBriefPack("wuxia"), "ms");
  assert.doesNotMatch(localized.setting, /架空或半架空古代江湖/);
  assert.match(localized.setting, /jianghu|purba|rekaan/i);

  const enNovel =
    "=== Chapter 1: The First Guard ===\n\nThe rain fell on the Forbidden City. Shen Wei tightened his grip on the blade.\n\n\"Move,\" he said.";
  assert.equal(resolveComicOutputLocale("English wuxia novel", enNovel), "en");
  const enComicSystem = buildComicSystemPrompt(4, "wuxia", "japanese_clean", { outputLocale: "en" });
  assert.match(enComicSystem, /caption: English overlay text/i);
  assert.doesNotMatch(enComicSystem, /caption：中文叠字/);
  assert.equal(
    shouldUseLongComicPipeline(4, "short", "en"),
    false,
    "英文 4 页短篇应优先轻量分镜",
  );
  assert.equal(shouldUseLongComicPipeline(4, "short", "zh"), false, "中文短篇应走轻量分镜");
  assert.equal(shouldUseLongComicPipeline(4, "short", "zh-Hant"), false);
  assert.equal(
    resolveComicLayoutForLocale("grid_8", "en", 4),
    "grid_4",
    "英文短篇应降为四宫格",
  );
  assert.equal(resolveStoryboardChunkPages("en", 4), 1);

  const enSegs = splitNovelIntoSegments(enNovel, 20, "en");
  assert.ok(enSegs.length >= 2, "英文正文应按句/段切分");
}

main();
console.log("qa-multilingual-locale-regression: ok");
