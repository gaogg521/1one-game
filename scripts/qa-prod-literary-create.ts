import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const baseUrl = (process.env.QA_BASE_URL ?? "https://operone.1oneclaw.com").replace(/\/$/, "");
const locale = process.env.QA_LOCALE?.trim() || "zh-Hans";
const novelPrompt =
  process.env.QA_NOVEL_PROMPT?.trim() ||
  "写一个很短的江湖开篇：雨夜客栈里，一把青伞挡住了追兵，店小二发现伞骨里藏着一封密信。";
const outputDir = path.join(process.cwd(), "qa-output", "prod-literary-create");

type StageRecord = { at: string; stage: string; detail: unknown };

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function writeReport(stages: StageRecord[], summary: Record<string, unknown>) {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, "summary.json"), JSON.stringify({ ...summary, stages }, null, 2), "utf8");
  const lines = [
    "# 生产环境小说与小说转漫画验收",
    "",
    `- 时间：${new Date().toISOString()}`,
    `- 站点：${baseUrl}`,
    `- 结果：${summary.pass === true ? "通过" : "失败"}`,
    `- 小说：${String(summary.novelId ?? "尚未创建")}`,
    `- 漫画：${String(summary.comicId ?? "尚未创建")}`,
    "",
    "## 阶段记录",
    "",
    ...stages.map((entry) => `- ${entry.at} · **${entry.stage}** · \`${JSON.stringify(entry.detail)}\``),
  ];
  await fs.writeFile(path.join(outputDir, "REPORT.md"), lines.join("\n"), "utf8");
}

