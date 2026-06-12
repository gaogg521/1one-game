/**
 * 英文中篇 + 漫画 E2E（真实 LLM，直连 lib）
 * 运行：npx tsx scripts/qa-en-medium-novel-comic-e2e.ts
 * 可选：SKIP_COMIC_PANELS=1 跳过分镜配图；QA_KEEP_ARTIFACTS=1 保留 DB 产物
 */
import "dotenv/config";
import { assessNovelCompleteness } from "@/lib/novel-completeness";
import { parseNovelChapters } from "@/lib/novel-chapters";
import { runComicGeneration } from "@/lib/comic-generate-run";
import { parseComicImageUrls } from "@/lib/comic-format";
import { getActiveProvider, getNovelStyleTextModelCascade } from "@/lib/llm";
import { novelMinAcceptChars } from "@/lib/novel-generate-config";
import { generateNovelSynopsis } from "@/lib/novel-synopsis";
import { streamPlannedNovelBody } from "@/lib/novel-planned-generate";
import { planNovelScope } from "@/lib/novel-scope-plan";
import { prisma } from "@/lib/prisma";

const OWNER = "qa-en-medium-e2e";
const TITLE = "The First Jinyiwei of Ming";
const PROMPT =
  "Write a medium-length wuxia story in English about Shen Lian, the first Jinyiwei of the Ming dynasty. " +
  "He must uncover a palace conspiracy within three days. Include a full resolution and epilogue — no cliffhanger, no 'to be continued'.";
const TIER = "medium" as const;
const UI_LOCALE = "en" as const;
const SKIP_PANELS = process.env.SKIP_COMIC_PANELS === "1";
const COMIC_PAGE_COUNT = Number(process.env.QA_COMIC_PAGES ?? "2");

