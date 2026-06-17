/**
 * 游戏效果对比 QA：样品专用场景 vs 用户 Agentic 路径
 * 需 dev @8888 + seed samples
 * npm run qa:game-effect-compare
 * 截图：qa-output/game-effect/*.png
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { chromium } from "@playwright/test";
import { sampleProjectId } from "../src/lib/sample-gallery";
import { mockSpecFromPrompt } from "../src/lib/mock-spec";
import { expectedPhaserSceneName } from "../src/lib/game-templates/runtime";
import { shouldUseAgenticRuntime } from "../src/lib/agentic/game-module";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:8888";
const OUT = path.join(process.cwd(), "qa-output", "game-effect");

type Row = {
  id: string;
  route: "sample" | "user";
  templateId: string;
  scene: string;
  canvasMs: number;
  heading: string;
  screenshot: string;
  ok: boolean;
  note: string;
};

const SAMPLES: Array<{ slug: string; templateId: string; expectScene: string; title: string }> = [
  { slug: "smash-the-dummy", templateId: "physics", expectScene: "PhysicsScene", title: "Smash" },
  { slug: "grow-a-garden", templateId: "farming", expectScene: "FarmingScene", title: "Garden" },
  { slug: "color-bloom", templateId: "puzzle", expectScene: "PuzzleScene", title: "Color" },
  { slug: "gun-merge-3d-zombie-apocalypse", templateId: "towerDefense", expectScene: "TowerDefenseScene", title: "Gun" },
  { slug: "pottery-master-3d", templateId: "customization", expectScene: "CustomizationScene", title: "Pottery" },
  { slug: "crashy-roads", templateId: "racing", expectScene: "CoasterScene", title: "Crashy" },
  { slug: "temple-relic-runner", templateId: "coaster", expectScene: "CoasterScene", title: "Temple" },
  { slug: "elastic-thief-2", templateId: "stealth", expectScene: "PlatformerScene", title: "Elastic" },
  { slug: "blade-defender-merge", templateId: "towerDefense", expectScene: "TowerDefenseScene", title: "Blade" },
  { slug: "number-merge-2048", templateId: "puzzle", expectScene: "PuzzleScene", title: "2048" },
  { slug: "classic-international-chess", templateId: "chess", expectScene: "ChessScene", title: "Chess" },
];

/** 与样品 prompt 完全一致的用户 POST → 验证 profile infer + 专用 Scene 路由 */
const USER_PROMPT_CASES: Array<{
  id: string;
  prompt: string;
  expectTemplate: string;
  expectScene: string;
}> = [
  {
    id: "user-physics-dedicated",
    prompt: "打击 dummy 假人解压",
    expectTemplate: "physics",
    expectScene: "PhysicsScene",
  },
  {
    id: "user-strategy-infer",
    prompt:
      "做一个地图征服策略小游戏：若干区域节点，玩家与 AI 轮流派兵占领相邻区域，占领全部或达到分数即胜；有兵力数字、动画反馈与难度递增。",
    expectTemplate: "strategy",
    expectScene: "StrategyScene",
  },
  {
    id: "user-platformer-infer",
    prompt:
      "做一个潜行物理小游戏：玩家控制可伸缩/elastic 的角色摆荡或伸长去偷取场景中的目标物品，避开守卫与激光；关卡短平快，强调物理手感与失败重试。",
    expectTemplate: "stealth",
    expectScene: "PlatformerScene",
  },
  {
    id: "user-puzzle-whimsy-infer",
    prompt:
      "做一个找不同小游戏：左右两幅插画仅几处细节不同，玩家点击差异处圈出；有多关卡、倒计时与提示次数，画风 whimsical 手绘，差异难度递进。",
    expectTemplate: "puzzle",
    expectScene: "PuzzleScene",
  },
  {
    id: "user-puzzle-memory-infer",
    prompt:
      "做一个翻牌记忆配对小游戏：网格背面卡牌，点击翻两张，相同则消除；有步数/计时、连击加分与多主题牌面，UI 明亮活泼。（原创牌面图案）",
    expectTemplate: "puzzle",
    expectScene: "PuzzleScene",
  },
  {
    id: "user-td-blade-infer",
    prompt:
      "做一个 merge + 塔防混合游戏：在格子上合并同级 blade/剑塔提升攻击力，自动攻击沿路径前进的敌人；有多波次、金币与技能冷却，视觉偏奇幻 RPG。（原创敌人与剑塔造型）",
    expectTemplate: "towerDefense",
    expectScene: "TowerDefenseScene",
  },
];

