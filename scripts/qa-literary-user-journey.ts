/**
 * PM / 用户主路径 — 小说 + 小说→漫画（离线）
 * 与游戏 `qa:user-journey-parity` 并列，构成平台级用户验收。
 *
 * npm run qa:literary-user-journey
 */
import fs from "node:fs";
import path from "node:path";
import { assignSourceSegmentIndicesToPages, enrichPagesFromNovelSegments, comicPagesAreAllPlaceholders } from "../src/lib/comic-dialogue-extract";
import { buildComicSystemPrompt } from "../src/lib/comic-generate-config";
import { buildChapterAdaptationProgress } from "../src/lib/comic-chapter-adaptation";
import { resolveComicLayoutId } from "../src/lib/comic-layout";
import { inferStoryGenre } from "../src/lib/cover-genre";
import { assessNovelCompleteness } from "../src/lib/novel-completeness";
import { splitNovelIntoSegments } from "../src/lib/comic-storyboard-segments";

const OUT = path.join(process.cwd(), "qa-output", "literary-user-journey");

type Row = { story: string; ok: boolean; detail: string };

function main() {
  const rows: Row[] = [];
  const failures: string[] = [];

  console.log("\n# qa:literary-user-journey — 小说 / 漫画 PM 主路径\n");

  // Story 1：短篇必须收束，不能「未完待续」半成品入库
  const cliff = assessNovelCompleteness(
    "=== 第1章 ===\n他穿越了。\n\n=== 第2章 ===\n危机逼近，且听下回分解。",
    "short",
  );
  const ok1 = !cliff.ok;
  rows.push({ story: "短篇拒绝悬念截断", ok: ok1, detail: cliff.reason });
  if (!ok1) failures.push("story1 cliffhanger");
  console.log(`[${ok1 ? "OK" : "FAIL"}] story1 短篇完整性门禁`);

  // Story 2：历史/穿越题材视觉不得误判都市（煤山崇祯类）
  const genre = inferStoryGenre({
    title: "穿越到煤山的崇祯帝",
    summary: "现代人穿越成崇祯，试图改写明末亡国结局",
    prompt: "穿越 历史 崇祯 明末",
    contentSnippet: "崇祯十七年三月十九日，朕却从后世醒来。",
  });
  const ok2 = genre === "historical" || genre === "transmigration";
  rows.push({ story: "历史题材视觉路由", ok: ok2, detail: genre });
  if (!ok2) failures.push("story2 genre");
  console.log(`[${ok2 ? "OK" : "FAIL"}] story2 题材视觉 ${genre}`);

  // Story 3：中篇默认四宫格（迭代十八：降低单次分镜 JSON 格数；长篇仍八宫格）
  const layoutMedium = resolveComicLayoutId({ lengthTier: "medium" });
  const layoutLong = resolveComicLayoutId({ lengthTier: "long" });
  const ok3 = layoutMedium === "grid_4" && layoutLong === "grid_8";
  rows.push({
    story: "中篇四宫格 / 长篇八宫格",
    ok: ok3,
    detail: `medium=${layoutMedium} long=${layoutLong}`,
  });
  if (!ok3) failures.push("story3 layout");
  console.log(`[${ok3 ? "OK" : "FAIL"}] story3 layout medium=${layoutMedium} long=${layoutLong}`);

  // Story 4：分镜 prompt 强调关键情节，非逐段 1～2 格线性映射
  const comicPrompt = buildComicSystemPrompt(4, "historical", "chinese_wuxia", { layoutId: "grid_4" });
  const ok4 =
    /关键情节|关键故事瞬间/.test(comicPrompt) && !/1～2 格|1-2 格|逐段改编/.test(comicPrompt);
  rows.push({ story: "分镜策略=关键情节", ok: ok4, detail: ok4 ? "key moments" : "linear mapping leak" });
  if (!ok4) failures.push("story4 prompt");
  console.log(`[${ok4 ? "OK" : "FAIL"}] story4 分镜 prompt 策略`);

  // Story 5：正文对白可回填占位格（小说→漫画核心缺陷修复路径）
  const novelBody = `=== 第1章 煤山 ===\n崇祯低声道：「朕不能亡于此。」\n\n=== 第2章 破局 ===\n他终于改写了亡国结局，天下重归太平。`;
  const segments = splitNovelIntoSegments(novelBody);
  const pages = assignSourceSegmentIndicesToPages(
    [{ page: 1, panels: [{ caption: "……", prompt: "scene" }, { caption: "……", prompt: "scene2" }] }],
    segments,
  );
  let enriched = enrichPagesFromNovelSegments(pages, segments);
  const firstCaption = enriched[0]!.panels[0]!.caption ?? "";
  const secondCaption = enriched[0]!.panels[1]!.caption ?? "";
  const ok5 =
    !comicPagesAreAllPlaceholders(enriched) &&
    (firstCaption.includes("朕") || firstCaption.includes("不能")) &&
    secondCaption.includes("改写") &&
    !secondCaption.includes("第2章") &&
    enriched[0]!.panels.every((p) => (p.caption?.trim() ?? "") !== "……");
  rows.push({
    story: "正文对白/旁白回填分镜",
    ok: ok5,
    detail: ok5
      ? `${firstCaption} | ${secondCaption}`
      : `allPlaceholder=${comicPagesAreAllPlaceholders(enriched)} cap1=${firstCaption} cap2=${secondCaption}`,
  });
  if (!ok5) failures.push("story5 dialogue enrich");
  console.log(`[${ok5 ? "OK" : "FAIL"}] story5 对白回填`);

  // Story 6：按章改编进度可追踪
  const multiChapter = `=== 第1章 起 ===\na\n\n=== 第2章 承 ===\nb\n\n=== 第3章 转 ===\nc`;
  const progress = buildChapterAdaptationProgress(multiChapter, [
    {
      imageUrls: JSON.stringify({
        formatVersion: 2,
        pages: [{ page: 1, panels: [{ caption: "x" }] }],
        chapterScope: { fromChapter: 1, toChapter: 1, label: "第1章" },
      }),
    },
  ]);
  const ok6 = progress.adaptedCount === 1 && progress.nextChapter?.fromChapter === 2;
  rows.push({
    story: "按章改编进度",
    ok: ok6,
    detail: `adapted=${progress.adaptedCount} next=${progress.nextChapter?.fromChapter ?? "?"}`,
  });
  if (!ok6) failures.push("story6 chapter progress");
  console.log(`[${ok6 ? "OK" : "FAIL"}] story6 章进度`);

  fs.mkdirSync(OUT, { recursive: true });
  const summary = {
    at: new Date().toISOString(),
    pass: failures.length === 0,
    failures,
    rows,
    stories: [
      "用户写短篇 → 必须收束才入库",
      "用户改编历史小说 → 视觉题材不错判都市",
      "用户中篇改编 → 四宫格（轻量分镜）；长篇 → 八宫格",
      "分镜 LLM → 抽关键情节而非逐段铺格",
      "LLM 占位格 → 正文对白/旁白自动回填",
      "长篇按章 → 改编进度与下一章可续",
    ],
  };
  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));

  const md = [
    "# 文学线用户 / PM 主路径",
    "",
    `生成时间：${summary.at}`,
    "",
    "## 用户故事",
    "",
    ...summary.stories.map((s, i) => `${i + 1}. ${s}`),
    "",
    failures.length ? `## 失败\n\n${failures.map((f) => `- ${f}`).join("\n")}` : "## 状态\n\n全部通过",
    "",
    "## 用户可见兑现",
    "",
    "- 小说阅读页：`LiteraryAdaptationTrustBadge` + 按章进度条",
    "- 小说完成页 / 阅读页：一键「改编漫画」",
    "- 漫画详情：标明来源小说与改编范围",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(OUT, "REPORT.md"), md, "utf8");

  console.log(`\n报告：${path.relative(process.cwd(), path.join(OUT, "REPORT.md"))}`);

  if (failures.length) {
    console.error(`[FAIL] ${failures.length} 条`);
    process.exit(1);
  }
  console.log("[OK] qa:literary-user-journey");
}

main();
