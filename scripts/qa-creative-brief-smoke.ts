/**
 * 离线：一句话 → Creative Brief 扩写（不调用 LLM）
 */
import { buildGameKeyArtPromptFromBrief } from "../src/lib/creative-brief/cover-prompt";
import { detectBriefInputLocale } from "../src/lib/creative-brief/detect-input-locale";
import { expandCreativeBrief } from "../src/lib/creative-brief/expand-brief";
import { lintBriefThemeAlignment, alignSpecThemeFromBrief } from "../src/lib/creative-brief/lint-theme";
import { parseCreativeIntent } from "../src/lib/creative-brief/parse-intent";
import { mockSpecFromPrompt } from "../src/lib/mock-spec";
import { expandNovelCreativeBrief } from "../src/lib/literary-brief/expand-novel-brief";
import { buildNovelBriefSeed, getNovelGenreTag } from "../src/lib/novel-genre-tags";

const CASES = [
  "做一个星际大战的游戏",
  "塔防保卫萝卜波次进攻",
  "横版跳跃收集钥匙闯关",
  "治愈系森林收集金币",
  "江湖剑客门派对决",
  "恐怖丧尸生存",
  "二次元弹幕射击",
  "春节庙会花灯民俗收集",
  "足球射门街机体育",
  "推箱子解谜机关迷宫",
  "Make a space fleet shooter game",
  "パズルゲームで鍵を集める",
];

async function main() {
  let failed = false;
  for (const prompt of CASES) {
    const intent = parseCreativeIntent(prompt);
    const out = await expandCreativeBrief({ prompt, skipLlm: true });
    if (!out.brief.logline || out.brief.scenes.length < 1) {
      failed = true;
      console.error(`[FAIL] ${prompt}`);
      continue;
    }
    if (!out.augmentedPrompt.includes("【AI 深度扩写")) {
      failed = true;
      console.error(`[FAIL] augmented prompt missing brief block: ${prompt}`);
      continue;
    }
    const spec = mockSpecFromPrompt(prompt);
    const aligned = alignSpecThemeFromBrief(spec, out.brief);
    const issues = lintBriefThemeAlignment(out.brief, aligned);
    const cover = buildGameKeyArtPromptFromBrief(out.brief, aligned);
    if (!/no text/i.test(cover)) {
      failed = true;
      console.error(`[FAIL] cover prompt: ${prompt}`);
    }
    const locale = detectBriefInputLocale(prompt);
    if (out.brief.inputLocale && out.brief.inputLocale !== locale) {
      failed = true;
      console.error(`[FAIL] locale mismatch: ${prompt}`);
    }
    console.log(
      `[OK] ${prompt.slice(0, 20)}… → pack=${out.brief.packId} locale=${locale} template=${intent.templateHint} themeIssues=${issues.length}`,
    );
  }
  const transTag = getNovelGenreTag("transmigration");
  if (transTag) {
    const seed = buildNovelBriefSeed("我穿越到了唐朝的安史之乱", transTag);
    const out = await expandNovelCreativeBrief({
      prompt: seed,
      title: "我穿越到了唐朝的安史之乱",
      genreId: "transmigration",
      skipLlm: true,
    });
    const narrativeText = [
      out.brief.logline,
      out.brief.setting,
      out.brief.world,
      out.brief.protagonist,
      out.brief.coreConflict,
      ...out.brief.plotBeats,
      ...out.brief.keyScenes,
    ].join("\n");
    const bad =
      /落地为.*小游戏|主玩法区域|templateId|四幕 director|玩家单位/.test(narrativeText) ||
      "packId" in (out.brief as object);
    if (bad || !out.brief.protagonist) {
      failed = true;
      console.error("[FAIL] novel literary brief has game leakage");
    } else {
      console.log(`[OK] novel literary brief → ${out.brief.genreLabel}`);
    }
  }

  if (failed) process.exitCode = 1;
  else console.log(`[OK] qa-creative-brief-smoke: ${CASES.length + 1} cases`);
}

void main();
