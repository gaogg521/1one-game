/**
 * OpenGame-Bench 风格：真浏览器 Agentic 试玩探测
 * npm run qa:opengame-browser-bench
 *
 * 需 dev server 或 QA_ROUTES_ENABLED=1：
 *   QA_ROUTES_ENABLED=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:80 npm run qa:opengame-browser-bench
 * 无 server 时默认 skip（OPENGAME_BROWSER_BENCH_REQUIRED=1 则 fail）
 */
import { chromium } from "@playwright/test";
import { buildTemplateFallbackModule } from "@/lib/agentic/template-fallback-modules";
import type { GameSpec } from "@/lib/game-spec";
import { runAgenticBrowserBench } from "@/lib/opengame-skills/browser-bench";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

const BENCH_SPECS: { name: string; spec: GameSpec }[] = [
  {
    name: "platformer-fallback",
    spec: {
      version: 1,
      templateId: "platformer",
      title: "Bench Platformer",
      theme: {
        backgroundColor: "#1a2220",
        playerColor: "#89a884",
        hazardColor: "#9d5838",
        collectibleColor: "#c9a66b",
      },
      gameplay: { playerSpeed: 300, hazardSpeed: 220, spawnIntervalMs: 640, winScore: 42, lives: 3 },
      labels: { player: "英雄", hazard: "障碍" },
    },
  },
  {
    name: "physics-fallback",
    spec: {
      version: 1,
      templateId: "physics",
      title: "Bench Physics",
      theme: {
        backgroundColor: "#1a2220",
        playerColor: "#89a884",
        hazardColor: "#9d5838",
        collectibleColor: "#c9a66b",
      },
      gameplay: { playerSpeed: 300, hazardSpeed: 220, spawnIntervalMs: 640, winScore: 100 },
      labels: { player: "拳", hazard: "假人" },
    },
  },
];

async function serverReachable(): Promise<boolean> {
  for (let i = 0; i < 3; i += 1) {
    try {
      const res = await fetch(BASE, { signal: AbortSignal.timeout(8000) });
      if (res.ok || res.status < 500) return true;
    } catch {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  return false;
}

async function main() {
  const up = await serverReachable();
  if (!up) {
    const msg = `[skip] qa-opengame-browser-bench — no server at ${BASE}`;
    if (process.env.OPENGAME_BROWSER_BENCH_REQUIRED === "1") {
      console.error(msg);
      process.exit(1);
    }
    console.warn(msg);
    return;
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  let failed = 0;

  for (const { name, spec } of BENCH_SPECS) {
    const mod = buildTemplateFallbackModule(spec);
    const result = await runAgenticBrowserBench(page, spec, mod, BASE);
    if (!result.ok) {
      console.error(`[FAIL] ${name}`, result.probe, result.checks.map((c) => c.errorCode).join(", "));
      failed += 1;
    } else {
      console.log(`[OK] ${name} canvasNonEmpty=${result.probe.canvasNonEmpty} scene=${result.probe.sceneKey ?? "?"}`);
    }
  }

  await browser.close();
  if (failed > 0) process.exit(1);
  console.log(`[OK] qa-opengame-browser-bench: ${BENCH_SPECS.length}/${BENCH_SPECS.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
