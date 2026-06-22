/**
 * 样品 AI 修改链路实机验收（访客 /api/generate/patch + 试玩页 UI）
 * PLAYWRIGHT_BASE_URL=http://your-prod-host npm run qa:sample-ai-patch-audit
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "@playwright/test";
import { chromiumLaunchOptions, healthOk } from "@/lib/qa/run-sample-gameplay-interaction-audit";
import type { GameSpec } from "@/lib/game-spec";

const BASE = (process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:6666").replace(/\/$/, "");
const OUT = path.join(process.cwd(), "qa-output", "sample-ai-patch-audit");
const SAMPLE_ID = process.env.PATCH_AUDIT_SAMPLE_ID ?? "grow-a-garden";
const PROJECT_ID = `sample-${SAMPLE_ID}`;
const INSTRUCTION = process.env.PATCH_AUDIT_INSTRUCTION ?? "把起始金币改成200";
const TARGET_COINS = Number(process.env.PATCH_AUDIT_TARGET_COINS ?? "200");
const HTTP_TIMEOUT_MS = Number(process.env.PATCH_AUDIT_HTTP_TIMEOUT_MS ?? "90000");

type AuditRow = {
  step: string;
  pass: boolean;
  ms: number;
  detail?: string;
  error?: string;
};

function readStartingCoins(spec: GameSpec): { farming?: number; gameplay?: number } {
  return {
    farming: spec.farming?.startingCoins,
    gameplay: spec.gameplay?.startingCoins,
  };
}

function coinsPatched(spec: GameSpec, before: ReturnType<typeof readStartingCoins>, after: ReturnType<typeof readStartingCoins>): boolean {
  const isFarming = spec.templateId === "farming" || spec.farming != null;
  if (isFarming) {
    return after.farming === TARGET_COINS && after.farming !== before.farming;
  }
  return after.gameplay === TARGET_COINS && after.gameplay !== before.gameplay;
}

async function httpJson<T>(
  baseUrl: string,
  pathname: string,
  init?: { method?: string; body?: string },
): Promise<{ status: number; data: T; ms: number }> {
  const t0 = Date.now();
  const url = new URL(baseUrl);
  const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
  const payload = init?.body;

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port,
        path: pathname,
        method: init?.method ?? "GET",
        family: 4,
        timeout: HTTP_TIMEOUT_MS,
        headers: payload
          ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
          : undefined,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let data: T;
          try {
            data = JSON.parse(text) as T;
          } catch {
            reject(new Error(`invalid json HTTP ${res.statusCode}: ${text.slice(0, 200)}`));
            return;
          }
          resolve({ status: res.statusCode ?? 500, data, ms: Date.now() - t0 });
        });
      },
    );
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`timeout ${HTTP_TIMEOUT_MS}ms`));
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const rows: AuditRow[] = [];
  const tAll = Date.now();

  console.log(`[patch-audit] target=${BASE} project=${PROJECT_ID}`);

  const healthStart = Date.now();
  const healthy = await healthOk(BASE);
  rows.push({
    step: "health",
    pass: healthy,
    ms: Date.now() - healthStart,
    detail: healthy ? "ok" : "unreachable",
  });
  if (!healthy) {
    writeReport(rows, false);
    process.exit(1);
  }

  let baselineSpec: GameSpec | null = null;
  try {
    const got = await httpJson<{ spec?: GameSpec }>(BASE, `/api/projects/${PROJECT_ID}`);
    baselineSpec = got.data.spec ?? null;
    rows.push({
      step: "load-project",
      pass: got.status === 200 && Boolean(baselineSpec),
      ms: got.ms,
      detail: baselineSpec ? JSON.stringify(readStartingCoins(baselineSpec)) : undefined,
      error: got.status !== 200 ? `HTTP ${got.status}` : baselineSpec ? undefined : "missing spec",
    });
  } catch (e) {
    rows.push({
      step: "load-project",
      pass: false,
      ms: 0,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  if (!baselineSpec) {
    writeReport(rows, false);
    process.exit(1);
  }

  const beforeCoins = readStartingCoins(baselineSpec);
  let patchedSpec: GameSpec | null = null;
  let patchPrompt: string | undefined;

  try {
    const patched = await httpJson<{ spec?: GameSpec; prompt?: string; errorKey?: string }>(
      BASE,
      "/api/generate/patch",
      {
        method: "POST",
        body: JSON.stringify({
          prompt: INSTRUCTION,
          currentSpec: baselineSpec,
          currentPrompt: baselineSpec.labels?.subtitle ?? "",
        }),
      },
    );
    patchedSpec = patched.data.spec ?? null;
    patchPrompt = patched.data.prompt;
    const ok = patched.status === 200 && Boolean(patchedSpec) && coinsPatched(baselineSpec, beforeCoins, readStartingCoins(patchedSpec!));
    rows.push({
      step: "api-generate-patch",
      pass: ok,
      ms: patched.ms,
      detail: patchedSpec
        ? JSON.stringify({ coins: readStartingCoins(patchedSpec), promptLen: patchPrompt?.length ?? 0 })
        : patched.data.errorKey,
      error: patched.status !== 200 ? `HTTP ${patched.status}` : ok ? undefined : "startingCoins 未改为目标值",
    });
  } catch (e) {
    rows.push({
      step: "api-generate-patch",
      pass: false,
      ms: HTTP_TIMEOUT_MS,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  if (patchedSpec) {
    try {
      const browser = await chromium.launch(chromiumLaunchOptions(BASE));
      const context = await browser.newContext({ viewport: { width: 900, height: 720 } });
      const page = await context.newPage();
      const uiStart = Date.now();
      await page.goto(`${BASE}/play/${PROJECT_ID}`, { waitUntil: "domcontentloaded" });
      await page.locator("#patch-prompt").fill(INSTRUCTION);
      await page.getByRole("button", { name: /AI 修改|AI patch/i }).click();

      const errLocator = page.getByText(/修改失败|patch failed|patchFailed|patchNoModel/i);
      const okLocator = page.getByText(/继续共创|Keep co-creating/i);
      let uiPass = false;
      let uiDetail = "";
      try {
        await Promise.race([
          errLocator.waitFor({ state: "visible", timeout: HTTP_TIMEOUT_MS }),
          page.waitForFunction(
            () => {
              const el = document.querySelector("#patch-prompt") as HTMLInputElement | null;
              return el != null && el.value.trim() === "";
            },
            { timeout: HTTP_TIMEOUT_MS },
          ),
        ]);
        uiPass = !(await errLocator.isVisible().catch(() => false));
        uiDetail = uiPass ? "patch prompt cleared, no error banner" : await errLocator.innerText().catch(() => "error");
      } catch {
        uiPass = await okLocator.isVisible().catch(() => false);
        uiDetail = uiPass ? "page still playable" : "timeout waiting patch UI";
      }

      rows.push({
        step: "play-ui-patch",
        pass: uiPass,
        ms: Date.now() - uiStart,
        detail: uiDetail,
      });

      await browser.close();
    } catch (e) {
      rows.push({
        step: "play-ui-patch",
        pass: false,
        ms: 0,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const allPass = rows.every((r) => r.pass);
  writeReport(rows, allPass, Date.now() - tAll);

  if (!allPass) {
    console.error(`qa:sample-ai-patch-audit: ${rows.filter((r) => !r.pass).length}/${rows.length} failed`);
    for (const r of rows.filter((x) => !x.pass)) {
      console.error(`  - ${r.step}: ${r.error ?? r.detail ?? "fail"}`);
    }
    process.exit(1);
  }
  console.log(`qa:sample-ai-patch-audit: ok (${rows.length}/${rows.length})`);
}

function writeReport(rows: AuditRow[], pass: boolean, totalMs?: number) {
  const summary = {
    at: new Date().toISOString(),
    base: BASE,
    projectId: PROJECT_ID,
    instruction: INSTRUCTION,
    targetCoins: TARGET_COINS,
    pass,
    totalMs,
    rows,
  };
  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync(
    path.join(OUT, "REPORT.md"),
    [
      "# 样品 AI 修改链路验收",
      "",
      `- 时间：${summary.at}`,
      `- 目标：${BASE}/play/${PROJECT_ID}`,
      `- 指令：${INSTRUCTION}`,
      `- 结果：${pass ? "PASS" : "FAIL"}${totalMs != null ? ` · ${(totalMs / 1000).toFixed(1)}s` : ""}`,
      "",
      "| 步骤 | 结果 | 耗时 | 说明 |",
      "|------|------|------|------|",
      ...rows.map((r) => `| ${r.step} | ${r.pass ? "✅" : "❌"} | ${(r.ms / 1000).toFixed(1)}s | ${r.error ?? r.detail ?? ""} |`),
      "",
    ].join("\n"),
    "utf8",
  );
  console.log(`报告: qa-output/sample-ai-patch-audit/REPORT.md`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