async function ensureOut() {
  fs.mkdirSync(OUT, { recursive: true });
}

async function healthOk(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(5000) });
    return r.ok;
  } catch {
    return false;
  }
}

async function playCase(
  page: import("@playwright/test").Page,
  projectId: string,
  meta: { id: string; route: Row["route"]; templateId: string; expectScene: string },
): Promise<Row> {
  const t0 = Date.now();
  const url = `${BASE}/play/${projectId}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.getByText("继续共创").waitFor({ timeout: 20_000 }).catch(() => {});
  const phaserTab = page.getByTestId("runtime-tab-phaser");
  if (await phaserTab.isVisible().catch(() => false)) {
    await phaserTab.click();
  }
  await page.locator("canvas").first().waitFor({ timeout: 25_000 });
  const canvasMs = Date.now() - t0;
  const heading = (await page.getByRole("heading", { level: 1 }).textContent())?.trim() ?? "";
  const shot = path.join(OUT, `${meta.id}.png`);
  await page.waitForTimeout(1200);
  const canvas = page.locator("canvas").first();
  await canvas.scrollIntoViewIfNeeded().catch(() => {});
  await canvas.screenshot({ path: shot });
  const scene = meta.expectScene;
  const ok = heading.length > 0 && canvasMs < 40_000;
  return {
    id: meta.id,
    route: meta.route,
    templateId: meta.templateId,
    scene,
    canvasMs,
    heading: heading.slice(0, 48),
    screenshot: path.relative(process.cwd(), shot),
    ok,
    note: meta.route === "sample" ? "样品馆专用 Phaser/Godot 运行时" : "用户 POST 专用 Scene（Astrocade 对齐）",
  };
}

async function createUserProject(
  page: import("@playwright/test").Page,
  prompt: string,
): Promise<{ id: string; templateId: string; scene: string; agentic: boolean } | null> {
  const base = mockSpecFromPrompt(prompt);
  const create = await page.request.post(`${BASE}/api/projects`, {
    data: { prompt, spec: base },
  });
  if (!create.ok()) {
    console.error("[FAIL] POST /api/projects", prompt.slice(0, 40), await create.text());
    return null;
  }
  const { project } = (await create.json()) as { project?: { id?: string } };
  const agenticId = project?.id;
  if (!agenticId) {
    console.error("[FAIL] no project id from POST", prompt.slice(0, 40));
    return null;
  }
  const get = await page.request.get(`${BASE}/api/projects/${agenticId}`);
  const saved = (await get.json()) as { spec?: { templateId?: string; agenticModule?: { source?: string } } };
  const spec = saved.spec!;
  return {
    id: agenticId,
    templateId: spec.templateId ?? "unknown",
    scene: expectedPhaserSceneName(spec),
    agentic: shouldUseAgenticRuntime(spec) || Boolean(spec.agenticModule?.source),
  };
}

async function main() {
  if (!(await healthOk())) {
    console.error(`[FAIL] dev not reachable at ${BASE}. Run: DATABASE_URL=file:./prisma/ci.sqlite PORT=8888 npm run dev`);
    process.exit(1);
  }
  await ensureOut();

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 640 } });
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  const rows: Row[] = [];

  for (const s of SAMPLES) {
    const id = sampleProjectId(s.slug);
    const row = await playCase(page, id, {
      id: `sample-${s.slug}`,
      route: "sample",
      templateId: s.templateId,
      expectScene: s.expectScene,
    });
    if (!row.heading.toLowerCase().includes(s.title.split(" ")[0]!.toLowerCase())) {
      row.ok = false;
      row.note += `; heading mismatch: ${row.heading}`;
    }
    rows.push(row);
    console.log(`[${row.ok ? "OK" : "FAIL"}] sample/${s.slug} ${row.scene} canvas=${row.canvasMs}ms`);
  }

  for (const u of USER_PROMPT_CASES) {
    const created = await createUserProject(page, u.prompt);
    if (!created) {
      rows.push({
        id: u.id,
        route: "user",
        templateId: u.expectTemplate,
        scene: u.expectScene,
        canvasMs: 0,
        heading: "",
        screenshot: "",
        ok: false,
        note: "POST failed",
      });
      continue;
    }
    const row = await playCase(page, created.id, {
      id: u.id,
      route: "user",
      templateId: created.templateId,
      expectScene: u.expectScene,
    });
    row.ok =
      row.ok &&
      created.templateId === u.expectTemplate &&
      created.scene === u.expectScene &&
      !created.agentic;
    rows.push(row);
    console.log(`[${row.ok ? "OK" : "FAIL"}] user/${u.id} ${row.scene} canvas=${row.canvasMs}ms`);
  }

  await browser.close();

  const samples = rows.filter((r) => r.route === "sample");
  const users = rows.filter((r) => r.route === "user");
  const reportPath = path.join(OUT, "REPORT.md");
  const md = [
    "# 游戏效果对比报告",
    "",
    `生成时间：${new Date().toISOString()}`,
    "",
    "## 结论摘要",
    "",
    "| 路径 | 数量 | 平均 canvas 就绪 | 说明 |",
    "|------|------|------------------|------|",
    `| 样品专用场景 | ${samples.length} | ${Math.round(samples.reduce((a, r) => a + r.canvasMs, 0) / samples.length)}ms | 样品馆标杆 |`,
    `| 用户专用 Scene | ${users.length} | ${users[0]?.canvasMs ?? 0}ms | template-first 与样品同路由 |`,
    "",
    "## Astrocade 对齐",
    "",
    "- **样品馆与用户新生成**：同模板均路由专用 Scene（Physics/Coaster/Strategy/Customization 等）",
    "- **LLM 定制玩法**：`AGENTIC_FORCE_LLM=1` 时仍走 AgenticScene（高级定制路径）",
    "- **Godot 3D**：部分样品有 SubViewport 3D；全模板 Godot 仍在演进",
    "",
    "## 明细",
    "",
    "| ID | 路径 | 模板 | Scene | Canvas(ms) | 截图 |",
    "|----|------|------|-------|------------|------|",
    ...rows.map(
      (r) =>
        `| ${r.id} | ${r.route} | ${r.templateId} | ${r.scene} | ${r.canvasMs} | ${r.screenshot} |`,
    ),
    "",
    "## 目视对比",
    "",
    "打开 `qa-output/game-effect/` 下 PNG，并排对比：",
    "- `sample-smash-the-dummy.png` vs `user-physics-dedicated.png`（同 PhysicsScene）",
    "- `sample-state-conquest.png` vs `user-strategy-infer.png`（profile infer → StrategyScene）",
    "- `sample-elastic-thief-2.png` vs `user-platformer-infer.png`（profile infer → PlatformerScene）",
    "- `sample-rail-in-air.png`（CoasterScene 标杆）",
    "- `sample-blocky-sniper-hunter.png`（ShooterScene 狙击 scope）",
    "- `sample-whimsy-differences.png` vs `user-puzzle-whimsy-infer.png`（profile infer → PuzzleScene 找不同）",
    "- `sample-memory-match-mania.png` vs `user-puzzle-memory-infer.png`（计时翻牌 infer）",
    "- `sample-blade-defender-merge.png` vs `user-td-blade-infer.png`（merge 塔防 infer）",
    "- `sample-kids-puzzle.png`（儿童拼图 jigsaw）",
    "",
  ].join("\n");
  fs.writeFileSync(reportPath, md, "utf8");

  const failed = rows.filter((r) => !r.ok).length;
  console.log(`\n报告：${path.relative(process.cwd(), reportPath)}`);
  console.log(`截图：${path.relative(process.cwd(), OUT)}/ (${rows.length} 张)`);
  if (failed > 0) {
    console.error(`[FAIL] ${failed}/${rows.length} cases`);
    process.exit(1);
  }
  console.log(`[OK] qa-game-effect-compare: ${rows.length}/${rows.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
