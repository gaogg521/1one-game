/**
 * 宋辽穿越题材 — 小说（短/中/长/儿童）+ 漫画改编 E2E
 * 运行：npx tsx scripts/qa-songliao-literary-regression.ts
 *
 * 可选环境变量：
 *   SKIP_COMIC_PANELS=1     跳过分镜配图
 *   QA_COMIC_PAGES=4        漫画页数
 *   QA_NOVEL_TIERS=short,medium   只跑指定档位
 *   QA_SKIP_COMIC=1         只验小说，不跑漫画
 *   QA_SKIP_CHAR_SHEETS=1   漫画跳过人设参考图文生图（避免 char-sheet 卡住）
 *   QA_CHAR_SHEET_TIMEOUT_MS=120000  单角色参考图超时（默认 120s）
 *   QA_COMIC_TIMEOUT_MS=900000       整段漫画改编超时（默认 15min）
 *   QA_COMIC_NOVEL_ID=xxx   跳过小说生成，仅用已有中篇/短篇跑漫画
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { childrenBodyWithinTier } from "@/lib/children-novel-postprocess";
import { assessNovelCompleteness, type NovelCompletenessReport } from "@/lib/novel-completeness";
import { generateChildrenNovelRaw } from "@/lib/novel-completeness-repair";
import { parseNovelChapters } from "@/lib/novel-chapters";
import { finalizeChildrenNovelContent } from "@/lib/children-novel-postprocess";
import { runComicGeneration } from "@/lib/comic-generate-run";
import { parseComicImageUrls } from "@/lib/comic-format";
import { COMIC_DEFAULT_PAGES } from "@/lib/comic-generate-config";
import { inferStoryGenre } from "@/lib/cover-genre";
import { getActiveProvider, getNovelStyleTextModelCascade } from "@/lib/llm";
import { novelMinAcceptChars } from "@/lib/novel-generate-config";
import { generateNovelSynopsis } from "@/lib/novel-synopsis";
import { streamPlannedNovelBody } from "@/lib/novel-planned-generate";
import {
  generateLongNovelBody,
  planLongNovelSegments,
} from "@/lib/novel-long-generate";
import { persistChildrenNovelMeta } from "@/lib/children-novel-meta-db";
import { persistNovelLengthTier } from "@/lib/novel-length-tier-db";
import {
  isChildrenNovelTier,
  parseChildrenTargetAge,
  type NovelLengthTier,
} from "@/lib/novel-length";
import { prisma } from "@/lib/prisma";

const OWNER = "qa-songliao-regression";
const TITLE = "我穿越到了宋辽之战的战场";
const UI_LOCALE = "zh-Hans" as const;
const OUT = path.join(process.cwd(), "qa-output", "songliao-regression");
const SKIP_PANELS = process.env.SKIP_COMIC_PANELS === "1";
const SKIP_COMIC = process.env.QA_SKIP_COMIC === "1";
const SKIP_CHAR_SHEETS = process.env.QA_SKIP_CHAR_SHEETS === "1";
const CHAR_SHEET_TIMEOUT_MS = Number(process.env.QA_CHAR_SHEET_TIMEOUT_MS ?? "120000");
const COMIC_TIMEOUT_MS = Number(process.env.QA_COMIC_TIMEOUT_MS ?? "900000");
const COMIC_ONLY_NOVEL_ID = process.env.QA_COMIC_NOVEL_ID?.trim() || undefined;
const COMIC_PAGES = Number(process.env.QA_COMIC_PAGES ?? String(COMIC_DEFAULT_PAGES.medium));
const TIER_FILTER = process.env.QA_NOVEL_TIERS?.split(",")
  .map((s) => s.trim())
  .filter(Boolean) as NovelLengthTier[] | undefined;

const PROMPTS: Record<NovelLengthTier, string> = {
  short:
    "写一个完整短篇：现代人意外穿越到宋辽之战前线，以旁观者与小人物视角亲历澶渊之盟前后数日。" +
    "必须有明确结局与收束，禁止「未完待续」。",
  medium:
    "写一个完整中篇：工科青年穿越到宋真宗时期宋辽战场，从溃兵到参与议和斡旋。" +
    "写清战争、人性、历史抉择，末章必须收束，禁止断章。",
  long:
    "写一个完整长篇：现代人穿越成宋军书吏，亲历澶州之战与澶渊之盟全过程，穿插朝堂与前线。" +
    "多线叙事但主线清晰，最后一章必须给出结局与余韵，禁止「且听下回分解」。",
  children:
    "写一个给 7–9 岁孩子看的完整小故事：小朋友梦见穿越到古代宋辽战场，遇到一位保护百姓的宋军哥哥，" +
    "最后平安回家。语言温暖、无血腥细节，必须有完整结局。",
};

type TierResult = {
  tier: NovelLengthTier;
  ok: boolean;
  novelId?: string;
  chars?: number;
  chapters?: number;
  genre?: string;
  completeness?: string;
  ms?: number;
  error?: string;
};

function log(msg: string) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  if (!Number.isFinite(ms) || ms <= 0) return promise;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(
        () => reject(new Error(`${label} 超时（${Math.round(ms / 1000)}s）`)),
        ms,
      );
    }),
  ]);
}

async function generateNovelTier(tier: NovelLengthTier, model: string): Promise<TierResult> {
  const t0 = Date.now();
  const prompt = PROMPTS[tier];
  const lengthOpts =
    tier === "children"
      ? { childrenTargetAge: parseChildrenTargetAge(8), childrenUserPrompt: prompt }
      : undefined;

  log(`▶ 小说 [${tier}] 生成开始…`);
  try {
    let content = "";
    let pipelineMeta: Awaited<ReturnType<typeof streamPlannedNovelBody>>["pipelineMeta"] | null = null;
    let pipelineCompleteness: NovelCompletenessReport | undefined;

    if (tier === "long") {
      const plan = planLongNovelSegments("long");
      const longResult = await generateLongNovelBody({
        model,
        promptTrim: prompt,
        titleTrim: TITLE,
        plan,
        lengthTier: "long",
        uiLocale: UI_LOCALE,
        polish: false,
      });
      content = longResult.content;
      pipelineMeta = longResult.pipelineMeta;
      pipelineCompleteness = longResult.completeness;
    } else if (isChildrenNovelTier(tier)) {
      content = await generateChildrenNovelRaw({
        model,
        promptTrim: prompt,
        titleTrim: TITLE,
        lengthOpts,
        uiLocale: UI_LOCALE,
        emit: (ev) => {
          const step = typeof ev.step === "string" ? ev.step : "";
          if (step === "children_expand" || step === "delta") {
            log(`  [${tier}/${step}]`);
          }
        },
      });
      pipelineMeta = null;
    } else {
      const planned = await streamPlannedNovelBody({
        model,
        promptTrim: prompt,
        titleTrim: TITLE,
        lengthTier: tier,
        lengthOpts,
        uiLocale: UI_LOCALE,
        emit: (ev) => {
          const step = typeof ev.step === "string" ? ev.step : "";
          if (["bible_ready", "chapter_plan_ready", "missing_chapters_fill", "completion_pass"].includes(step)) {
            log(`  [${tier}/${step}] ${(ev as { message?: string }).message ?? ""}`);
          }
        },
      });
      content = planned.content;
      pipelineMeta = planned.pipelineMeta;
      pipelineCompleteness = planned.completeness;
    }

    let finalTitle = TITLE;
    let finalContent = content;
    let childrenBody: string | undefined;

    if (isChildrenNovelTier(tier) && lengthOpts?.childrenTargetAge !== undefined) {
      const age = parseChildrenTargetAge(lengthOpts.childrenTargetAge);
      const finalized = finalizeChildrenNovelContent(finalContent, {
        targetAge: age,
        fallbackTitle: TITLE,
        userPrompt: prompt,
        uiLocale: UI_LOCALE,
      });
      finalTitle = finalized.dbTitle;
      finalContent = finalized.publishedContent;
      childrenBody = finalized.body;
      if (!childrenBodyWithinTier(finalized.body, age)) {
        throw new Error(
          `儿童正文字数不在档位区间: ${finalized.body.length} 字（目标 ${age} 档）`,
        );
      }
    }

    const minAccept = novelMinAcceptChars(tier, lengthOpts);
    const completeness =
      pipelineCompleteness ??
      assessNovelCompleteness(
        finalContent,
        tier,
        lengthOpts,
        prompt,
        isChildrenNovelTier(tier) ? null : pipelineMeta?.chapterPlan,
        UI_LOCALE,
      );

    const chapters = parseNovelChapters(finalContent);
    const genre = inferStoryGenre({
      title: finalTitle,
      prompt,
      contentSnippet: (childrenBody ?? finalContent).slice(0, 1200),
    });

    if (finalContent.length < minAccept) {
      throw new Error(`字数不足 ${finalContent.length} < ${minAccept}`);
    }
    if (!completeness.ok) {
      throw new Error(`完整性失败: ${completeness.reason}`);
    }

    const summary = await generateNovelSynopsis({
      model,
      title: finalTitle,
      prompt,
      content: finalContent,
      lengthTier: tier,
    });

    const novel = await prisma.novel.create({
      data: {
        ownerKey: OWNER,
        title: finalTitle,
        prompt: `《${TITLE}》·${tier === "children" ? "儿童" : "历史穿越"}`,
        content: finalContent,
        summary,
        lengthTier: tier,
        status: "ready",
        visibility: "public",
      },
    });
    await persistNovelLengthTier(novel.id, tier);

    if (isChildrenNovelTier(tier) && lengthOpts?.childrenTargetAge !== undefined) {
      await persistChildrenNovelMeta(novel.id, {
        kind: "children",
        targetAge: parseChildrenTargetAge(lengthOpts.childrenTargetAge),
        maxChars: finalContent.length,
      });
    }

    const ms = Date.now() - t0;
    log(`✅ [${tier}] id=${novel.id} ${finalContent.length}字 ${chapters.length}章 genre=${genre} (${(ms / 1000).toFixed(0)}s)`);
    return {
      tier,
      ok: true,
      novelId: novel.id,
      chars: finalContent.length,
      chapters: chapters.length,
      genre,
      completeness: completeness.ok ? "ok" : completeness.reason,
      ms,
    };
  } catch (e) {
    const ms = Date.now() - t0;
    const error = e instanceof Error ? e.message : String(e);
    log(`❌ [${tier}] ${error} (${(ms / 1000).toFixed(0)}s)`);
    return { tier, ok: false, error, ms };
  }
}

async function generateComicFromNovel(novelId: string, model: string) {
  const t0 = Date.now();
  log(`▶ 漫画改编 [from_novel] pages=${COMIC_PAGES}…`);
  if (SKIP_CHAR_SHEETS) log("  QA_SKIP_CHAR_SHEETS=1 → 跳过人设参考图");
  if (CHAR_SHEET_TIMEOUT_MS > 0) log(`  char-sheet 单角色超时 ${CHAR_SHEET_TIMEOUT_MS / 1000}s`);
  if (COMIC_TIMEOUT_MS > 0) log(`  漫画总超时 ${COMIC_TIMEOUT_MS / 1000}s`);

  const novel = await prisma.novel.findUnique({ where: { id: novelId } });
  if (!novel) throw new Error("novel not found");

  const result = await withTimeout(
    runComicGeneration(
      {
        ownerKey: OWNER,
        sourceMode: "from_novel",
        novelId,
        title: novel.title,
        content: novel.content,
        lengthTier: novel.lengthTier ?? "medium",
        pageCount: COMIC_PAGES,
        readMode: "segment",
        stylePreset: "chinese_wuxia",
        uiLocale: UI_LOCALE,
        skipCharSheets: SKIP_CHAR_SHEETS,
        charSheetTimeoutMs: SKIP_CHAR_SHEETS ? undefined : CHAR_SHEET_TIMEOUT_MS,
      },
      (ev) => {
        const step = typeof ev.step === "string" ? ev.step : "";
        const msg = typeof ev.message === "string" ? ev.message : "";
        if (
          step &&
          msg &&
          [
            "start",
            "pipeline_mode",
            "light_chunk_start",
            "light_chunk_done",
            "storyboard",
            "done",
            "panels",
            "char_sheets_skip",
            "char_sheets_deferred",
            "char_sheets_start",
            "char_sheets_done",
          ].includes(step)
        ) {
          log(`  [comic/${step}] ${msg.slice(0, 80)}`);
        }
      },
    ),
    COMIC_TIMEOUT_MS,
    "漫画改编",
  );

  const comic = await prisma.comic.findUnique({ where: { id: result.comicId } });
  if (!comic) throw new Error("comic missing");
  const doc = parseComicImageUrls(comic.imageUrls);
  const panels = doc.pages.flatMap((p) => p.panels);
  const withImage = panels.filter((p) => p.imageUrl?.trim()).length;
  const ms = Date.now() - t0;

  log(
    `✅ 漫画 id=${result.comicId} pages=${doc.pages.length} panels=${panels.length} ` +
      `images=${withImage} pipeline=${result.pipeline} (${(ms / 1000).toFixed(0)}s)`,
  );

  if (panels.length < 1) throw new Error("无分镜格");
  if (!SKIP_PANELS && result.needsPanelRender && withImage === 0) {
    throw new Error("需要配图但未生成图片");
  }

  return { comicId: result.comicId, pages: doc.pages.length, panels: panels.length, withImage, ms };
}

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim() && getActiveProvider() === "litellm") {
    console.error("缺少 OPENAI_API_KEY");
    process.exit(1);
  }

  fs.mkdirSync(OUT, { recursive: true });
  const cascade = getNovelStyleTextModelCascade();
  const model = cascade[0];
  if (!model) throw new Error("无可用小说模型");

  log(`provider=${getActiveProvider()} model=${model} owner=${OWNER}`);
  log(`title=${TITLE}`);
  if (SKIP_COMIC) log("QA_SKIP_COMIC=1 → 仅验证小说四档，跳过漫画改编");
  if (COMIC_ONLY_NOVEL_ID) log(`QA_COMIC_NOVEL_ID=${COMIC_ONLY_NOVEL_ID} → 跳过小说生成`);

  const tiers: NovelLengthTier[] =
    TIER_FILTER?.length ? TIER_FILTER : ["short", "medium", "long", "children"];
  log(`tiers=${COMIC_ONLY_NOVEL_ID ? "(跳过)" : tiers.join(",")}`);
  const novelResults: TierResult[] = [];

  if (COMIC_ONLY_NOVEL_ID) {
    const existing = await prisma.novel.findUnique({
      where: { id: COMIC_ONLY_NOVEL_ID },
      select: { lengthTier: true },
    });
    const tier = (existing?.lengthTier as NovelLengthTier | null) ?? "medium";
    novelResults.push({ tier, ok: true, novelId: COMIC_ONLY_NOVEL_ID });
  } else {
    for (const tier of tiers) {
      novelResults.push(await generateNovelTier(tier, model));
    }
  }

  let comicResult: Awaited<ReturnType<typeof generateComicFromNovel>> | null = null;
  const medium = novelResults.find((r) => r.tier === "medium" && r.ok && r.novelId);
  const comicSource =
    medium?.novelId ?? novelResults.find((r) => r.tier === "short" && r.ok && r.novelId)?.novelId;
  if (SKIP_COMIC) {
    log("⚠ QA_SKIP_COMIC=1，跳过漫画改编");
  } else if (comicSource) {
    try {
      comicResult = await generateComicFromNovel(comicSource, model);
    } catch (e) {
      log(`❌ 漫画改编失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    log("⚠ 中篇/短篇均未成功，跳过漫画改编");
  }

  const summary = {
    at: new Date().toISOString(),
    title: TITLE,
    owner: OWNER,
    model,
    skipPanels: SKIP_PANELS,
    skipCharSheets: SKIP_CHAR_SHEETS,
    charSheetTimeoutMs: SKIP_CHAR_SHEETS ? null : CHAR_SHEET_TIMEOUT_MS,
    comicTimeoutMs: COMIC_TIMEOUT_MS,
    comicPages: COMIC_PAGES,
    novels: novelResults,
    comic: comicResult,
    urls: {
      mediumNovel: medium?.novelId ? `/comic/create?novelId=${medium.novelId}` : null,
      comic: comicResult?.comicId ? `/comic/${comicResult.comicId}` : null,
    },
    pass: novelResults.every((r) => r.ok) && (SKIP_COMIC || Boolean(comicResult)),
  };

  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
  log("\n--- 回归摘要 ---");
  for (const r of novelResults) {
    log(`${r.ok ? "OK" : "FAIL"} ${r.tier}${r.novelId ? ` → /novel/${r.novelId}` : ""}${r.error ? ` (${r.error})` : ""}`);
  }
  if (comicResult) {
    log(`OK comic → /comic/${comicResult.comicId}#storyboard-outline`);
  } else {
    log("FAIL comic");
  }
  log(`报告: ${path.join(OUT, "summary.json")}`);

  await prisma.$disconnect();
  if (!summary.pass) process.exit(1);
  log("\nqa-songliao-literary-regression: ok");
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
