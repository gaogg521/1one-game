/** 五个旗舰模板移动 H5 交付验收：真实输入、状态变化、活跃一分钟、胜负和重开。 */
import type { Locator } from "@playwright/test";
import { expect, test, type Page } from "./test";
import { mockSpecFromPrompt } from "@/lib/mock-spec";
import { ensureOwnerSession } from "./helpers/owner";
import { gotoPlay } from "./helpers/play";
import { waitPlayReady } from "@/lib/qa/run-sample-gameplay-interaction-audit";

test.describe.configure({ mode: "serial", timeout: 210_000 });
const FLAGSHIPS = [
  { templateId: "avoider", prompt: "躲开从天而降的陨石" },
  { templateId: "puzzle", prompt: "色彩消除益智 match3" },
  { templateId: "physics", prompt: "打击 dummy 假人解压" },
  { templateId: "platformer", prompt: "横版闯关跳跃收集钥匙过关" },
  { templateId: "farming", prompt: "治愈农场经营，种植、浇水并收获作物" },
] as const;
type FlagshipId = (typeof FLAGSHIPS)[number]["templateId"];
type QaState = Record<string, number | string | boolean>;

function tune(spec: ReturnType<typeof mockSpecFromPrompt>, id: FlagshipId) {
  const s: any = spec;
  if (id === "avoider") {
    // One real collision after the verified active minute must deterministically
    // reach the normal loss/restart path; the active phase still has to dodge.
    s.gameplay.lives = 8;
    s.gameplay.playerSpeed = 520;
    s.gameplay.hazardSpeed = 80;
    s.gameplay.spawnIntervalMs = 2200;
    s.gameplay.winScore = 200;
    // Keep this delivery fixture deterministic: it still uses the production
    // avoider runtime and real touch collisions, but does not let the generic
    // hard-quality pass overwrite its controlled first-minute balance.
    s.samplePlayProfile = {
      ...(s.samplePlayProfile ?? {}),
      variantId: s.samplePlayProfile?.variantId ?? "delivery-avoider",
    };
    if (s.director) {
      s.director.intensity = 0.12;
      s.director.acts = s.director.acts?.map((act: any) => ({ ...act, modifiers: [] }));
      s.director.events = s.director.events?.map((event: any) => ({ ...event, strength: 0.1, durationMs: 800 }));
    }
    s.avoider = {
      ...(s.avoider ?? {}),
      bulletPatterns: [
        { at: 0.2, pattern: "aimed", density: 1, speedMul: 0.5 },
        { at: 0.82, pattern: "gate", density: 1, speedMul: 0.5 },
      ],
      finalBarrageDurationMs: 5000,
      grazingDistancePx: 18,
      grazingBonus: 1,
      focusModeEnabled: false,
    };
  } else if (id === "puzzle") {
    s.puzzle = { ...(s.puzzle ?? {}), mode: "match3", matchMechanic: "swap", moveLimit: 4, targetScore: 9999 };
  } else if (id === "physics") {
    s.gameplay.winScore = 200;
    if (s.samplePlayProfile) delete s.samplePlayProfile.physics;
  } else if (id === "platformer") {
    // The minute-long idle onboarding remains safe; one life then makes the
    // post-minute traversal produce a deterministic real win-or-loss outcome.
    s.gameplay.lives = 1;
    s.gameplay.playerSpeed = 320;
    s.gameplay.jumpStrength = 560;
    s.platformer = {
      ...(s.platformer ?? {}),
      doubleJump: true,
      worldWidth: 3600,
      levelLayers: 32,
      suggestedWinScore: 24,
      levelStyle: "speedrun",
    };
  } else {
    s.farming = { ...(s.farming ?? {}), harvestGoal: 3, crops: s.farming?.crops?.map((crop: any) => ({ ...crop, growSec: 2 })) };
    s.samplePlayProfile = {
      ...(s.samplePlayProfile ?? {}),
      variantId: s.samplePlayProfile?.variantId ?? "delivery-farming",
      farming: { autoWater: true },
    };
  }
  return s;
}

async function createProject(page: Page, f: (typeof FLAGSHIPS)[number]) {
  const spec = tune(mockSpecFromPrompt(f.prompt), f.templateId);
  const res = await page.request.post("/api/projects", { data: { prompt: f.prompt, spec } });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = (await res.json()) as { project?: { id?: string } };
  expect(body.project?.id).toBeTruthy();
  return { id: body.project!.id!, templateId: f.templateId };
}

