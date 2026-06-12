/**
 * 三模块真实 LLM 全流程冒烟（直连 lib，不依赖浏览器）
 * 运行：npx tsx scripts/qa-llm-full-pipeline.ts
 * 可选：SKIP_COMIC_PANELS=1 跳过分镜配图（仅测分镜脚本）
 */
import { generateGameSpecWithMeta } from "@/lib/generate-spec";
import { parseGameSpec } from "@/lib/game-spec";
import { createProjectRecord } from "@/lib/project-create";
import {
  buildNovelUserMessage,
  getNovelSystemPrompt,
  novelLlmMaxOutputTokens,
  novelLlmTemperature,
  novelLlmTimeoutMs,
  novelMinAcceptChars,
} from "@/lib/novel-generate-config";
import { llmNovelText, getActiveProvider, getNovelStyleTextModelCascade } from "@/lib/llm";
import { generateNovelSynopsis } from "@/lib/novel-synopsis";
import { novelLengthConfig } from "@/lib/novel-length";
import { runComicGeneration } from "@/lib/comic-generate-run";
import { parseComicImageUrls } from "@/lib/comic-format";
import { prisma } from "@/lib/prisma";

const OWNER = "qa-llm-e2e";
const SKIP_PANELS = process.env.SKIP_COMIC_PANELS === "1";

type StepResult = { name: string; ok: boolean; ms: number; detail?: string; error?: string };

const results: StepResult[] = [];

function log(msg: string) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

async function step(name: string, fn: () => Promise<string>): Promise<void> {
  const t0 = Date.now();
  log(`▶ ${name}…`);
  try {
    const detail = await fn();
    const ms = Date.now() - t0;
    results.push({ name, ok: true, ms, detail });
    log(`✓ ${name} (${(ms / 1000).toFixed(1)}s) ${detail}`);
  } catch (e) {
    const ms = Date.now() - t0;
    const error = e instanceof Error ? e.message : String(e);
    results.push({ name, ok: false, ms, error });
    log(`✗ ${name} (${(ms / 1000).toFixed(1)}s) ${error}`);
  }
}

async function cleanup(ids: {
  projectId?: string;
  novelId?: string;
  comicId?: string;
}) {
  if (ids.comicId) {
    await prisma.comic.delete({ where: { id: ids.comicId } }).catch(() => {});
  }
  if (ids.novelId) {
    await prisma.novel.deleteMany({ where: { id: ids.novelId, ownerKey: OWNER } }).catch(() => {});
  }
  if (ids.projectId) {
    await prisma.project.delete({ where: { id: ids.projectId } }).catch(() => {});
  }
  await prisma.novel.deleteMany({ where: { ownerKey: OWNER } }).catch(() => {});
  await prisma.project.deleteMany({ where: { ownerKey: OWNER } }).catch(() => {});
}

