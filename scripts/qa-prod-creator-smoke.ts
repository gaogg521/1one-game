/**
 * 生产实作：小游戏 + 武侠短篇 + 小说转漫画，校验 provenance。
 * $env:QA_PROD_CREATOR_SMOKE="1"; npm run qa:prod-creator-smoke
 */
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const baseUrl = (process.env.QA_BASE_URL ?? "https://operone.1oneclaw.com").replace(/\/$/, "");
const locale = process.env.QA_LOCALE?.trim() || "zh-Hans";
const gamePrompt =
  process.env.QA_GAME_PROMPT?.trim() ||
  "做一个手机单手玩的武侠飞镖躲避小游戏：左右移动躲开暗器，接到三枚令牌过关，前一分钟友好可容错。";
const novelPrompt =
  process.env.QA_NOVEL_PROMPT?.trim() ||
  "写一篇很短的武侠开篇：青城弟子林晚携半卷残谱下山，雨夜客栈里与蒙面人争夺谱中最后一式。要有刀光、江湖规矩和一个反转。";
const outputDir = path.join(process.cwd(), "qa-output", "prod-creator-smoke");

type Stage = { at: string; stage: string; detail: unknown };

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
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

function lastStep(events: Record<string, unknown>[], step: string) {
  return [...events].reverse().find((event) => event.step === step);
}

async function writeReport(stages: Stage[], summary: Record<string, unknown>) {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, "summary.json"), JSON.stringify({ ...summary, stages }, null, 2), "utf8");
  const lines = [
    "# 生产创作实作（游戏 + 武侠小说 + 转漫画）",
    "",
    `- 时间：${new Date().toISOString()}`,
    `- 站点：${baseUrl}`,
    `- 结果：${summary.pass === true ? "通过" : "失败"}`,
    `- 游戏：${String(summary.gamePlayUrl ?? "尚未创建")}`,
    `- 小说：${String(summary.novelUrl ?? "尚未创建")}`,
    `- 漫画：${String(summary.comicUrl ?? "尚未创建")}`,
    "",
    "## 阶段",
    "",
    ...stages.map((entry) => `- ${entry.at} · **${entry.stage}** · \`${JSON.stringify(entry.detail)}\``),
  ];
  await fs.writeFile(path.join(outputDir, "REPORT.md"), lines.join("\n"), "utf8");
}

async function postStream(
  context: import("@playwright/test").BrowserContext,
  url: string,
  data: unknown,
) {
  const cookies = await context.cookies(baseUrl);
  const cookieHeader = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "x-app-locale": locale,
      Cookie: cookieHeader,
    },
    body: JSON.stringify(data),
  });
  const text = await response.text();
  return { ok: response.ok, status: response.status, events: parseSse(text), text };
}

