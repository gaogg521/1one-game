import { chromium, type Page } from "playwright";
import { chromiumLaunchOptions, healthOk } from "@/lib/qa/run-sample-gameplay-interaction-audit";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:8888";

type QaState = Record<string, unknown>;

async function openGame(page: Page, id: string) {
  await page.goto(`${BASE}/zh-Hans/play/sample-${id}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForFunction(() => (window as Window & { __PHASER_PLAY_READY__?: boolean }).__PHASER_PLAY_READY__ === true, null, { timeout: 25_000 });
  const canvas = page.locator("canvas").first();
  await canvas.waitFor({ state: "visible", timeout: 15_000 });
  await canvas.click({ position: { x: 8, y: 8 } });
  return canvas;
}

async function state(page: Page): Promise<QaState> {
  return page.evaluate(() => ({ ...((window as Window & { __PHASER_QA_STATE__?: QaState }).__PHASER_QA_STATE__ ?? {}) }));
}

async function completeVoxel(page: Page) {
  await page.goto(`${BASE}/zh-Hans/play/sample-voxel-power-frontier`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  const runtime = page.getByTestId("voxel-sandbox-runtime");
  await runtime.waitFor({ state: "visible", timeout: 25_000 });
  await page.waitForFunction(() => Boolean((window as Window & { __VOXEL_QA__?: QaState }).__VOXEL_QA__), null, { timeout: 15_000 });
  const voxelState = () => page.evaluate(() => ({ ...((window as Window & { __VOXEL_QA__?: QaState }).__VOXEL_QA__ ?? {}) }));
  const before = await voxelState();
  for (let i = 0; i < 4; i += 1) await page.getByRole("button", { name: "前进", exact: true }).click();
  for (let i = 0; i < 3; i += 1) await page.getByRole("button", { name: "左移", exact: true }).click();
  const moved = await voxelState();
  if (JSON.stringify(before.position) === JSON.stringify(moved.position)) throw new Error(`voxel movement did not change position: ${JSON.stringify(moved)}`);
  await page.getByRole("button", { name: "采掘", exact: true }).click();
  await page.getByRole("button", { name: "土块", exact: true }).click();
  await page.getByRole("button", { name: "放置", exact: true }).click();
  await page.getByRole("button", { name: "脉冲", exact: true }).click();
  const after = await voxelState();
  if (Number(after.placed) < 1) throw new Error(`voxel placement did not persist: ${JSON.stringify(after)}`);
  if (Number(after.powerCooldown) <= 0) throw new Error(`voxel power did not fire: ${JSON.stringify(after)}`);
  console.log(`[OK] voxel WebGL: moved, mined, placed ${after.placed} block(s), fired power`);
}

async function completeTerritory(page: Page) {
  const canvas = await openGame(page, "neon-territory-loop");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("territory canvas bounds missing");
  const buttons: Record<string, { x: number; y: number }> = {
    ArrowUp: { x: 78, y: box.height - 78 }, ArrowDown: { x: 78, y: box.height - 34 },
    ArrowLeft: { x: 28, y: box.height - 34 }, ArrowRight: { x: 128, y: box.height - 34 },
  };
  const clickLoop = async (directions: Array<[string, number]>) => {
    for (const [key, count] of directions) for (let i = 0; i < count; i += 1) {
      await canvas.click({ position: buttons[key] });
      await page.waitForTimeout(24);
    }
  };
  await clickLoop([["ArrowRight", 4], ["ArrowDown", 3], ["ArrowLeft", 4], ["ArrowUp", 1]]);
  await clickLoop([["ArrowRight", 6], ["ArrowDown", 4], ["ArrowLeft", 6], ["ArrowUp", 4]]);
  await clickLoop([["ArrowLeft", 6], ["ArrowDown", 4], ["ArrowRight", 6], ["ArrowUp", 4]]);
  await page.waitForFunction(() => (window as Window & { __PHASER_QA_STATE__?: QaState }).__PHASER_QA_STATE__?.territoryCompleted === true, null, { timeout: 5_000 });
  const qa = await state(page);
  if (Number(qa.territoryCoverage) < 20 || Number(qa.territoryClosures) < 2) throw new Error(`territory loop invalid: ${JSON.stringify(qa)}`);
  console.log(`[OK] territory: ${qa.territoryClosures} closed loops, ${qa.territoryCoverage}% captured`);
}

async function completeEstate(page: Page) {
  const canvas = await openGame(page, "grand-estate-merge");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("estate canvas bounds missing");
  for (let turn = 0; turn < 20; turn += 1) {
    const qa = await state(page);
    if (qa.estateCompleted === true) break;
    const board = String(qa.estateBoard).split(",").map(Number);
    const pair = board.map((level, index) => ({ level, index })).find(({ level, index }) => level > 0 && board.findIndex((other, otherIndex) => otherIndex > index && other === level) > index);
    if (!pair) throw new Error(`estate has no mergeable pair: ${JSON.stringify(board)}`);
    const target = board.findIndex((level, index) => index > pair.index && level === pair.level);
    const gx = Number(qa.estateGridX); const gy = Number(qa.estateGridY); const cell = Number(qa.estateCell);
    const point = (index: number) => ({ x: box.x + gx + (index % 5 + 0.5) * cell, y: box.y + gy + (Math.floor(index / 5) + 0.5) * cell });
    const from = point(pair.index); const to = point(target);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(120);
  }
  await page.waitForFunction(() => (window as Window & { __PHASER_QA_STATE__?: QaState }).__PHASER_QA_STATE__?.estateCompleted === true, null, { timeout: 5_000 });
  const qa = await state(page);
  if (Number(qa.estateHighest) !== 5 || Number(qa.estateMerges) < 15) throw new Error(`estate progression invalid: ${JSON.stringify(qa)}`);
  console.log(`[OK] estate: ${qa.estateMerges} real merges, level ${qa.estateHighest} completed`);
}

async function main() {
  if (!(await healthOk(BASE))) throw new Error(`service not ready at ${BASE}`);
  const browser = await chromium.launch(chromiumLaunchOptions(BASE));
  try {
    const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
    await completeVoxel(page);
    await completeTerritory(page);
    await completeEstate(page);
    console.log("qa:showcase-games:browser: ok (WebGL voxel action loop + 2 Phaser task chains)");
  } finally {
    await browser.close();
  }
}

void main();