async function main() {
  log(`LLM provider: ${getActiveProvider()}`);
  if (!process.env.OPENAI_API_KEY?.trim() && getActiveProvider() === "litellm") {
    console.error("缺少 OPENAI_API_KEY，无法跑真实 LLM 测试");
    process.exit(1);
  }

  const ids: { projectId?: string; novelId?: string; comicId?: string } = {};

  await step("游戏 · 规格 JSON 生成", async () => {
    const prompt = "田园小径旁建塔楼，拦住偷萝卜的捣蛋鼠军团";
    const { spec, source } = await generateGameSpecWithMeta(prompt, { enhancePass: false });
    parseGameSpec(spec);
    const row = await createProjectRecord({
      ownerKey: OWNER,
      title: spec.title,
      prompt,
      specJson: JSON.stringify(spec),
    });
    ids.projectId = row.id;
    return `template=${spec.templateId} source=${source} id=${row.id}`;
  });

  await step("小说 · 短篇正文生成", async () => {
    const tier = "short" as const;
    const prompt = "一只会说话的橘猫在便利店值夜班，每晚帮迷路的人找到回家的路";
    const cfg = novelLengthConfig(tier);
    const cascade = getNovelStyleTextModelCascade();
    let content = "";
    let modelUsed = cascade[0]!;
    for (const model of cascade) {
      const result = await llmNovelText(
        {
          model,
          system: getNovelSystemPrompt(tier),
          user: buildNovelUserMessage(prompt, tier),
          temperature: novelLlmTemperature(tier),
          maxTokens: novelLlmMaxOutputTokens(tier),
          timeoutMs: novelLlmTimeoutMs(tier),
        },
        tier,
      );
      if (result.ok && result.text.trim().length >= novelMinAcceptChars(tier)) {
        content = result.text.trim();
        modelUsed = result.model;
        break;
      }
    }
    const min = Math.min(novelMinAcceptChars(tier), cfg.minChars);
    if (content.length < min) {
      throw new Error(`正文过短 ${content.length} < ${min}`);
    }
    const summary = await generateNovelSynopsis({
      model: modelUsed,
      title: "橘猫夜班",
      prompt,
      content,
      lengthTier: tier,
    });
    const novel = await prisma.novel.create({
      data: {
        ownerKey: OWNER,
        title: "橘猫夜班",
        prompt,
        content,
        summary,
        lengthTier: tier,
        status: "ready",
      },
    });
    ids.novelId = novel.id;
    return `${content.length} 字 model=${modelUsed} id=${novel.id}`;
  });

  const comicContent = `=== 第1章 橘猫上岗 ===
橘猫大福被便利店老板录用，负责午夜到清晨的柜台。它用尾巴扫一扫就能知道客人心里缺什么。

=== 第2章 迷路的男孩 ===
雨夜，一个浑身湿透的小男孩推门进来。大福递上热牛奶，带他看了货架尽头的一面旧镜子——镜子里映出通往家的路。

=== 第3章 天亮交班 ===
东方发白，男孩已回家。老板醒来，只见收银台上一排整齐的小鱼干收据。大福舔舔爪子，下班了。`;

  await step("漫画 · 分镜生成" + (SKIP_PANELS ? "" : " + 配图"), async () => {
    const events: string[] = [];
    const result = await runComicGeneration(
      {
        ownerKey: OWNER,
        content: comicContent,
        title: "橘猫夜班·漫画",
        lengthTier: "short",
        pageCount: 1,
        readMode: "segment",
        stylePreset: "watercolor",
      },
      (ev) => {
        const msg = typeof ev.message === "string" ? ev.message : "";
        if (ev.step && msg) events.push(`${ev.step}: ${msg.slice(0, 60)}`);
        if (events.length <= 8 && ev.step) log(`  … ${ev.step} ${msg.slice(0, 80)}`);
      },
    );
    ids.comicId = result.comicId;

    const comic = await prisma.comic.findUnique({ where: { id: result.comicId } });
    if (!comic) throw new Error("漫画未入库");
    if (comic.novelId) ids.novelId = comic.novelId;
    const doc = parseComicImageUrls(comic.imageUrls);
    const panelCount = doc.pages.reduce((n, p) => n + p.panels.length, 0);
    if (panelCount < 1) throw new Error("无分镜格");

    const withImage = doc.pages.flatMap((p) => p.panels).filter((p) => p.imageUrl?.trim()).length;

    if (!SKIP_PANELS && result.needsPanelRender) {
      return `分镜 ${panelCount} 格，需详情页配图 needsPanelRender=true pipeline=${result.pipeline}`;
    }

    return `分镜 ${panelCount} 格，已配图 ${withImage} 格 pipeline=${result.pipeline} needsPanelRender=${result.needsPanelRender}`;
  });

  console.log("\n========== 汇总 ==========");
  let failed = 0;
  for (const r of results) {
    const mark = r.ok ? "OK" : "FAIL";
    const line = r.ok
      ? `${mark}  ${r.name}  ${(r.ms / 1000).toFixed(1)}s  ${r.detail ?? ""}`
      : `${mark}  ${r.name}  ${(r.ms / 1000).toFixed(1)}s  ${r.error ?? ""}`;
    console.log(line);
    if (!r.ok) failed++;
  }

  const keep = process.env.QA_KEEP_ARTIFACTS === "1";
  if (!keep) {
    log("清理测试数据…");
    await cleanup(ids);
  } else {
    log(`保留产物 project=${ids.projectId} novel=${ids.novelId} comic=${ids.comicId}`);
  }

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
