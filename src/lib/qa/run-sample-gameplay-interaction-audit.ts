import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";
import { sampleProjectId } from "@/lib/sample-gallery";
import { expectedPhaserSceneName } from "@/lib/game-templates/runtime";
import type { GameSpec } from "@/lib/game-spec";
import {
  bufferDiffRatio,
  idleDiffCeiling,
  interactionDiffPasses,
} from "@/lib/qa/canvas-interaction-diff";
import {
  defaultClickRel,
  SAMPLE_GAMEPLAY_CASES,
  type SampleGameplayResult,
  type SampleInteractionKind,
} from "@/lib/qa/sample-gameplay-interaction";
import { SAMPLES } from "@/lib/samples";

export async function healthOk(baseUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const url = new URL(`${baseUrl.replace(/\/$/, "")}/api/health`);
      const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
      const req = http.get(
        {
          hostname: url.hostname,
          port,
          path: `${url.pathname}${url.search}`,
          family: 4,
          timeout: 12_000,
        },
        (res) => {
          res.resume();
          resolve((res.statusCode ?? 500) >= 200 && (res.statusCode ?? 500) < 300);
        },
      );
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
      req.on("error", () => resolve(false));
    } catch {
      resolve(false);
    }
  });
}

export async function waitPlayReady(page: Page, timeoutMs = 30_000): Promise<boolean> {
  try {
    await page.waitForFunction(
      () => (window as Window & { __PHASER_PLAY_READY__?: boolean }).__PHASER_PLAY_READY__ === true,
      { timeout: timeoutMs },
    );
    return true;
  } catch {
    return false;
  }
}

export async function readSceneKey(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const game = (window as Window & { __PHASER_QA_GAME__?: import("phaser").Game }).__PHASER_QA_GAME__;
    if (!game) return null;
    const scenes = game.scene.getScenes(true);
    return scenes[0]?.scene?.key ?? null;
  });
}

async function resolveSceneKey(
  page: Page,
  baseUrl: string,
  projectId: string,
  expectedScene: string,
): Promise<{ actualScene: string | null; sceneOk: boolean; sceneSource: "runtime" | "spec" | "none" }> {
  const runtimeScene = await readSceneKey(page);
  if (runtimeScene) {
    return { actualScene: runtimeScene, sceneOk: runtimeScene === expectedScene, sceneSource: "runtime" };
  }

  try {
    const apiRes = await page.request.get(`${baseUrl}/api/projects/${projectId}`);
    if (!apiRes.ok()) return { actualScene: null, sceneOk: false, sceneSource: "none" };
    const data = (await apiRes.json()) as { spec?: GameSpec };
    const specScene = data.spec ? expectedPhaserSceneName(data.spec) : null;
    if (!specScene) return { actualScene: null, sceneOk: false, sceneSource: "none" };
    return { actualScene: specScene, sceneOk: specScene === expectedScene, sceneSource: "spec" };
  } catch {
    return { actualScene: null, sceneOk: false, sceneSource: "none" };
  }
}

export async function performInteraction(
  page: Page,
  kind: SampleInteractionKind,
  clickRel: { x: number; y: number },
  burst = 1,
  clickRel2?: { x: number; y: number },
) {
  const canvas = page.locator("canvas").first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas bounding box missing");

  const clicks = Math.max(1, burst);
  const clickAt = async (rel: { x: number; y: number }) => {
    await canvas.click({
      position: { x: box.width * rel.x, y: box.height * rel.y },
      force: true,
    });
  };

  switch (kind) {
    case "click-center":
    case "click-upper":
    case "click-lower":
      for (let i = 0; i < clicks; i += 1) {
        await clickAt(i === 1 && clickRel2 ? clickRel2 : clickRel);
        if (i < clicks - 1) await page.waitForTimeout(180);
      }
      break;
    case "arrow-right":
    case "arrow-left":
    case "space":
      await canvas.click({
        position: { x: box.width * 0.5, y: box.height * 0.5 },
        force: true,
      });
      break;
    default:
      break;
  }

  switch (kind) {
    case "click-center":
    case "click-upper":
    case "click-lower":
      break;
    case "arrow-right":
      for (let i = 0; i < clicks; i += 1) {
        await page.keyboard.press("ArrowRight");
        if (i < clicks - 1) await page.waitForTimeout(80);
      }
      break;
    case "arrow-left":
      for (let i = 0; i < clicks; i += 1) {
        await page.keyboard.press("ArrowLeft");
        if (i < clicks - 1) await page.waitForTimeout(80);
      }
      break;
    case "space":
      for (let i = 0; i < clicks; i += 1) {
        await page.keyboard.press("Space");
        if (i < clicks - 1) await page.waitForTimeout(80);
      }
      break;
    default:
      break;
  }
}