function parseSse(text: string): Record<string, unknown>[] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data: "))
    .map((line) => {
      try {
        return JSON.parse(line.slice(6)) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is Record<string, unknown> => Boolean(entry));
}

async function main() {
  if (process.env.QA_PROD_LITERARY_CREATE !== "1") {
    throw new Error("拒绝调用真实模型和发布：请显式设置 QA_PROD_LITERARY_CREATE=1");
  }

  const stages: StageRecord[] = [];
  const summary: Record<string, unknown> = { pass: false, baseUrl, novelPrompt };
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") {
      stages.push({ at: new Date().toISOString(), stage: "browser_console_error", detail: message.text() });
    }
  });

  try {
    await page.goto(`${baseUrl}/${locale}/novel/create`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    assert(await page.locator("textarea, input").first().isVisible(), "小说创作页输入框不可见");
    stages.push({ at: new Date().toISOString(), stage: "novel_create_page_ready", detail: { url: page.url() } });

    const novelResponse = await page.request.post(`${baseUrl}/api/novel/generate/stream`, {
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "x-app-locale": locale,
      },
      data: {
        prompt: novelPrompt,
        title: "青伞密信",
        lengthTier: "short",
      },
      timeout: 12 * 60_000,
    });
    const novelHeaders = novelResponse.headers();
    assert(novelResponse.ok(), `小说生成失败：HTTP ${novelResponse.status()}`);
    assert(
      (novelHeaders["x-accel-buffering"] ?? "").toLowerCase() === "no",
      "小说 SSE 缺少 X-Accel-Buffering: no",
    );
    const novelEvents = parseSse(await novelResponse.text());
    const modelStart = [...novelEvents].reverse().find((event) => event.step === "model_start");
    const novelDone = [...novelEvents].reverse().find((event) => event.step === "done");
    const novel = (novelDone?.novel ?? {}) as {
      id?: string;
      title?: string;
      generationProvider?: string | null;
      generationModel?: string | null;
      content?: string;
    };
    assert(modelStart?.model, "小说 SSE 没有 model_start，模型路由可能未生效");
    assert(novel.id, "小说生成完成但没有作品 ID");
    summary.novelId = novel.id;
    summary.novelModel = {
      sseModel: modelStart.model,
      generationProvider: novel.generationProvider ?? null,
      generationModel: novel.generationModel ?? null,
    };
    stages.push({ at: new Date().toISOString(), stage: "novel_generated", detail: summary.novelModel });

    const novelDetail = await page.request.get(`${baseUrl}/api/novel/${encodeURIComponent(novel.id)}`);
    const novelBody = (await novelDetail.json().catch(() => ({}))) as {
      novel?: {
        id?: string;
        generationProvider?: string | null;
        generationModel?: string | null;
        content?: string;
        isOwner?: boolean;
      };
    };
    assert(novelDetail.ok(), `读取小说失败：HTTP ${novelDetail.status()}`);
    const storedNovel = novelBody.novel;
    assert(storedNovel?.content && storedNovel.content.length > 400, "短篇小说正文过短，生成可能走了降级");
    assert(storedNovel.generationModel, "小说 generationModel 未落库，后台将显示未记录");
    assert(storedNovel.generationModel !== "mock", "小说落库模型是 mock，模型路由未生效");
    assert(
      storedNovel.generationModel === String(modelStart.model) ||
        String(storedNovel.generationModel).includes(String(modelStart.model)),
      `小说落库模型 ${storedNovel.generationModel} 与 SSE 路由 ${String(modelStart.model)} 不一致`,
    );
    stages.push({
      at: new Date().toISOString(),
      stage: "novel_provenance_persisted",
      detail: {
        generationProvider: storedNovel.generationProvider,
        generationModel: storedNovel.generationModel,
        chars: storedNovel.content.length,
      },
    });

    await page.goto(`${baseUrl}/${locale}/comic/create?novelId=${encodeURIComponent(novel.id)}`, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await page.getByTestId("comic-create-selected-novel").waitFor({ state: "visible", timeout: 30_000 });
    stages.push({ at: new Date().toISOString(), stage: "comic_from_novel_ui_ready", detail: { url: page.url() } });

    const comicResponse = await page.request.post(`${baseUrl}/api/comic/generate/stream`, {
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "x-app-locale": locale,
      },
      data: {
        sourceMode: "from_novel",
        novelId: novel.id,
        pageCount: 2,
        forceLightStoryboard: true,
      },
      timeout: 12 * 60_000,
    });
    const comicHeaders = comicResponse.headers();
    assert(comicResponse.ok(), `漫画生成失败：HTTP ${comicResponse.status()}`);
    assert(
      (comicHeaders["x-accel-buffering"] ?? "").toLowerCase() === "no",
      "漫画 SSE 缺少 X-Accel-Buffering: no",
    );

    const comicEvents = parseSse(await comicResponse.text());
    const comicModelStart = [...comicEvents].reverse().find((event) => event.step === "model_start");
    const comicDone = [...comicEvents].reverse().find((event) => event.step === "done");
    const comic = (comicDone?.comic ?? {}) as { id?: string };
    assert(comicModelStart?.model, "漫画 SSE 没有 model_start，分镜模型路由可能未生效");
    assert(comic.id, "漫画生成完成但没有作品 ID");
    summary.comicId = comic.id;
    summary.comicModel = {
      sseModel: comicModelStart.model,
      sseProvider: comicDone?.provider ?? null,
      sseDoneModel: comicDone?.model ?? null,
    };
    stages.push({ at: new Date().toISOString(), stage: "comic_generated", detail: summary.comicModel });

    const comicDetail = await page.request.get(`${baseUrl}/api/comic/${encodeURIComponent(comic.id)}`);
    const comicBody = (await comicDetail.json().catch(() => ({}))) as {
      comic?: {
        novelId?: string | null;
        generationProvider?: string | null;
        generationModel?: string | null;
      };
    };
    assert(comicDetail.ok(), `读取漫画失败：HTTP ${comicDetail.status()}`);
    assert(comicBody.comic?.novelId === novel.id, "漫画详情未绑定小说");
    assert(comicBody.comic.generationModel, "漫画 generationModel 未落库，后台将显示未记录");
    assert(comicBody.comic.generationModel !== "mock", "漫画落库模型是 mock，分镜模型路由未生效");
    stages.push({
      at: new Date().toISOString(),
      stage: "comic_provenance_persisted",
      detail: {
        novelId: comicBody.comic.novelId,
        generationProvider: comicBody.comic.generationProvider,
        generationModel: comicBody.comic.generationModel,
      },
    });

    summary.pass = true;
    await writeReport(stages, summary);
    console.log(JSON.stringify(summary, null, 2));
    console.log("[OK] qa:prod-literary-create");
  } catch (error) {
    summary.error = error instanceof Error ? error.message : String(error);
    await writeReport(stages, summary);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