function log(msg: string) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim() && getActiveProvider() === "litellm") {
    console.error("缺少 OPENAI_API_KEY");
    process.exit(1);
  }

  log(`provider=${getActiveProvider()} tier=${TIER} uiLocale=${UI_LOCALE} skipPanels=${SKIP_PANELS}`);

  const scope = planNovelScope(TIER);
  log(`scope: ${scope.chapterCount} chapters, target ${scope.targetTotalChars} chars`);

  const cascade = getNovelStyleTextModelCascade();
  const model = cascade[0];
  if (!model) throw new Error("无可用小说模型");

  const steps: string[] = [];
  const tNovel = Date.now();
  log("▶ 英文中篇生成…");

  const result = await streamPlannedNovelBody({
    model,
    promptTrim: PROMPT,
    titleTrim: TITLE,
    lengthTier: TIER,
    uiLocale: UI_LOCALE,
    emit: (ev) => {
      const step = typeof ev.step === "string" ? ev.step : "";
      if (
        ["bible_start", "bible_ready", "chapter_plan_start", "chapter_plan_ready", "completion_pass"].includes(
          step,
        )
      ) {
        steps.push(step);
        log(`  [novel/${step}] ${(ev as { message?: string }).message ?? ""}`);
      }
    },
  });

  const novelMs = Date.now() - tNovel;
  const chapters = parseNovelChapters(result.content);
  const minAccept = novelMinAcceptChars(TIER);
  const completeness = assessNovelCompleteness(
    result.content,
    TIER,
    undefined,
    PROMPT,
    result.pipelineMeta.chapterPlan,
    UI_LOCALE,
  );

  log("--- 小说结果 ---");
  log(`耗时 ${(novelMs / 1000).toFixed(1)}s model=${model}`);
  log(`规划 ${result.pipelineMeta.chapterPlan.chapters.length} 章 → 写成 ${chapters.length} 章`);
  log(`字数 ${result.content.length} (min ${minAccept})`);
  log(`完整性: ${completeness.ok ? "通过" : `失败 — ${completeness.reason}`}`);
  log(`末章: ${chapters.at(-1)?.title ?? "(none)"}`);
  log(`末 200 字:\n${result.content.slice(-200)}`);

  if (!steps.includes("chapter_plan_ready")) throw new Error("未执行章提纲");
  if (result.content.length < minAccept) {
    throw new Error(`正文过短 ${result.content.length} < ${minAccept}`);
  }
  if (!completeness.ok) throw new Error(`完整性未通过: ${completeness.reason}`);
  if (chapters.length < result.pipelineMeta.chapterPlan.chapters.length) {
    throw new Error("写成章数少于提纲");
  }
  if (/to be continued|未完待续|敬请期待/i.test(result.content.slice(-800))) {
    throw new Error("末段出现断章标记");
  }

  const summary = await generateNovelSynopsis({
    model,
    title: TITLE,
    prompt: PROMPT,
    content: result.content,
    lengthTier: TIER,
  });

  const novel = await prisma.novel.create({
    data: {
      ownerKey: OWNER,
      title: TITLE,
      prompt: PROMPT,
      content: result.content,
      summary,
      lengthTier: TIER,
      status: "ready",
      visibility: "public",
    },
  });
  log(`novel saved id=${novel.id}`);

  const tComic = Date.now();
  log(`▶ 英文漫画生成 (pages=${COMIC_PAGE_COUNT})…`);

  const comicEvents: string[] = [];
  const comicResult = await runComicGeneration(
    {
      ownerKey: OWNER,
      novelId: novel.id,
      title: TITLE,
      content: result.content,
      lengthTier: TIER,
      pageCount: COMIC_PAGE_COUNT,
      readMode: "segment",
      stylePreset: "watercolor",
      uiLocale: UI_LOCALE,
    },
    (ev) => {
      const step = typeof ev.step === "string" ? ev.step : "";
      const msg = typeof ev.message === "string" ? ev.message : "";
      if (step && msg && !comicEvents.some((e) => e.startsWith(step))) {
        comicEvents.push(`${step}: ${msg.slice(0, 80)}`);
        log(`  [comic/${step}] ${msg.slice(0, 100)}`);
      }
    },
  );

  const comicMs = Date.now() - tComic;
  const comic = await prisma.comic.findUnique({ where: { id: comicResult.comicId } });
  if (!comic) throw new Error("漫画未入库");

  const doc = parseComicImageUrls(comic.imageUrls);
  const panels = doc.pages.flatMap((p) => p.panels);
  const withImage = panels.filter((p) => p.imageUrl?.trim()).length;
  const englishCaptions = panels.filter((p) => /[A-Za-z]{3,}/.test(p.caption ?? "")).length;
  const chineseLeak = panels.filter((p) => /[\u4e00-\u9fff]/.test(p.caption ?? "")).length;

  log("--- 漫画结果 ---");
  log(`耗时 ${(comicMs / 1000).toFixed(1)}s comicId=${comicResult.comicId}`);
  log(`pipeline=${comicResult.pipeline} needsPanelRender=${comicResult.needsPanelRender}`);
  log(`pages=${doc.pages.length} panels=${panels.length} withImage=${withImage}`);
  log(`英文 caption 格 ${englishCaptions}/${panels.length}, 中文泄漏格 ${chineseLeak}`);

  if (panels.length < 1) throw new Error("无分镜格");
  if (chineseLeak > 0) {
    log(`WARN: ${chineseLeak} 格 caption 含中文（/en/ 下可能泄漏）`);
  }

  for (const ev of comicEvents.slice(0, 12)) {
    if (/[\u4e00-\u9fff]/.test(ev) && UI_LOCALE === "en") {
      log(`WARN: 进度消息含中文: ${ev}`);
    }
  }

  if (!SKIP_PANELS && comicResult.needsPanelRender && withImage === 0) {
    throw new Error("需要配图但未生成任何 panel 图片");
  }

  const keep = process.env.QA_KEEP_ARTIFACTS === "1";
  if (!keep) {
    log("清理测试数据…");
    await prisma.comic.delete({ where: { id: comicResult.comicId } }).catch(() => {});
    await prisma.novel.delete({ where: { id: novel.id } }).catch(() => {});
  } else {
    log(`保留产物: /en/novel/${novel.id} /en/comic/${comicResult.comicId}`);
  }

  await prisma.$disconnect();
  log("\nqa-en-medium-novel-comic-e2e: ok");
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