export async function auditSample(
  page: Page,
  sampleId: string,
  title: string,
  baseUrl: string,
  shotsDir: string,
): Promise<SampleGameplayResult> {
  const c = SAMPLE_GAMEPLAY_CASES.find((x) => x.sampleId === sampleId)!;
  const projectId = sampleProjectId(sampleId);
  const base: SampleGameplayResult = {
    sampleId,
    title,
    projectId,
    apiOk: false,
    canvasOk: false,
    playReadyOk: false,
    sceneOk: false,
    actualScene: null,
    interactionOk: false,
    interactionDiff: 0,
    idleCeiling: 0,
    pass: false,
  };

  try {
    const apiRes = await page.request.get(`${baseUrl}/api/projects/${projectId}`);
    base.apiOk = apiRes.ok();
    if (!apiRes.ok()) {
      base.error = `API HTTP ${apiRes.status()}`;
      return base;
    }

    await page.goto(`${baseUrl}/play/${projectId}`, { waitUntil: "domcontentloaded", timeout: 45_000 });

    const bodyText = await page.locator("body").innerText();
    if (/加载失败|数据不完整|Load failed/i.test(bodyText)) {
      base.error = "play page load error";
      return base;
    }
    if (/继续共创|Continue co-?creat/i.test(bodyText)) {
      base.error = "fell back to AgenticScene (继续共创)";
      return base;
    }

    const canvas = page.locator("canvas").first();
    await canvas.waitFor({ state: "visible", timeout: 30_000 });
    base.canvasOk = true;

    base.playReadyOk = await waitPlayReady(page);
    if (!base.playReadyOk) {
      base.error = "__PHASER_PLAY_READY__ timeout";
      return base;
    }

    const sceneResolved = await resolveSceneKey(page, baseUrl, projectId, c.expectedScene);
    base.actualScene = sceneResolved.actualScene;
    base.sceneOk = sceneResolved.sceneOk;
    if (!base.sceneOk) {
      base.error = `scene ${base.actualScene} !== ${c.expectedScene} (${sceneResolved.sceneSource})`;
      return base;
    }

    const clickRel = c.clickRel ?? defaultClickRel(c.interaction);
    const shotDir = path.join(shotsDir, sampleId);
    fs.mkdirSync(shotDir, { recursive: true });

    const before = await canvas.screenshot();
    fs.writeFileSync(path.join(shotDir, "before.png"), before);

    let idleCeiling = 0;
    if (c.animated) {
      const idleFrames: Buffer[] = [before];
      for (let i = 0; i < 3; i += 1) {
        await page.waitForTimeout(280);
        idleFrames.push(await canvas.screenshot());
      }
      idleCeiling = await idleDiffCeiling(idleFrames);
      base.idleCeiling = idleCeiling;
    }

    await performInteraction(page, c.interaction, clickRel, c.clickBurst ?? 1, c.clickRel2);
    await page.waitForTimeout(c.animated ? 520 : 380);
    const after = await canvas.screenshot();
    fs.writeFileSync(path.join(shotDir, "after.png"), after);

    const interactionDiff = await bufferDiffRatio(before, after);
    base.interactionDiff = interactionDiff;
    base.interactionOk = interactionDiffPasses({
      animated: Boolean(c.animated),
      idleCeiling,
      interactionDiff,
    });

    if (!base.interactionOk) {
      base.error = c.animated
        ? `interaction diff ${interactionDiff.toFixed(3)} <= idle*1.35 (${idleCeiling.toFixed(3)})`
        : `interaction diff ${interactionDiff.toFixed(3)} < static threshold`;
    }

    base.pass = base.apiOk && base.canvasOk && base.playReadyOk && base.sceneOk && base.interactionOk;
    return base;
  } catch (e) {
    base.error = e instanceof Error ? e.message : String(e);
    return base;
  }
}

function writeReport(results: SampleGameplayResult[], baseUrl: string, outDir: string) {
  const passed = results.filter((r) => r.pass).length;
  const lines = [
    "# 样品馆玩法交互验收",
    "",
    `- 时间：${new Date().toISOString()}`,
    `- 目标：${baseUrl}`,
    `- 结果：**${passed}/${results.length} PASS**`,
    "",
    "| 样品 | API | Canvas | Scene | 交互 | diff | 说明 |",
    "|------|-----|--------|-------|------|------|------|",
  ];

  for (const r of results) {
    const note = r.error ?? (r.pass ? "OK" : "FAIL");
    lines.push(
      `| ${r.title} | ${r.apiOk ? "✅" : "❌"} | ${r.canvasOk ? "✅" : "❌"} | ${r.sceneOk ? r.actualScene : "❌"} | ${r.interactionOk ? "✅" : "❌"} | ${r.interactionDiff.toFixed(3)} | ${note} |`,
    );
  }

  lines.push("", "## 试玩链接", "");
  for (const r of results) {
    lines.push(`- [${r.title}](${baseUrl}/play/${r.projectId})`);
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "REPORT.md"), lines.join("\n"));
  fs.writeFileSync(
    path.join(outDir, "summary.json"),
    JSON.stringify({ at: new Date().toISOString(), baseUrl, passed, total: results.length, results }, null, 2),
  );
}

function chromiumLaunchOptions(baseUrl: string): { args: string[] } {
  try {
    const port = new URL(baseUrl).port;
    if (port) return { args: [`--explicitly-allowed-ports=${port}`] };
  } catch {
    /* ignore */
  }
  return { args: [] };
}

export async function runSampleGameplayInteractionAudit(
  baseUrl: string,
  outDir = path.join(process.cwd(), "qa-output", "sample-gameplay-interaction"),
): Promise<SampleGameplayResult[]> {
  const shots = path.join(outDir, "shots");
  const browser = await chromium.launch(chromiumLaunchOptions(baseUrl));
  const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
  const results: SampleGameplayResult[] = [];

  for (const sample of SAMPLES) {
    console.log(`→ ${sample.id}`);
    const r = await auditSample(page, sample.id, sample.title, baseUrl, shots);
    results.push(r);
    console.log(
      `  ${r.pass ? "[OK]" : "[FAIL]"} api=${r.apiOk} canvas=${r.canvasOk} scene=${r.actualScene} interaction=${r.interactionOk}${r.error ? ` · ${r.error}` : ""}`,
    );
  }

  await browser.close();
  writeReport(results, baseUrl, outDir);
  console.log(`\n报告 → ${path.relative(process.cwd(), path.join(outDir, "REPORT.md"))}`);
  return results;
}
