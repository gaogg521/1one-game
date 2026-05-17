/**
 * 模拟人工验收总控：离线 QA +（可选）漫画 8 页分镜 HTTP 探测
 * 用法：先 `npm run build && npm run start`（8888），再 `node scripts/simulate-handtest.mjs`
 * 环境：COMIC_HANDTEST=1 时调用 POST /api/comic/generate（需 LLM）
 */
import { config } from "dotenv";
import { execSync } from "child_process";
import { resolve } from "path";
import { writeFileSync } from "fs";

config({ path: resolve(process.cwd(), ".env") });

const base = process.env.HANDTEST_BASE_URL ?? "http://localhost:8888";
const lines = [];
const log = (s) => {
  console.log(s);
  lines.push(s);
};

function run(cmd) {
  log(`\n$ ${cmd}`);
  try {
    const out = execSync(cmd, { cwd: process.cwd(), encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
    log(out.trimEnd());
    return true;
  } catch (e) {
    const err = e.stderr?.toString() || e.stdout?.toString() || e.message;
    log(`[FAIL] ${err.slice(0, 800)}`);
    return false;
  }
}

async function httpJson(path, init) {
  const res = await fetch(`${base}${path}`, init);
  const text = await res.text();
  let json = {};
  try {
    json = JSON.parse(text);
  } catch {
    /* */
  }
  return { ok: res.ok, status: res.status, json, text: text.slice(0, 500) };
}

const MEDIUM_SNIPPET = `崇祯十七年三月，煤山风紧。宫中余烬未冷，城外炮声已近。
李自成大军围德胜门，守军士气涣散。崇祯召群臣于乾清宫，问策无人敢言。
夜半，王承恩随驾出玄武门，往煤山。帝着素衣，步上歪脖老树，回望紫禁城灯火渐稀。
「诸君误朕，朕非亡国之君。」风声割面，绳索在袖。天明，宫人寻至，帝已崩。
史家谓之：君王死社稷。`;

async function main() {
  log(`# 手测模拟报告 · ${new Date().toISOString()}`);
  log(`Base URL: ${base}`);

  const health = await httpJson("/api/health");
  log(health.ok ? `[OK] health ${health.status}` : `[FAIL] health ${health.status} ${health.text}`);

  let allOk = true;
  for (const cmd of [
    "npm run qa:template-matrix",
    "npm run qa:director-spec",
    "npm run qa:refinement-log",
  ]) {
    if (!run(cmd)) allOk = false;
  }

  if (process.env.COMICS_ONLY !== "1") {
    log("\n提示：Playwright 六模板 + 共创 E2E 请执行：");
    log("  PW_EXTERNAL=1 npx playwright test e2e/templates-handtest.spec.ts e2e/refinement.smoke.spec.ts e2e/create-play.smoke.spec.ts");
  }

  if (process.env.COMIC_HANDTEST === "1" && health.ok) {
    log("\n## 漫画 8 页分镜（分段 LLM）");
    const t0 = Date.now();
    const gen = await httpJson("/api/comic/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: "gcreator_owner=handtest-sim" },
      body: JSON.stringify({
        content: MEDIUM_SNIPPET.repeat(3),
        title: "煤山手测",
        pageCount: 8,
        lengthTier: "medium",
      }),
    });
    const sec = ((Date.now() - t0) / 1000).toFixed(1);
    if (gen.ok && gen.json.pageCount >= 1) {
      log(`[OK] comic generate · ${gen.json.pageCount} 页 / ${gen.json.panelCount} 格 · ${sec}s · id=${gen.json.comic?.id}`);
    } else {
      const errMsg = gen.json.error ?? gen.text;
      log(`[FAIL] comic generate ${gen.status} · ${sec}s · ${errMsg}`);
      allOk = false;
    }
  } else {
    log("\n[SKIP] 漫画 8 页：设置 COMIC_HANDTEST=1 且服务已启动后重跑本脚本");
  }

  log(allOk ? "\n[SUMMARY] 离线项通过" : "\n[SUMMARY] 存在失败项");
  const outPath = resolve(process.cwd(), "PROJECT_MEMORY/HANDTEST_SIMULATION_REPORT.md");
  writeFileSync(
    outPath,
    `# 手测模拟报告\n\n生成时间：${new Date().toISOString()}\n\n\`\`\`\n${lines.join("\n")}\n\`\`\`\n`,
    "utf8",
  );
  log(`\n报告已写入 ${outPath}`);
  if (!allOk) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
