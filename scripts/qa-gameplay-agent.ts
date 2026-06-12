/**
 * Phase 4：QA Agent 试玩闭环 — 样品馆玩法特征断言
 * 需 dev @8888：npm run qa:gameplay-agent
 */
import { chromium } from "@playwright/test";
import { sampleProjectId } from "@/lib/sample-gallery";
import { prisma } from "@/lib/prisma";
import { expectedPhaserSceneName } from "@/lib/game-templates/runtime";
import type { GameSpec } from "@/lib/game-spec";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:8888";

const CASES: Array<{
  slug: string;
  expectScene: string;
  titleFragment: string;
}> = [
  { slug: "rail-in-air", expectScene: "CoasterScene", titleFragment: "Rail" },
  { slug: "smash-the-dummy", expectScene: "PhysicsScene", titleFragment: "Smash" },
  { slug: "grow-a-garden", expectScene: "FarmingScene", titleFragment: "Garden" },
  { slug: "color-bloom", expectScene: "PuzzleScene", titleFragment: "Color Bloom" },
  { slug: "ultimate-3d-chess", expectScene: "ChessScene", titleFragment: "Chess" },
  { slug: "car-color-palette", expectScene: "CustomizationScene", titleFragment: "Car Color" },
  { slug: "tiny-planet-chopper", expectScene: "ShooterScene", titleFragment: "Tiny Planet" },
  { slug: "gun-merge-3d-zombie-apocalypse", expectScene: "TowerDefenseScene", titleFragment: "Gun Merge" },
  { slug: "state-conquest", expectScene: "StrategyScene", titleFragment: "State" },
];

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  let failed = 0;

  for (const c of CASES) {
    const id = sampleProjectId(c.slug);
    const row = await prisma.project.findUnique({ where: { id }, select: { specJson: true, title: true } });
    if (!row) {
      console.error(`[FAIL] ${c.slug} not in DB`);
      failed += 1;
      continue;
    }
    const spec = JSON.parse(row.specJson) as GameSpec;
    const scene = expectedPhaserSceneName(spec);
    if (scene !== c.expectScene) {
      console.error(`[FAIL] ${c.slug} spec maps to ${scene}, expected ${c.expectScene}`);
      failed += 1;
      continue;
    }

    const url = `${BASE}/play/${id}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    try {
      await page.getByText("继续共创").waitFor({ timeout: 20_000 });
      await page.locator("canvas").first().waitFor({ timeout: 25_000 });
      const heading = await page.getByRole("heading", { level: 1 }).textContent();
      if (!heading?.includes(c.titleFragment.split(" ")[0]!)) {
        console.error(`[FAIL] ${c.slug} heading=${heading}`);
        failed += 1;
      } else {
        console.log(`[OK] ${c.slug} ${scene} + canvas (${heading?.slice(0, 32)})`);
      }
    } catch (e) {
      console.error(`[FAIL] ${c.slug}`, e instanceof Error ? e.message : e);
      failed += 1;
    }
  }

  await browser.close();
  await prisma.$disconnect();
  if (failed > 0) process.exit(1);
  console.log(`qa-gameplay-agent: ${CASES.length}/${CASES.length} OK`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
