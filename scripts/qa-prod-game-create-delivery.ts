import fs from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";

const baseUrl = (process.env.QA_BASE_URL ?? "https://operone.1oneclaw.com").replace(/\/$/, "");
const locale = process.env.QA_LOCALE?.trim() || "zh-Hans";
const prompt = process.env.QA_GAME_PROMPT?.trim() ||
  "做一个手机单手玩的萤火虫护送小游戏：手指左右移动，引导萤火虫穿过夜森林，避开蜘蛛网，收集三颗月光种子，前60秒友好且有三次容错，随后进入高潮并在90秒内明确胜负；环境有虫鸣和风声，越接近终点音乐越紧张，胜利时转为温暖旋律。";
const outputDir = path.join(process.cwd(), "qa-output", "prod-game-create-delivery");

type StageRecord = { at: string; stage: string; detail: unknown };
type ProjectDetail = {
  project?: {
    id?: string;
    title?: string;
    visibility?: string;
    workflow?: { stage?: string };
    quality?: unknown;
    generationProvider?: string | null;
    generationModel?: string | null;
  };
  spec?: { templateId?: string; title?: string; agenticPlayRoute?: "dedicated" | "agentic" };
  playRevisionId?: string;
  assetJob?: { id?: string; status?: string; progress?: unknown };
  core?: { revision?: { id?: string; status?: string; artifacts?: Array<{ kind?: string; content?: unknown; storageUri?: string | null }> } };
};

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function writeReport(stages: StageRecord[], summary: Record<string, unknown>) {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, "summary.json"), JSON.stringify({ ...summary, stages }, null, 2), "utf8");
  const lines = [
    "# 生产环境新游戏全链路验收",
    "",
    `- 时间：${new Date().toISOString()}`,
    `- 站点：${baseUrl}`,
    `- 结果：${summary.pass === true ? "通过" : "失败"}`,
    `- 项目：${String(summary.projectId ?? "尚未创建")}`,
    `- 试玩：${String(summary.playUrl ?? "—")}`,
    `- 模板：${String(summary.templateId ?? "—")}`,
    `- 版本：${String(summary.revisionId ?? "—")}`,
    "",
    "## 阶段记录",
    "",
    ...stages.map((entry) => `- ${entry.at} · **${entry.stage}** · \`${JSON.stringify(entry.detail)}\``),
  ];
  await fs.writeFile(path.join(outputDir, "REPORT.md"), lines.join("\n"), "utf8");
}

async function readProject(page: Page, projectId: string): Promise<ProjectDetail> {
  const response = await page.request.get(`${baseUrl}/api/projects/${encodeURIComponent(projectId)}`);
  const body = await response.json().catch(() => ({})) as ProjectDetail;
  assert(response.ok(), `读取项目失败：HTTP ${response.status()} ${JSON.stringify(body)}`);
  return body;
}

async function waitForDeliveryArtifacts(page: Page, projectId: string, stages: StageRecord[]): Promise<ProjectDetail> {
  const required = [
    "game_spec",
    "game_production_pipeline",
    "game_delivery_preflight",
    "asset_manifest",
    "game_art_direction",
    "runtime_build_manifest",
    "game_production_candidate",
    "gameplay_acceptance_contract",
  ];
  const deadline = Date.now() + 10 * 60_000;
  let lastKinds: string[] = [];
  while (Date.now() < deadline) {
    const detail = await readProject(page, projectId);
    const kinds = (detail.core?.revision?.artifacts ?? []).map((item) => item.kind ?? "").filter(Boolean);
    const bgmReady = kinds.includes("bgm") || kinds.includes("bgm_notes");
    lastKinds = kinds;
    if (detail.core?.revision?.status === "ready" && required.every((kind) => kinds.includes(kind)) && bgmReady && !detail.assetJob) {
      stages.push({ at: new Date().toISOString(), stage: "delivery_artifacts_ready", detail: { kinds } });
      return detail;
    }
    stages.push({
      at: new Date().toISOString(),
      stage: "delivery_artifacts_wait",
      detail: { revisionStatus: detail.core?.revision?.status ?? "missing", assetJob: detail.assetJob?.status ?? "none", kinds },
    });
    await page.waitForTimeout(5_000);
  }
  throw new Error(`交付制品等待超时：${lastKinds.join(",")}`);
}

