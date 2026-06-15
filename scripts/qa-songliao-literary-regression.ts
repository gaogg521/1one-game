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
 *   DATABASE_URL=file:./dev.db  须与 dev 服务一致（勿用 file:./prisma/dev.db）
 *   QA_COMIC_NOVEL_ID=xxx   跳过小说生成，仅用已有小说跑漫画
 *   QA_COMIC_RESUME_ID=xxx  仅对已有漫画跑配图（lib 或 http）
 *   QA_PANEL_RENDER_MODE=lib|http  配图方式（默认 lib，与 DATABASE_URL 同源）
 */
import "dotenv/config";
process.env.UNDICI_HEADERS_TIMEOUT = process.env.UNDICI_HEADERS_TIMEOUT ?? "0";
process.env.UNDICI_BODY_TIMEOUT = process.env.UNDICI_BODY_TIMEOUT ?? "0";
import fs from "node:fs";
import path from "node:path";
import { applyLiteraryQaDatabaseUrl, warnLiteraryQaEnv } from "@/lib/database-url";
import { childrenBodyWithinTier } from "@/lib/children-novel-postprocess";
import { assessNovelCompleteness, type NovelCompletenessReport } from "@/lib/novel-completeness";
import { generateChildrenNovelRaw } from "@/lib/novel-completeness-repair";
import { parseNovelChapters } from "@/lib/novel-chapters";
import { finalizeChildrenNovelContent } from "@/lib/children-novel-postprocess";
import { runComicGeneration } from "@/lib/comic-generate-run";
import { parseComicImageUrls } from "@/lib/comic-format";
import { renderComicPanelsUntilComplete, type PanelRenderMode } from "@/lib/qa/literary-panel-render";
import { COMIC_DEFAULT_PAGES } from "@/lib/comic-generate-config";
import { PRODUCT } from "@/lib/product-config";
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
import {
  buildFullMediumSummary,
  resolveCachedMediumNovelId,
  resolveSongliaoSummaryAlias,
  syncFullMediumSummaryIfComplete,
} from "@/lib/qa/songliao-regression-artifacts";

const DATABASE_URL = applyLiteraryQaDatabaseUrl();

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
const COMIC_RESUME_ID = process.env.QA_COMIC_RESUME_ID?.trim() || undefined;
const PANEL_STREAM_BASE = process.env.QA_PANEL_STREAM_BASE?.trim() || "http://127.0.0.1:8888";
const PANEL_RENDER_MODE = (process.env.QA_PANEL_RENDER_MODE?.trim() || "lib") as PanelRenderMode;
const PANEL_STREAM_MAX_PASSES = Math.min(6, Math.max(1, Number(process.env.QA_PANEL_STREAM_MAX_PASSES ?? "4") || 4));
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

function panelRenderLabel(): string {
  return PANEL_RENDER_MODE === "lib" ? "lib 直调 renderComicPanels" : "HTTP panels/stream";
}

