/**
 * 竞品 parity 门禁快照（供 astrocade-competitor-matrix 读入）
 * npm run qa:competitor-gates
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PRODUCT } from "../src/lib/product-config";
import { parseGodotPlaywrightJson, writeGodotMatrixSummary } from "./qa-godot-matrix-summary";

const OUT = path.join(process.cwd(), "qa-output", "competitor-gates.json");
const GODOT_JSON = path.join(process.cwd(), "qa-output", "godot-matrix", "playwright-results.json");
const GODOT_E2E = [
  "e2e/godot-runtime.smoke.spec.ts",
  "e2e/godot-templates-matrix.spec.ts",
] as const;

function run(cmd: string, extraEnv?: Record<string, string>): boolean {
  try {
    execSync(cmd, {
      stdio: "inherit",
      cwd: process.cwd(),
      env: { ...process.env, PW_REUSE_SERVER: "1", ...extraEnv },
    });
    return true;
  } catch {
    return false;
  }
}

function runGodotMatrixE2e(): boolean {
  fs.mkdirSync(path.dirname(GODOT_JSON), { recursive: true });
  const ok = run(
    "npx playwright test e2e/godot-runtime.smoke.spec.ts e2e/godot-templates-matrix.spec.ts --workers=1 --config=playwright.godot-matrix.config.ts",
  );
  let rows = fs.existsSync(GODOT_JSON)
    ? parseGodotPlaywrightJson(JSON.parse(fs.readFileSync(GODOT_JSON, "utf8")) as Parameters<
        typeof parseGodotPlaywrightJson
      >[0])
    : [];
  if (rows.length === 0) {
    rows = [
      {
        testId: "runtime-smoke",
        title: "试玩页可切换到 Godot 引擎标签",
        templateId: "runtime-smoke",
        ok,
        durationMs: 0,
      },
      ...PRODUCT.godot.supportedTemplates.map((templateId) => ({
        testId: templateId,
        title: `Godot 标签 · ${templateId}`,
        templateId,
        ok,
        durationMs: 0,
      })),
    ];
  }
  const summary = writeGodotMatrixSummary({ rows, suiteOk: ok && rows.every((r) => r.ok) });
  console.log(
    `[monitor] godot play summary · ${summary.passCount}/${summary.total} → qa-output/godot-matrix/REPORT.md`,
  );
  return ok;
}

function healthOk(): boolean {
  try {
    execSync(
      "node -e \"fetch('http://127.0.0.1:8888/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\"",
      { stdio: "pipe", timeout: 8000 },
    );
    return true;
  } catch {
    return false;
  }
}

function main() {
  if (!healthOk()) {
    console.error("[FAIL] dev not at :8888 — start dev before qa:competitor-gates");
    process.exit(1);
  }

  if (!run("npm run seed:samples")) {
    console.error("[FAIL] seed:samples — 样品馆未就绪，双验证无法跑");
    process.exit(1);
  }

  const e2eAstrocadeOk = run("npm run test:e2e:astrocade");
  const e2eCloneOk = run(
    "npx playwright test e2e/competitor-clone.smoke.spec.ts --workers=1 --reporter=line",
  );
  const e2eGodotOk = runGodotMatrixE2e();
  const e2eSamplesEnOk = run(
    "npx playwright test e2e/samples-en-matrix.smoke.spec.ts --workers=1 --reporter=line",
  );
  const specCanonicalOk = run("npm run qa:spec-canonical-parity");
  const parityValidationOk = run("npm run qa:competitor-parity-validation", {
    COMPETITOR_PARITY_STRICT: "1",
  });
  const cloneBatchOk = run("npm run qa:competitor-clone-batch", {
    COMPETITOR_CLONE_BATCH: "all",
  });
  const gameplayInteractionOk = run("npm run qa:sample-gameplay-interaction");

  const snap = {
    at: new Date().toISOString(),
    e2eAstrocadeOk,
    e2eCloneOk,
    e2eGodotOk,
    e2eSamplesEnOk,
    specCanonicalOk,
    parityValidationOk,
    cloneBatchOk,
    gameplayInteractionOk,
    godotMatrix: {
      templates: [...PRODUCT.godot.supportedTemplates],
      templateCount: PRODUCT.godot.supportedTemplates.length,
      e2eSpecs: [...GODOT_E2E],
      e2eGodotOk,
      playSummaryPath: "qa-output/godot-matrix/summary.json",
    },
    e2eAllOk:
      e2eAstrocadeOk &&
      e2eCloneOk &&
      e2eGodotOk &&
      e2eSamplesEnOk &&
      specCanonicalOk &&
      parityValidationOk &&
      cloneBatchOk &&
      gameplayInteractionOk,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(snap, null, 2));
  console.log(`[monitor] gates → ${path.relative(process.cwd(), OUT)}`);
  console.log(
    `[monitor] godot matrix · ${snap.godotMatrix.templateCount} templates · e2eGodotOk=${e2eGodotOk}`,
  );

  if (snap.e2eAllOk) {
    console.log("\n→ 门禁全绿，写入回归归档");
    try {
      execSync("npm run qa:regression-archive", { stdio: "inherit", cwd: process.cwd() });
    } catch (e) {
      console.warn("[warn] qa:regression-archive failed (gates still OK)", e);
    }
  }

  if (!snap.e2eAllOk) {
    console.error("[FAIL] qa:competitor-gates — E2E subset failed");
    process.exit(1);
  }
  console.log("[OK] qa:competitor-gates");
}

main();