const readQa = (page: Page): Promise<QaState> => page.evaluate(() => ({ ...(window.__PHASER_QA_STATE__ ?? {}) }));
async function clickRel(canvas: Locator, x: number, y: number) {
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Phaser canvas has no bounding box");
  await canvas.click({ position: { x: box.width * x, y: box.height * y }, force: true });
}
async function holdRel(canvas: Locator, x: number, y: number, ms: number) {
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Phaser canvas has no bounding box");
  const page = canvas.page();
  await page.mouse.move(box.x + box.width * x, box.y + box.height * y);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}
async function clickHint(page: Page, canvas: Locator, index: number) {
  await expect.poll(() => page.evaluate((i) => Boolean(window.__PHASER_QA_CLICKS__?.[i]), index), { timeout: 15_000 }).toBeTruthy();
  const hint = await page.evaluate((i) => window.__PHASER_QA_CLICKS__?.[i] ?? null, index);
  if (!hint) throw new Error(`missing QA click hint ${index}`);
  await clickRel(canvas, hint.x, hint.y);
}
async function hitDummy(page: Page, canvas: Locator) {
  const p = await page.evaluate(() => {
    const state = window.__PHASER_QA_STATE__ ?? {};
    const scene = window.__PHASER_QA_GAME__?.scene.getScenes(true)[0];
    const w = scene?.scale.width ?? 920, h = scene?.scale.height ?? 560;
    return { x: Number(state.targetX ?? w / 2) / w, y: Number(state.targetY ?? h * 0.48) / h };
  });
  await clickRel(canvas, p.x, p.y);
}

async function validPuzzleSwap(page: Page, canvas: Locator) {
  const pair = await page.evaluate(() => {
    const scene = window.__PHASER_QA_GAME__?.scene.getScenes(true)[0] as any;
    const grid = scene?.grid as number[][] | undefined;
    if (!grid?.length || !grid[0]?.length) return null;
    const rows = grid.length, cols = grid[0].length;
    const hasLine = (g: number[][]) => {
      for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) {
        if (c + 2 < cols && g[r][c] === g[r][c + 1] && g[r][c] === g[r][c + 2]) return true;
        if (r + 2 < rows && g[r][c] === g[r + 1][c] && g[r][c] === g[r + 2][c]) return true;
      }
      return false;
    };
    for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) for (const [dr, dc] of [[0, 1], [1, 0]]) {
      const rr = r + dr, cc = c + dc;
      if (rr >= rows || cc >= cols) continue;
      const copy = grid.map((row) => [...row]);
      [copy[r][c], copy[rr][cc]] = [copy[rr][cc], copy[r][c]];
      if (hasLine(copy)) {
        const point = (row: number, col: number) => ({ x: (scene.ox + (col + 0.5) * scene.cell) / scene.scale.width, y: (scene.oy + (row + 0.5) * scene.cell) / scene.scale.height });
        return [point(r, c), point(rr, cc)];
      }
    }
    return null;
  });
  if (!pair) return false;
  await clickRel(canvas, pair[0].x, pair[0].y);
  await clickRel(canvas, pair[1].x, pair[1].y);
  await page.waitForTimeout(350);
  return true;
}

async function warmup(id: FlagshipId, page: Page, canvas: Locator) {
  if (id === "farming") {
    for (let i = 0; i < 3; i += 1) await clickHint(page, canvas, i);
    await expect.poll(async () => Number((await readQa(page)).plantedTiles ?? 0)).toBeGreaterThanOrEqual(3);
  } else if (id === "physics") {
    for (let i = 0; i < 3; i += 1) { await hitDummy(page, canvas); await page.waitForTimeout(180); }
    await expect.poll(async () => Number((await readQa(page)).hits ?? 0)).toBeGreaterThanOrEqual(3);
  } else if (id === "puzzle") {
    expect(await validPuzzleSwap(page, canvas)).toBeTruthy();
    await clickHint(page, canvas, 0);
    await expect.poll(async () => Number((await readQa(page)).puzzleMoves ?? 0)).toBeGreaterThanOrEqual(1);
  } else if (id === "platformer") {
    const before = Number((await readQa(page)).playerX ?? 0);
    await holdRel(canvas, 0.82, 0.62, 650);
    await expect.poll(async () => Number((await readQa(page)).playerX ?? 0)).toBeGreaterThan(before + 20);
    await clickRel(canvas, 0.86, 0.92);
    await expect.poll(async () => String((await readQa(page)).actorState ?? ""), { timeout: 2_000 }).toBe("jump");
    // Count a third real touch without steering toward another obstacle. The
    // minute phase is an observation window, not a scripted suicide run.
    await clickRel(canvas, 0.5, 0.55);
  } else {
    for (let i = 0; i < 3; i += 1) { await clickRel(canvas, i % 2 ? 0.2 : 0.88, 0.76); await page.waitForTimeout(200); }
  }
}