async function renderPanelsUntilComplete(comicId: string, expectedTotal: number) {
  return renderComicPanelsUntilComplete({
    comicId,
    ownerKey: OWNER,
    expectedTotal,
    mode: PANEL_RENDER_MODE,
    baseUrl: PANEL_STREAM_BASE,
    maxPasses: PANEL_STREAM_MAX_PASSES,
    uiLocale: UI_LOCALE,
    onPassStart: ({ pass, maxPasses }) => {
      log(`▶ 配图 ${panelRenderLabel()} 第 ${pass}/${maxPasses} 轮…`);
    },
    onProgress: (line) => {
      if (line.startsWith("仍缺")) {
        log(`  ${line}`);
      } else if (line) {
        log(`  [panel_done] ${line.slice(0, 60)}`);
      }
    },
  });
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

  let withImageFinal = withImage;
  let panelStreamMs = 0;
  if (
    !SKIP_PANELS &&
    withImage < panels.length &&
    (result.needsPanelRender || panels.length > (PRODUCT.comic.inlinePanelMaxCount ?? 16))
  ) {
    log(`▶ 分镜已入库，启动配图 ${panelRenderLabel()}（目标 ${panels.length} 格）…`);
    const streamed = await renderPanelsUntilComplete(result.comicId, panels.length);
    panelStreamMs = streamed.totalMs;
    const comicAfter = await prisma.comic.findUnique({ where: { id: result.comicId } });
    if (comicAfter) {
      const docAfter = parseComicImageUrls(comicAfter.imageUrls);
      withImageFinal = docAfter.pages
        .flatMap((p) => p.panels)
        .filter((p) => p.imageUrl?.trim()).length;
    } else {
      withImageFinal = streamed.withImage;
    }
    log(`✅ 配图 ${withImageFinal}/${panels.length} (${(panelStreamMs / 1000).toFixed(0)}s)`);
  }

  if (!SKIP_PANELS && withImageFinal === 0 && panels.length > 4) {
    throw new Error("需要配图但未生成图片");
  }

  return {
    comicId: result.comicId,
    pages: doc.pages.length,
    panels: panels.length,
    withImage: withImageFinal,
    ms: Date.now() - t0,
    panelStreamMs,
    pipeline: result.pipeline,
  };
}

function writeSummary(name: string, summary: Record<string, unknown>) {
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(summary, null, 2));
}

function enrichResumeSummary(
  summary: Record<string, unknown>,
  novelId: string | null | undefined,
): Record<string, unknown> {
  const id = novelId ?? resolveCachedMediumNovelId();
  if (!id) return summary;
  const novels = summary.novels as unknown[];
  if (Array.isArray(novels) && novels.length > 0) return summary;
  return {
    ...summary,
    novels: [{ tier: "medium", ok: true, novelId: id }],
    urls: {
      ...(typeof summary.urls === "object" && summary.urls !== null ? summary.urls : {}),
      mediumNovel: `/comic/create?novelId=${id}`,
      comic: summary.comic
        ? `/comic/${(summary.comic as { comicId?: string }).comicId}`
        : undefined,
    },
  };
}