async function waitForObservedPlaytestArtifacts(page: Page, projectId: string, stages: StageRecord[]): Promise<ProjectDetail> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const detail = await readProject(page, projectId);
    const kinds = (detail.core?.revision?.artifacts ?? []).map((item) => item.kind ?? "").filter(Boolean);
    if (kinds.includes("game_playtest_first_minute") && kinds.includes("game_playtest_delivery")) {
      stages.push({ at: new Date().toISOString(), stage: "observed_playtest_artifacts_ready", detail: { kinds } });
      return detail;
    }
    await page.waitForTimeout(2_000);
  }
  throw new Error("真实试玩已完成，但首分钟/交付证据没有在 90 秒内持久化");
}

async function verifyRuntimeAssets(page: Page, detail: ProjectDetail, stages: StageRecord[]) {
  const manifestArtifact = detail.core?.revision?.artifacts?.find((item) => item.kind === "asset_manifest");
  const content = manifestArtifact?.content as {
    backgroundUrl?: unknown;
    sprites?: Array<{ kind?: unknown; url?: unknown }>;
    artDirection?: { kind?: unknown; requiredAssetSlots?: unknown };
  } | undefined;
  assert(content?.artDirection?.kind === "game_art_direction", "资产清单缺少可执行美术方向");
  const artSlots = content.artDirection.requiredAssetSlots;
  assert(
    Array.isArray(artSlots) && ["background", "player", "enemy"].every((slot) => artSlots.includes(slot)),
    "美术方向未覆盖背景、主角和敌人",
  );
  const requiredUrls = [
    typeof content?.backgroundUrl === "string" ? content.backgroundUrl : null,
    ...(content?.sprites ?? [])
      .filter((entry) => entry.kind === "player" || entry.kind === "hazard")
      .map((entry) => typeof entry.url === "string" ? entry.url : null),
  ].filter((url): url is string => Boolean(url));
  assert(requiredUrls.length >= 3, "资产清单缺少背景、玩家或敌人 URL");
  for (const url of requiredUrls) {
    const response = await page.request.get(`${baseUrl}${url}`);
    assert(response.ok(), `运行时资源不可访问：${url} HTTP ${response.status()}`);
    assert((response.headers()["content-type"] ?? "").startsWith("image/"), `运行时资源类型错误：${url}`);
    assert(response.headers()["x-operone-asset-fallback"] !== "1", `交付完成后仍在使用临时资源：${url}`);
  }
  stages.push({ at: new Date().toISOString(), stage: "runtime_assets_verified", detail: { urls: requiredUrls } });
}

function verifyProductionVisualDelivery(detail: ProjectDetail, stages: StageRecord[]) {
  const artifacts = detail.core?.revision?.artifacts ?? [];
  const candidate = artifacts.find((item) => item.kind === "game_production_candidate")?.content as {
    decision?: unknown;
    blockers?: unknown;
  } | undefined;
  assert(candidate?.decision === "ready_for_playtest", `生产候选未准入试玩：${JSON.stringify(candidate?.blockers ?? [])}`);

  const runtime = artifacts.find((item) => item.kind === "runtime_build_manifest")?.content as {
    route?: unknown;
    visualContract?: { ok?: unknown; blockers?: unknown; evidence?: unknown };
  } | undefined;
  assert(runtime, "缺少运行时构建清单");
  if (detail.spec?.agenticPlayRoute === "agentic") {
    assert(runtime.route === "agentic", "复杂游戏没有进入专属运行时路线");
    assert(runtime.visualContract?.ok === true, `专属运行时视觉契约未通过：${JSON.stringify(runtime.visualContract?.blockers ?? [])}`);
  }
  stages.push({
    at: new Date().toISOString(),
    stage: "production_visual_delivery_verified",
    detail: {
      route: detail.spec?.agenticPlayRoute ?? runtime.route ?? "unknown",
      candidate: candidate.decision,
      visualContract: runtime.visualContract ?? null,
    },
  });
}