async function activeMinute(id: FlagshipId, page: Page, canvas: Locator) {
  const started = Date.now();
  const targetMs = Number(process.env.FLAGSHIP_ACTIVE_MS ?? 61_500);
  while (Date.now() - started < targetMs) {
    const elapsed = Date.now() - started;
    if (id === "avoider") {
      const q = await readQa(page);
      const width = await page.evaluate(() => Number(window.__PHASER_QA_GAME__?.scene.getScenes(true)[0]?.scale.width ?? 393));
      if (Number(q.nearestHazardDistance ?? -1) >= 0 && Number(q.nearestHazardDistance) < 360) {
        let direction = Number(q.nearestHazardX) < Number(q.playerX) ? 1 : -1;
        if (Number(q.playerX) < 80) direction = 1;
        if (Number(q.playerX) > width - 80) direction = -1;
        const key = direction > 0 ? "ArrowRight" : "ArrowLeft";
        await page.keyboard.down(key);
        await page.waitForTimeout(120);
        await page.keyboard.up(key);
      }
    }
    await page.waitForTimeout(id === "avoider" ? 160 : 450);
    if (await page.getByTestId("game-result-overlay").count()) {
      throw new Error(`game ended before active-minute evidence: ${JSON.stringify(await readQa(page))}`);
    }
  }
}

async function finishByRules(id: FlagshipId, page: Page, canvas: Locator) {
  if (id === "farming") {
    for (let i = 0; i < 3; i += 1) await clickHint(page, canvas, i);
  } else if (id === "physics") {
    let score = Number((await readQa(page)).physicsScore ?? 0);
    for (let i = 0; i < 40 && score < 200; i += 1) {
      await hitDummy(page, canvas);
      await page.waitForTimeout(700);
      score = Number((await readQa(page)).physicsScore ?? 0);
    }
    expect(score).toBeGreaterThanOrEqual(200);
  } else if (id === "puzzle") {
    for (let i = 0; i < 8 && await page.getByTestId("game-result-overlay").count() === 0; i += 1) expect(await validPuzzleSwap(page, canvas)).toBeTruthy();
  } else if (id === "platformer") {
    // Mobile control is split between the visible jump zone and pointer
    // steering. Alternate both controls to traverse the real level until its
    // normal score/spike/fall rule reaches an outcome.
    const steps = Number(process.env.FLAGSHIP_FINISH_STEPS ?? 70);
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Phaser canvas has no bounding box");
    await page.mouse.move(box.x + box.width * 0.82, box.y + box.height * 0.62);
    await page.mouse.down();
    try {
      for (let i = 0; i < steps && await page.getByTestId("game-result-overlay").count() === 0; i += 1) {
        await page.keyboard.down("Space");
        await page.waitForTimeout(120);
        await page.keyboard.up("Space");
        await page.waitForTimeout(400);
      }
    } finally {
      await page.mouse.up();
    }
  } else {
    for (let i = 0; i < 120 && await page.getByTestId("game-result-overlay").count() === 0; i += 1) {
      const q = await readQa(page);
      const scene = await page.evaluate(() => {
        const active = window.__PHASER_QA_GAME__?.scene.getScenes(true)[0];
        return { width: active?.scale.width ?? 920, height: active?.scale.height ?? 560 };
      });
      if (Number(q.nearestHazardX ?? -1) >= 0) {
        await holdRel(canvas, Number(q.nearestHazardX) / scene.width, Number(q.nearestHazardY) / scene.height, 500);
      } else await page.waitForTimeout(120);
    }
  }
  const overlay = page.getByTestId("game-result-overlay");
  try {
    await expect(overlay).toBeVisible({ timeout: Number(process.env.FLAGSHIP_OUTCOME_TIMEOUT ?? 20_000) });
  } catch (error) {
    const runtime = await page.evaluate(() => {
      const scene = window.__PHASER_QA_GAME__?.scene.getScenes(true)[0] as any;
      return {
        qa: window.__PHASER_QA_STATE__ ?? null,
        player: scene?.player ? { x: scene.player.x, y: scene.player.y, vx: scene.player.body?.velocity?.x, vy: scene.player.body?.velocity?.y } : null,
        score: scene?.score,
        lives: scene?.lives,
        winScore: scene?.winScore,
        worldW: scene?.worldW,
        body: scene?.player?.body ? {
          blocked: scene.player.body.blocked,
          touching: scene.player.body.touching,
          x: scene.player.body.x,
          y: scene.player.body.y,
          width: scene.player.body.width,
          height: scene.player.body.height,
          offset: scene.player.body.offset,
        } : null,
        sceneSize: scene?.scale ? { width: scene.scale.width, height: scene.scale.height } : null,
        nearbyPlatforms: scene?.platforms?.getChildren?.().filter((item: any) => Math.abs(item.x - scene.player.x) < 260).map((item: any) => ({
          x: item.x, y: item.y, w: item.displayWidth, h: item.displayHeight,
          body: item.body ? { x: item.body.x, y: item.body.y, width: item.body.width, height: item.body.height } : null,
        })) ?? [],
        nearbySpikes: scene?.spikes?.getChildren?.().filter((item: any) => Math.abs(item.x - scene.player.x) < 260).map((item: any) => ({ x: item.x, y: item.y, w: item.displayWidth, h: item.displayHeight })) ?? [],
        pointer: scene?.input?.activePointer ? { x: scene.input.activePointer.x, worldX: scene.input.activePointer.worldX, isDown: scene.input.activePointer.isDown } : null,
      };
    });
    throw new Error(`game did not reach a rule outcome: ${JSON.stringify(runtime)}\n${String(error)}`);
  }
}