async function main() {
  if (process.env.QA_PROD_CREATOR_SMOKE !== "1") {
    throw new Error("拒绝调用真实模型：请显式设置 QA_PROD_CREATOR_SMOKE=1");
  }

  const stages: Stage[] = [];
  const summary: Record<string, unknown> = { pass: false, baseUrl };
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  context.setDefaultTimeout(15 * 60_000);
  const ownerKey = process.env.QA_OWNER_KEY?.trim();
  if (ownerKey) {
    await context.addCookies([
      { name: "gcreator_owner", value: ownerKey, url: baseUrl },
    ]);
  }
  const page = await context.newPage();
  const request = context.request;

  try {
    await page.goto(`${baseUrl}/${locale}/create`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    stages.push({ at: new Date().toISOString(), stage: "session_ready", detail: { url: page.url() } });

    const skipGame = process.env.QA_SKIP_GAME === "1";
    if (skipGame) {
      stages.push({ at: new Date().toISOString(), stage: "game_skipped", detail: { reason: "QA_SKIP_GAME=1" } });
    } else {
    const gameStream = await postStream(
      context,
      `${baseUrl}/api/generate/stream`,
      { prompt: gamePrompt },
    );
    assert(gameStream.ok, `游戏生成失败：HTTP ${gameStream.status}`);
    const gameDone = lastStep(gameStream.events, "done");
    const gameError = lastStep(gameStream.events, "error");
    assert(!gameError || gameDone, `游戏 SSE 报错：${String(gameError?.message ?? "unknown")}`);
    assert(gameDone?.spec, "游戏 SSE 没有 spec");
    const gameDebug = (gameDone.debug ?? {}) as {
      provider?: string;
      model?: string;
      source?: string;
      fallback?: boolean;
      kernelFallback?: boolean;
      templateHint?: string;
    };
    const gameModel = String(gameDebug.model ?? "").trim();
    assert(gameModel && gameModel !== "mock", `游戏未采到真实模型：${gameModel || "empty"}`);
    summary.gameGeneration = {
      source: gameDone.source ?? gameDebug.source ?? null,
      provider: gameDebug.provider ?? null,
      model: gameDebug.model ?? null,
      kernelFallback: gameDebug.kernelFallback ?? false,
      templateId: (gameDone.spec as { templateId?: string }).templateId ?? null,
    };
    stages.push({ at: new Date().toISOString(), stage: "game_generated", detail: summary.gameGeneration });

    const saveRes = await request.post(`${baseUrl}/api/projects`, {
      headers: { "Content-Type": "application/json", "x-app-locale": locale },
      data: {
        prompt: gamePrompt,
        spec: gameDone.spec,
        debug: gameDebug,
        source: gameDone.source ?? gameDebug.source,
      },
    });
    const saveBody = (await saveRes.json().catch(() => ({}))) as {
      project?: { id?: string; generationProvider?: string | null; generationModel?: string | null; title?: string };
      error?: string;
    };
    assert(saveRes.ok(), `游戏保存失败：HTTP ${saveRes.status()} ${JSON.stringify(saveBody)}`);
    const gameId = saveBody.project?.id;
    assert(gameId, "游戏保存后没有 ID");
    const gameGet = await request.get(`${baseUrl}/api/projects/${encodeURIComponent(gameId)}`);
    const gameDetail = (await gameGet.json()) as {
      project?: { generationProvider?: string | null; generationModel?: string | null; title?: string };
      spec?: { templateId?: string; title?: string };
    };
    assert(gameDetail.project?.generationModel, "游戏 generationModel 未落库");
    assert(gameDetail.project.generationModel !== "mock", "游戏落库模型是 mock");
    summary.gameId = gameId;
    summary.gameTitle = gameDetail.project.title ?? gameDetail.spec?.title;
    summary.gameTemplate = gameDetail.spec?.templateId;
    summary.gamePlayUrl = `${baseUrl}/${locale}/play/${gameId}`;
    summary.gameProvenance = {
      generationProvider: gameDetail.project.generationProvider ?? null,
      generationModel: gameDetail.project.generationModel ?? null,
    };
    stages.push({ at: new Date().toISOString(), stage: "game_saved", detail: { ...summary.gameProvenance, playUrl: summary.gamePlayUrl } });

    await page.goto(String(summary.gamePlayUrl), { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.locator("canvas").first().waitFor({ state: "visible", timeout: 30_000 });
    stages.push({ at: new Date().toISOString(), stage: "game_canvas_visible", detail: { url: page.url() } });
    }

    const resumeNovelId = process.env.QA_NOVEL_ID?.trim();
    let storedNovel: {
      id?: string;
      title?: string;
      content?: string;
      generationProvider?: string | null;
      generationModel?: string | null;
    } | undefined;
    if (resumeNovelId) {
      const novelGet = await request.get(`${baseUrl}/api/novel/${encodeURIComponent(resumeNovelId)}`);
      const novelBody = (await novelGet.json()) as { novel?: typeof storedNovel };
      storedNovel = novelBody.novel;
      assert(storedNovel?.id, `无法读取已有小说 ${resumeNovelId}`);
      stages.push({ at: new Date().toISOString(), stage: "novel_resumed", detail: { id: storedNovel.id } });
    } else {
    const novelStream = await postStream(
      context,
      `${baseUrl}/api/novel/generate/stream`,
      { prompt: novelPrompt, title: "残谱夜雨", lengthTier: "short" },
    );
    assert(novelStream.ok, `小说生成失败：HTTP ${novelStream.status}`);
    const novelDone = lastStep(novelStream.events, "done");
    const novel = (novelDone?.novel ?? {}) as { id?: string };
    assert(novel.id, "小说生成完成但没有 ID");
    const novelGet = await request.get(`${baseUrl}/api/novel/${encodeURIComponent(novel.id)}`);
    const novelBody = (await novelGet.json()) as { novel?: typeof storedNovel };
    storedNovel = novelBody.novel;
    }
    assert(storedNovel?.id, "没有小说 ID");
    assert(storedNovel.content && storedNovel.content.length > 400, `武侠短篇过短：${storedNovel.content?.length ?? 0}`);
    assert(storedNovel.generationModel, "小说 generationModel 未落库");
    assert(storedNovel.generationModel !== "mock", "小说落库模型是 mock");
    summary.novelId = storedNovel.id;
    summary.novelTitle = storedNovel.title;
    summary.novelUrl = `${baseUrl}/${locale}/novel/${storedNovel.id}`;
    summary.novelChars = storedNovel.content.length;
    summary.novelProvenance = {
      generationProvider: storedNovel.generationProvider ?? null,
      generationModel: storedNovel.generationModel ?? null,
    };
    stages.push({
      at: new Date().toISOString(),
      stage: "novel_saved",
      detail: { ...summary.novelProvenance, chars: storedNovel.content.length, url: summary.novelUrl },
    });

    const comicStream = await postStream(
      context,
      `${baseUrl}/api/comic/generate/stream`,
      {
        sourceMode: "from_novel",
        novelId: storedNovel.id,
        pageCount: 2,
        forceLightStoryboard: true,
      },
    );
    assert(comicStream.ok, `漫画生成失败：HTTP ${comicStream.status} ${comicStream.text.slice(0, 400)}`);
    const comicDone = lastStep(comicStream.events, "done");
    const comic = (comicDone?.comic ?? {}) as { id?: string };
    assert(comic.id, "漫画生成完成但没有 ID");
    const comicGet = await request.get(`${baseUrl}/api/comic/${encodeURIComponent(comic.id)}`);
    const comicBody = (await comicGet.json()) as {
      comic?: {
        id?: string;
        title?: string;
        novelId?: string | null;
        generationProvider?: string | null;
        generationModel?: string | null;
      };
    };
    assert(comicBody.comic?.novelId === storedNovel.id, "漫画未绑定该武侠小说");
    assert(comicBody.comic.generationModel, "漫画 generationModel 未落库");
    assert(comicBody.comic.generationModel !== "mock", "漫画落库模型是 mock");
    summary.comicId = comicBody.comic.id;
    summary.comicTitle = comicBody.comic.title;
    summary.comicUrl = `${baseUrl}/${locale}/comic/${comicBody.comic.id}`;
    summary.comicProvenance = {
      generationProvider: comicBody.comic.generationProvider ?? null,
      generationModel: comicBody.comic.generationModel ?? null,
    };
    stages.push({
      at: new Date().toISOString(),
      stage: "comic_saved",
      detail: { ...summary.comicProvenance, url: summary.comicUrl },
    });

    summary.pass = true;
    await writeReport(stages, summary);
    console.log(JSON.stringify(summary, null, 2));
    console.log("[OK] qa:prod-creator-smoke");
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