async function playUntilDeliveryEvidence(page: Page, stages: StageRecord[], templateId?: string) {
  const events: Array<Record<string, unknown>> = [];
  page.on("request", (request) => {
    if (!request.url().includes("/api/gameplay/events") || request.method() !== "POST") return;
    try {
      const payload = request.postDataJSON() as Record<string, unknown>;
      events.push(payload);
      const event = String(payload.event ?? "unknown");
      if (["start", "first_action", "first_minute", "end", "retry"].includes(event)) {
        stages.push({ at: new Date().toISOString(), stage: `gameplay_${event}`, detail: payload });
      }
    } catch {
      // Malformed telemetry will be caught by the missing-evidence assertion.
    }
  });

  await page.locator("canvas").first().waitFor({ state: "visible", timeout: 30_000 });
  const startedAt = Date.now();
  let outcome: string | null = null;
  while (Date.now() - startedAt < 150_000) {
    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    if (box) {
      if (templateId === "dou-dizhu") {
        const elapsed = Date.now() - startedAt;
        // 首轮主动抢到地主；随后每次先点“提示”再点“出牌”。坐标是
        // DouDizhuScene 固定的底部操作栏，不能用随机 Canvas 点击冒充出牌。
        if (elapsed < 4_000) {
          await page.keyboard.press("Digit3").catch(() => undefined);
        } else {
          const actionY = box.y + box.height * 0.84;
          await page.touchscreen.tap(box.x + box.width * 0.52, actionY).catch(() => undefined);
          await page.touchscreen.tap(box.x + box.width * 0.73, actionY).catch(() => undefined);
          await page.keyboard.press("KeyP").catch(() => undefined);
        }
      } else {
        const phase = Math.floor((Date.now() - startedAt) / 1_200) % 4;
        const x = box.x + box.width * ([0.22, 0.78, 0.35, 0.65][phase] ?? 0.5);
        const y = box.y + box.height * (phase % 2 === 0 ? 0.72 : 0.45);
        await page.touchscreen.tap(x, y).catch(() => undefined);
        await page.mouse.move(x, y).catch(() => undefined);
        await page.keyboard.press(phase % 2 === 0 ? "ArrowLeft" : "ArrowRight").catch(() => undefined);
      }
    }
    const result = page.locator("[data-outcome]").first();
    if (await result.isVisible().catch(() => false)) {
      outcome = await result.getAttribute("data-outcome");
      const hasMinute = events.some((event) => event.event === "first_minute");
      if (hasMinute) break;
      const retry = page.getByTestId("game-result-restart").or(page.getByRole("button", { name: /再来一局|重开|重试|再来一次|重新开始|retry/i })).first();
      if (await retry.isVisible().catch(() => false)) await retry.click();
    }
    await page.waitForTimeout(1_000);
  }

  const firstMinute = events.find((event) => event.event === "first_minute");
  const end = [...events].reverse().find((event) => event.event === "end" && typeof event.won === "boolean");
  assert(firstMinute, "真实手机试玩未产生 first_minute 事件");
  assert((Number(firstMinute.activeMs) || 0) >= 60_000, "前台活跃时长不足 60 秒");
  assert((Number(firstMinute.actionCount) || 0) >= 3, "有效操作不足 3 次");
  assert(firstMinute.deviceClass === "mobile" && firstMinute.touchCapable === true, "未记录为可触控手机试玩");
  assert(end, "真实试玩未产生明确胜负结算");
  stages.push({ at: new Date().toISOString(), stage: "mobile_play_complete", detail: { outcome, firstMinute, end } });
}

