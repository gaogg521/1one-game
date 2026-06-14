/**
 * 同提示词差距对比：样品馆 spec vs 用户 POST（相同 prompt 文本）
 * 验证 Astrocade 架构 parity + 记录模板/Scene/视觉差距
 * npm run qa:prompt-parity-compare
 * 报告：qa-output/prompt-parity/REPORT.md
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { SAMPLES } from "../src/lib/samples";
import { sampleProjectId } from "../src/lib/sample-gallery";
import { specForSample } from "../src/lib/sample-specs";
import { mockSpecFromPrompt } from "../src/lib/mock-spec";
import { inferTemplateFromPrompt, SAMPLE_TEMPLATE_OVERRIDES } from "../src/lib/game-templates";
import { expectedPhaserSceneName } from "../src/lib/game-templates/runtime";
import { shouldUseAgenticRuntime } from "../src/lib/agentic/game-module";
import { resolveAstrocadePlayRoute } from "../src/lib/astrocade-architecture";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:8888";
const OUT = path.join(process.cwd(), "qa-output", "prompt-parity");

type Row = {
  sampleId: string;
  title: string;
  promptLen: number;
  sampleTemplate: string;
  userTemplate: string;
  sampleScene: string;
  userScene: string;
  templateMatch: boolean;
  sceneMatch: boolean;
  routeParity: boolean;
  userAgentic: boolean;
  sampleCanvasMs: number;
  userCanvasMs: number;
  sampleShot: string;
  userShot: string;
  gapNotes: string[];
};

async function healthOk(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(5000) });
    return r.ok;
  } catch {
    return false;
  }
}

async function screenshotPlay(
  page: import("@playwright/test").Page,
  projectId: string,
  shotPath: string,
): Promise<number> {
  const t0 = Date.now();
  await page.goto(`${BASE}/play/${projectId}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.getByText("继续共创").waitFor({ timeout: 15_000 }).catch(() => {});
  const phaserTab = page.getByTestId("runtime-tab-phaser");
  if (await phaserTab.isVisible().catch(() => false)) await phaserTab.click();
  await page.locator("canvas").first().waitFor({ timeout: 25_000 });
  await page.waitForTimeout(1000);
  await page.locator("canvas").first().screenshot({ path: shotPath });
  return Date.now() - t0;
}

function gapNotesFor(row: Omit<Row, "gapNotes">): string[] {
  const notes: string[] = [];
  if (!row.templateMatch) {
    notes.push(
      `模板推断偏差：用户=${row.userTemplate}，样品 override=${row.sampleTemplate}（seed 用 sampleId）`,
    );
  }
  if (!row.sceneMatch) notes.push(`Scene 不一致：样品 ${row.sampleScene} vs 用户 ${row.userScene}`);
  if (row.userAgentic) notes.push("用户路径仍走 AgenticScene（架构未对齐）");
  if (!row.routeParity) notes.push("resolveAstrocadePlayRoute 未达 sampleParity");
  if (row.templateMatch && row.sceneMatch && !row.userAgentic) {
    notes.push("路由已对齐；视觉 polish 需目视对比 sample/user 截图");
  }
  const astrocadeGap =
    "竞品差距（平台级）：专用 Scene 为 template 族通用实现，非 Astrocade 每款定制 JS；juice/3D/关卡密度仍低于竞品";
  if (notes.length === 1 && notes[0]?.includes("目视")) notes.push(astrocadeGap);
  if (notes.length === 0) notes.push(`路由对齐 ✅ · ${astrocadeGap}`);
  return notes;
}

async function main() {
  if (!(await healthOk())) {
    console.error(`[FAIL] dev not at ${BASE}`);
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 640 } });
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });

  const rows: Row[] = [];

  for (const s of SAMPLES) {
    const sampleSpec = specForSample(s);
    const sampleScene = expectedPhaserSceneName(sampleSpec);
    const sampleTemplate = sampleSpec.templateId;

    const userMock = mockSpecFromPrompt(s.prompt);
    const create = await page.request.post(`${BASE}/api/projects`, {
      data: { prompt: s.prompt, spec: userMock },
    });
    if (!create.ok()) {
      console.error(`[FAIL] POST ${s.id}`, await create.text());
      process.exit(1);
    }
    const { project } = (await create.json()) as { project?: { id?: string } };
    const userId = project?.id;
    if (!userId) {
      console.error(`[FAIL] no user id ${s.id}`);
      process.exit(1);
    }

    const get = await page.request.get(`${BASE}/api/projects/${userId}`);
    const saved = (await get.json()) as { spec?: typeof sampleSpec };
    const userSpec = saved.spec!;
    const userScene = expectedPhaserSceneName(userSpec);
    const userTemplate = userSpec.templateId;
    const userAgentic = shouldUseAgenticRuntime(userSpec);
    const userRoute = resolveAstrocadePlayRoute(userSpec);

    const sampleShot = path.join(OUT, `sample-${s.id}.png`);
    const userShot = path.join(OUT, `user-${s.id}.png`);
    const sampleCanvasMs = await screenshotPlay(page, sampleProjectId(s.id), sampleShot);
    const userCanvasMs = await screenshotPlay(page, userId, userShot);

    const inferredOnly = inferTemplateFromPrompt(s.prompt);
    const override = SAMPLE_TEMPLATE_OVERRIDES[s.id];

    const base: Omit<Row, "gapNotes"> = {
      sampleId: s.id,
      title: s.title,
      promptLen: s.prompt.length,
      sampleTemplate,
      userTemplate,
      sampleScene,
      userScene,
      templateMatch: sampleTemplate === userTemplate,
      sceneMatch: sampleScene === userScene,
      routeParity: userRoute.sampleParity && !userAgentic,
      userAgentic,
      sampleCanvasMs,
      userCanvasMs,
      sampleShot: path.relative(process.cwd(), sampleShot),
      userShot: path.relative(process.cwd(), userShot),
    };

    const row: Row = {
      ...base,
      gapNotes: gapNotesFor(base),
    };
    if (override && inferredOnly !== override && userTemplate === inferredOnly) {
      row.gapNotes.unshift(`纯 prompt 推断=${inferredOnly}，样品 seed override=${override}`);
    }
    rows.push(row);

    const ok = row.sceneMatch && !row.userAgentic && row.routeParity;
    console.log(
      `[${ok ? "OK" : "GAP"}] ${s.id} sample=${sampleScene}/${sampleTemplate} user=${userScene}/${userTemplate}`,
    );
  }

  await browser.close();

  const aligned = rows.filter((r) => r.sceneMatch && !r.userAgentic).length;
  const templateAligned = rows.filter((r) => r.templateMatch).length;
  const reportPath = path.join(OUT, "REPORT.md");
  const md = [
    "# 同提示词差距报告（样品 vs 用户 POST）",
    "",
    `生成时间：${new Date().toISOString()}`,
    "",
    "## 摘要",
    "",
    `- 样品数：**${rows.length}**`,
    `- Scene 路由一致：**${aligned}/${rows.length}**`,
    `- templateId 完全一致：**${templateAligned}/${rows.length}**`,
    "",
    "说明：样品 seed 可用 `sampleId` override 修正模板；用户 POST 仅 prompt+mock 推断。Scene 一致即架构 parity 成立。",
    "",
    "## 平台级竞品差距（共性）",
    "",
    "1. **Primary Scene 为 template 族通用实现**，非 Astrocade 每款独立脚本",
    "2. **视觉/关卡密度/juice** 仍低于竞品精品 demo",
    "3. **Godot Secondary** 与 Phaser Primary polish 不一致",
    "4. **LLM Advanced** 路径默认关闭；竞品部分游戏为深度定制逻辑",
    "",
    "## 明细",
    "",
    "| 样品 | 同 prompt | 样品 Scene | 用户 Scene | 模板一致 | 截图 |",
    "|------|-----------|------------|------------|----------|------|",
    ...rows.map(
      (r) =>
        `| ${r.title} | ${r.promptLen} 字 | ${r.sampleScene} | ${r.userScene} | ${r.templateMatch ? "✅" : "❌"} | sample/user PNG |`,
    ),
    "",
    "## 差距说明",
    "",
    ...rows.flatMap((r) => [
      `### ${r.title} (\`${r.sampleId}\`)`,
      "",
      ...r.gapNotes.map((n) => `- ${n}`),
      "",
      `- 样品截图：\`${r.sampleShot}\``,
      `- 用户截图：\`${r.userShot}\``,
      "",
    ]),
  ].join("\n");
  fs.writeFileSync(reportPath, md, "utf8");
  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify({ aligned, total: rows.length, rows }, null, 2));

  console.log(`\n报告：${path.relative(process.cwd(), reportPath)}`);
  const routeGaps = rows.filter((r) => !r.sceneMatch || r.userAgentic).length;
  if (routeGaps > 0) {
    console.error(`[WARN] ${routeGaps} 条 Scene/Agentic 路由差距（见报告）`);
  }
  console.log(`[OK] qa:prompt-parity-compare Scene对齐 ${aligned}/${rows.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