const requested = process.env.FLAGSHIP_ID;
for (const flagship of FLAGSHIPS.filter((f) => !requested || f.templateId === requested)) {
  test(`移动 H5 完整交付 · ${flagship.templateId}`, async ({ page }) => {
    await ensureOwnerSession(page);
    const project = await createProject(page, flagship);
    await gotoPlay(page, project.id);
    const canvas = page.locator('canvas[data-phaser-active="true"]');
    await expect(canvas).toBeVisible({ timeout: 30_000 });
    expect(await waitPlayReady(page, 30_000)).toBeTruthy();
    const device = await page.evaluate(() => ({ width: innerWidth, touch: navigator.maxTouchPoints > 0, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
    expect(device.width).toBeLessThanOrEqual(768); expect(device.touch).toBeTruthy(); expect(device.overflow).toBeLessThanOrEqual(1);

    await warmup(flagship.templateId, page, canvas);
    await activeMinute(flagship.templateId, page, canvas);
    if (Number(process.env.FLAGSHIP_ACTIVE_MS ?? 61_500) >= 60_000) {
      await expect.poll(async () => {
        const body = await (await page.request.get(`/api/projects/${project.id}`)).json() as any;
        return body.core?.revision?.artifacts?.find((a: any) => a.kind === "game_playtest_first_minute")?.content ?? null;
      }, { timeout: 45_000, intervals: [500, 1000, 2000, 5000] }).toMatchObject({ version: 2, event: "first_minute", templateId: project.templateId, deviceClass: "mobile", touchCapable: true });
    }

    await finishByRules(flagship.templateId, page, canvas);
    await expect.poll(async () => {
      const body = await (await page.request.get(`/api/projects/${project.id}`)).json() as any;
      return body.core?.revision?.artifacts?.find((a: any) => a.kind === "game_playtest_delivery")?.content ?? null;
    }, { timeout: 18_000, intervals: [500, 1000, 2000] }).toMatchObject({ templateId: project.templateId, deviceClass: "mobile", touchCapable: true });

    await page.getByTestId("game-result-restart").click();
    await expect(page.getByTestId("game-result-overlay")).toHaveCount(0);
    await expect(canvas).toBeVisible();
  });
}