async function main() {
  if (process.env.QA_PROD_GAME_CREATE !== "1") {
    throw new Error("拒绝调用真实模型和发布：请显式设置 QA_PROD_GAME_CREATE=1");
  }

  const stages: StageRecord[] = [];
  const summary: Record<string, unknown> = { pass: false, baseUrl, prompt };
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") stages.push({ at: new Date().toISOString(), stage: "browser_console_error", detail: message.text() });
  });

  const dumpFailure = async (label: string) => {
    try {
      await fs.mkdir(outputDir, { recursive: true });
      await page.screenshot({ path: path.join(outputDir, `${label}.png`), fullPage: true });
      const visible = await page.locator("main").innerText().catch(() => "");
      stages.push({
        at: new Date().toISOString(),
        stage: "failure_dump",
        detail: { label, url: page.url(), visible: visible.slice(0, 2_000) },
      });
    } catch (dumpError) {
      stages.push({
        at: new Date().toISOString(),
        stage: "failure_dump_error",
        detail: dumpError instanceof Error ? dumpError.message : String(dumpError),
      });
    }
  };

  try {
    await page.goto(`${baseUrl}/${locale}/create`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    assert(await page.locator("textarea").first().isVisible(), "创作输入框不可见");
    assert((await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)), "创作页手机端横向溢出");
    stages.push({ at: new Date().toISOString(), stage: "create_page_ready", detail: { url: page.url() } });

    const promptInput = page.locator("textarea").first();
    const generateButton = page.getByRole("button", { name: /生成可玩版本/i });
    // A production navigation can expose server-rendered controls a fraction
    // before React attaches. A human cannot type that quickly, so wait for the
    // interactive layer and verify the controlled value before submission.
    await page.waitForTimeout(1_200);
    await promptInput.fill(prompt);
    if (!(await generateButton.isEnabled())) {
      await page.waitForTimeout(800);
      await promptInput.click();
      await promptInput.fill("");
      await promptInput.pressSequentially(prompt, { delay: 1 });
    }
    assert((await promptInput.inputValue()) === prompt, "创作输入没有进入 React 受控状态");
    assert(await generateButton.isEnabled(), "输入有效创意后生成按钮仍不可用");

    let generationBody = "";
    const captureSse = (response: { url: () => string; request: () => { method: () => string }; text: () => Promise<string> }) => {
      if (!response.url().includes("/api/generate/stream") || response.request().method() !== "POST") return;
      void response.text()
        .then((text) => {
          if (text) generationBody = text;
        })
        .catch((error) => {
          stages.push({
            at: new Date().toISOString(),
            stage: "sse_body_unavailable",
            detail: error instanceof Error ? error.message : String(error),
          });
        });
    };
    page.on("response", captureSse);

    const generationResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/api/generate/stream") && response.request().method() === "POST",
      { timeout: 5 * 60_000 },
    );
    await generateButton.click();
    await generationResponsePromise;
    stages.push({ at: new Date().toISOString(), stage: "generation_started", detail: { promptChars: prompt.length } });

    const saveButton = page.getByRole("button", { name: /保存并打开/i });
    // Draft/enhance each cap at 300s; brief + critic can add another minute or two.
    const saveWaitMs = Number(process.env.QA_GAME_SAVE_WAIT_MS) || 12 * 60_000;
    try {
      await saveButton.waitFor({ state: "visible", timeout: saveWaitMs });
    } catch (waitError) {
      await dumpFailure("save-button-timeout");
      throw waitError;
    }
    assert(await saveButton.isEnabled(), "生成完成但保存按钮不可用");
    for (let i = 0; i < 20 && !generationBody.includes('"step":"done"'); i += 1) {
      await page.waitForTimeout(250);
    }
    const generationEvents = generationBody
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data: "))
      .map((line) => {
        try { return JSON.parse(line.slice(6)) as Record<string, unknown>; } catch { return null; }
      })
      .filter((entry): entry is Record<string, unknown> => Boolean(entry));
    const generationDone = [...generationEvents].reverse().find((entry) => entry.step === "done");
    const generationDebug = generationDone?.debug as {
      fallback?: unknown;
      kernelFallback?: unknown;
      fallbackReason?: unknown;
      provider?: unknown;
      model?: unknown;
    } | undefined;
    const routedModel = String(generationDebug?.model ?? "").trim();
    const modelLooksRouted =
      routedModel.length > 0 &&
      routedModel !== "mock" &&
      routedModel !== "kernel";
    summary.generation = {
      source: generationDone?.source ?? null,
      fallback: generationDebug?.fallback ?? null,
      kernelFallback: generationDebug?.kernelFallback ?? null,
      fallbackReason: generationDebug?.fallbackReason ?? null,
      provider: generationDebug?.provider ?? null,
      model: generationDebug?.model ?? null,
    };
    stages.push({ at: new Date().toISOString(), stage: "model_generation_verified", detail: summary.generation });
    if (generationBody) {
      assert(generationDone, "生成 SSE 缺少完成帧");
      assert(modelLooksRouted, `游戏正文模型未打通：${routedModel || "empty"}`);
      assert(
        generationDebug?.fallback !== true || generationDebug?.kernelFallback === true,
        `游戏正文模型未打通：${String(generationDebug?.fallbackReason ?? "unknown fallback")}`,
      );
    } else {
      stages.push({
        at: new Date().toISOString(),
        stage: "sse_body_skipped",
        detail: "Playwright 无法读取长 SSE 响应体，改在保存后校验落库模型",
      });
    }
    const previewTitle = (await page.locator("main h2").first().textContent())?.trim() ?? "";
    const deferredRuntime = page.getByTestId("bespoke-runtime-required").first();
    if (await deferredRuntime.isVisible().catch(() => false)) {
      // Arena-family games intentionally fail closed before persistence: their
      // real module is generated in the POST /api/projects production pass.
      // The creation flow must save and build that module, not require the
      // retired geometry fallback to render a preview canvas.
      stages.push({ at: new Date().toISOString(), stage: "bespoke_runtime_build_deferred", detail: { previewTitle } });
    } else {
      const previewCanvas = page.locator("canvas").first();
      if (await previewCanvas.isVisible().catch(() => false)) {
        stages.push({ at: new Date().toISOString(), stage: "playable_preview_ready", detail: { previewTitle } });
      } else {
        // The persisted play URL remains the acceptance surface. Do not block
        // its production build merely because a client-side preview chunk is
        // late; public mobile verification below still requires a real canvas.
        stages.push({ at: new Date().toISOString(), stage: "preview_canvas_deferred", detail: { previewTitle } });
      }
    }

    await Promise.all([
      page.waitForURL(/\/play\//, { timeout: 90_000 }),
      saveButton.click(),
    ]);
    const projectId = decodeURIComponent(page.url().split("/play/")[1]?.split(/[?#]/)[0] ?? "");
    assert(projectId, "保存后没有获得项目 ID");
    summary.projectId = projectId;
    summary.playUrl = page.url();
    stages.push({ at: new Date().toISOString(), stage: "project_saved", detail: { projectId, playUrl: page.url() } });

    const created = await readProject(page, projectId);
    let revisionId = created.playRevisionId ?? created.core?.revision?.id;
    assert(revisionId, "项目缺少不可变创意版本");
    assert(created.project?.generationModel, "游戏 generationModel 未落库，后台将显示未记录");
    assert(created.project.generationModel !== "mock", "游戏落库模型是 mock，正文模型路由未生效");
    summary.persistedGeneration = {
      generationProvider: created.project.generationProvider ?? null,
      generationModel: created.project.generationModel ?? null,
    };
    stages.push({
      at: new Date().toISOString(),
      stage: "generation_provenance_persisted",
      detail: summary.persistedGeneration,
    });
    if (!generationBody) {
      assert(created.project.generationModel !== "kernel", "SSE 丢失后落库模型仍是 kernel，无法证明正文路由生效");
    }
    summary.revisionId = revisionId;
    summary.templateId = created.spec?.templateId;
    summary.title = created.project?.title ?? created.spec?.title ?? previewTitle;
    stages.push({
      at: new Date().toISOString(),
      stage: "core_revision_ready",
      detail: { revisionId, templateId: created.spec?.templateId, assetJob: created.assetJob?.status ?? "none" },
    });

    const ready = await waitForDeliveryArtifacts(page, projectId, stages);
    revisionId = ready.core?.revision?.id ?? revisionId;
    summary.revisionId = revisionId;
    await verifyRuntimeAssets(page, ready, stages);
    verifyProductionVisualDelivery(ready, stages);
    // Saving intentionally opens a draft preview immediately. Acceptance must
    // reload the immutable ready revision after every production Agent has
    // finished; otherwise the generic preview pollutes playtest telemetry.
    await page.goto(`${baseUrl}/${locale}/play/${encodeURIComponent(projectId)}`, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    stages.push({ at: new Date().toISOString(), stage: "ready_candidate_reloaded", detail: { revisionId } });
    try {
      await playUntilDeliveryEvidence(page, stages, ready.spec?.templateId);
    } catch (playError) {
      await dumpFailure("play-timeout");
      throw playError;
    }
    const observedReady = await waitForObservedPlaytestArtifacts(page, projectId, stages);
    const artifacts = observedReady.core?.revision?.artifacts ?? [];
    summary.artifacts = artifacts.map((item) => item.kind).filter(Boolean);
    summary.bgmSource = artifacts.find((item) => item.kind === "bgm")?.storageUri ? "audio_model" : "llm_notes";

    const publishResponse = await page.request.post(`${baseUrl}/api/works/game/${encodeURIComponent(projectId)}/publication`, {
      data: { action: "publish", revisionId },
    });
    const publishBody = await publishResponse.json().catch(() => ({})) as Record<string, unknown>;
    assert(publishResponse.ok(), `发布门禁拒绝：HTTP ${publishResponse.status()} ${JSON.stringify(publishBody)}`);
    assert(publishBody.visibility === "public", "发布成功响应未返回 public");
    stages.push({ at: new Date().toISOString(), stage: "published", detail: publishBody });

    const publicContext = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
    const publicPage = await publicContext.newPage();
    const publicResponse = await publicPage.goto(`${baseUrl}/${locale}/play/${encodeURIComponent(projectId)}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    assert(publicResponse?.ok(), `公开试玩页不可访问：HTTP ${publicResponse?.status() ?? "none"}`);
    await publicPage.locator("canvas").first().waitFor({ state: "visible", timeout: 30_000 });
    assert(await publicPage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), "公开试玩页手机端横向溢出");
    await publicContext.close();
    stages.push({ at: new Date().toISOString(), stage: "public_mobile_verified", detail: { playUrl: `${baseUrl}/${locale}/play/${projectId}` } });

    summary.pass = true;
    await writeReport(stages, summary);
    console.log(JSON.stringify(summary, null, 2));
    console.log("[OK] qa:prod-game-create-delivery");
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