function writeNamedSummaries(summary: Record<string, unknown>, opts: {
  comicResumeId?: string;
  skipComic: boolean;
  skipPanels: boolean;
  tiers: string[];
}) {
  writeSummary("summary.json", summary);
  const alias = resolveSongliaoSummaryAlias({
    comicResumeId: opts.comicResumeId,
    skipComic: opts.skipComic,
    skipPanels: opts.skipPanels,
    tiers: opts.tiers,
    comicPages: COMIC_PAGES,
  });
  if (!alias) return;
  if (alias === "full-medium-summary.json") {
    writeSummary(alias, buildFullMediumSummary(summary));
  } else {
    writeSummary(alias, summary);
  }
  log(`别名报告: ${path.join(OUT, alias)}`);
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
  log(`DATABASE_URL=${DATABASE_URL}`);
  warnLiteraryQaEnv({ panelRenderMode: PANEL_RENDER_MODE, skipComic: SKIP_COMIC });
  log(`title=${TITLE}`);
  if (SKIP_PANELS) log("SKIP_COMIC_PANELS=1 → 跳过分镜配图");
  if (SKIP_CHAR_SHEETS) log("QA_SKIP_CHAR_SHEETS=1 → 跳过人设参考图");
  if (SKIP_COMIC) log("QA_SKIP_COMIC=1 → 仅验证小说四档，跳过漫画改编");
  if (COMIC_ONLY_NOVEL_ID) log(`QA_COMIC_NOVEL_ID=${COMIC_ONLY_NOVEL_ID} → 跳过小说生成`);
  if (COMIC_RESUME_ID) log(`QA_COMIC_RESUME_ID=${COMIC_RESUME_ID} → 仅跑配图 (${PANEL_RENDER_MODE})`);
  if (!SKIP_PANELS && !SKIP_COMIC) log(`panelRenderMode=${PANEL_RENDER_MODE}`);

  const tiers: NovelLengthTier[] =
    TIER_FILTER?.length ? TIER_FILTER : ["short", "medium", "long", "children"];
  log(`tiers=${COMIC_ONLY_NOVEL_ID || COMIC_RESUME_ID ? "(跳过)" : tiers.join(",")}`);
  const novelResults: TierResult[] = [];

  if (COMIC_RESUME_ID && COMIC_ONLY_NOVEL_ID) {
    log("⚠ QA_COMIC_RESUME_ID 与 QA_COMIC_NOVEL_ID 同时存在，优先 resume 配图");
  }

  if (COMIC_RESUME_ID) {
    const existing = await prisma.comic.findUnique({
      where: { id: COMIC_RESUME_ID },
      select: { imageUrls: true, novelId: true },
    });
    if (!existing) throw new Error("comic not found for resume");
    const doc = parseComicImageUrls(existing.imageUrls);
    const panelCount = doc.pages.flatMap((p) => p.panels).length;
    const streamed = await renderPanelsUntilComplete(COMIC_RESUME_ID, panelCount);
    const comicAfter = await prisma.comic.findUnique({ where: { id: COMIC_RESUME_ID } });
    const withImage = comicAfter
      ? parseComicImageUrls(comicAfter.imageUrls).pages.flatMap((p) => p.panels).filter((p) => p.imageUrl?.trim()).length
      : streamed.withImage;
    const comicResult = {
      comicId: COMIC_RESUME_ID,
      pages: doc.pages.length,
      panels: panelCount,
      withImage,
      ms: streamed.totalMs,
      panelStreamMs: streamed.totalMs,
      pipeline: "resume_panels",
    };
    const summary = {
      at: new Date().toISOString(),
      title: TITLE,
      owner: OWNER,
      model,
      databaseUrl: DATABASE_URL,
      panelRenderMode: PANEL_RENDER_MODE,
      skipPanels: false,
      skipCharSheets: SKIP_CHAR_SHEETS,
      novels: [],
      comic: comicResult,
      pass: withImage >= panelCount,
    };
    writeNamedSummaries(summary, { comicResumeId: COMIC_RESUME_ID, skipComic: true, skipPanels: false, tiers: [] });
    if (syncFullMediumSummaryIfComplete(enrichResumeSummary(summary, existing.novelId))) {
      log("已同步 full-medium-summary.json（32/32 满格）");
    }
    log(`OK comic panels ${withImage}/${panelCount}`);
    await prisma.$disconnect();
    if (!summary.pass) process.exit(1);
    log("\nqa-songliao-literary-regression: ok");
    return;
  } else if (COMIC_ONLY_NOVEL_ID) {
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
    databaseUrl: DATABASE_URL,
    panelRenderMode: PANEL_RENDER_MODE,
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

  const effectiveTiers = COMIC_ONLY_NOVEL_ID
    ? [novelResults.find((r) => r.novelId)?.tier ?? "medium"]
    : COMIC_RESUME_ID
      ? []
      : tiers;

  writeNamedSummaries(summary, {
    comicResumeId: undefined,
    skipComic: SKIP_COMIC,
    skipPanels: SKIP_PANELS,
    tiers: effectiveTiers,
  });
  if (
    !SKIP_COMIC &&
    !SKIP_PANELS &&
    comicResult &&
    comicResult.withImage >= comicResult.panels
  ) {
    if (syncFullMediumSummaryIfComplete(summary)) {
      log("已同步 full-medium-summary.json");
    }
  }
  log("\n--- 回归摘要 ---");
  for (const r of novelResults) {
    log(`${r.ok ? "OK" : "FAIL"} ${r.tier}${r.novelId ? ` → /novel/${r.novelId}` : ""}${r.error ? ` (${r.error})` : ""}`);
  }
  if (comicResult) {
    log(`OK comic → /comic/${comicResult.comicId}#storyboard-outline (${comicResult.withImage}/${comicResult.panels} 配图)`);
  } else if (SKIP_COMIC) {
    log("SKIP comic（QA_SKIP_COMIC=1）");
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
