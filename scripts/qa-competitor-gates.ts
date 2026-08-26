/**
 * 竞品 parity 门禁快照（供 astrocade-competitor-matrix 读入）
 * npm run qa:competitor-gates
 *
 * Godot 双轨已退役：不再跑 Godot E2E / 导出矩阵；e2eGodotOk 固定为 skipped→true。
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { resolveCloneBatchGateOk, type CloneBatchSummary } from "../src/lib/qa/competitor-gates-summary";

const OUT = path.join(process.cwd(), "qa-output", "competitor-gates.json");
const CLONE_BATCH_SUMMARY = path.join(process.cwd(), "qa-output", "competitor-clone-batch", "summary.json");
const LOCAL_BASE = "http://127.0.0.1:8888";
const LOCAL_ENV = { PLAYWRIGHT_BASE_URL: LOCAL_BASE };

type GateSnap = {
  at: string;
  e2eAstrocadeOk: boolean;
  e2eCloneOk: boolean;
  /** @deprecated Godot retired — always true (skipped). */
  e2eGodotOk: boolean;
  e2eSamplesEnOk: boolean;
  specCanonicalOk: boolean;
  parityValidationOk: boolean;
  cloneBatchOk: boolean;
  gameplayInteractionOk: boolean;
  godotMatrix: {
    templates: string[];
    templateCount: number;
    e2eSpecs: string[];
    e2eGodotOk: boolean;
    playSummaryPath: string;
    retired?: boolean;
  };
  e2eAllOk: boolean;
};

const RETIRED_GODOT_MATRIX: GateSnap["godotMatrix"] = {
  templates: [],
  templateCount: 0,
  e2eSpecs: [],
  e2eGodotOk: true,
  playSummaryPath: "qa-output/godot-matrix/summary.json",
  retired: true,
};

function run(cmd: string, extraEnv?: Record<string, string>, timeoutMs?: number): boolean {
  try {
    execSync(cmd, {
      stdio: "inherit",
      cwd: process.cwd(),
      timeout: timeoutMs,
      env: { ...process.env, PW_REUSE_SERVER: "1", ...LOCAL_ENV, ...extraEnv },
    });
    return true;
  } catch (e) {
    console.warn(`[gates] step failed: ${cmd}`, e instanceof Error ? e.message : e);
    return false;
  }
}

function writeFinalSnap(snap: GateSnap): void {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(snap, null, 2));
}

function readCloneBatchSummary(): CloneBatchSummary | null {
  if (!fs.existsSync(CLONE_BATCH_SUMMARY)) return null;
  try {
    return JSON.parse(fs.readFileSync(CLONE_BATCH_SUMMARY, "utf8")) as CloneBatchSummary;
  } catch {
    return null;
  }
}

async function cooldown(label: string, ms = 3000): Promise<void> {
  console.log(`[gates] ${label} — 冷却 ${ms}ms`);
  await sleep(ms);
}

function writeSnap(partial: Partial<GateSnap> & Pick<GateSnap, "at">): void {
  let prev: Partial<GateSnap> = {};
  if (fs.existsSync(OUT)) {
    try {
      prev = JSON.parse(fs.readFileSync(OUT, "utf8")) as Partial<GateSnap>;
    } catch {
      /* ignore */
    }
  }
  const snap: GateSnap = {
    at: partial.at,
    e2eAstrocadeOk: partial.e2eAstrocadeOk ?? prev.e2eAstrocadeOk ?? false,
    e2eCloneOk: partial.e2eCloneOk ?? prev.e2eCloneOk ?? false,
    e2eGodotOk: partial.e2eGodotOk ?? true,
    e2eSamplesEnOk: partial.e2eSamplesEnOk ?? prev.e2eSamplesEnOk ?? false,
    specCanonicalOk: partial.specCanonicalOk ?? prev.specCanonicalOk ?? false,
    parityValidationOk: partial.parityValidationOk ?? prev.parityValidationOk ?? false,
    cloneBatchOk: partial.cloneBatchOk ?? prev.cloneBatchOk ?? false,
    gameplayInteractionOk: partial.gameplayInteractionOk ?? prev.gameplayInteractionOk ?? false,
    godotMatrix: partial.godotMatrix ?? prev.godotMatrix ?? RETIRED_GODOT_MATRIX,
    e2eAllOk: false,
  };
  snap.e2eAllOk =
    snap.e2eAstrocadeOk &&
    snap.e2eCloneOk &&
    snap.e2eSamplesEnOk &&
    snap.specCanonicalOk &&
    snap.parityValidationOk &&
    snap.cloneBatchOk &&
    snap.gameplayInteractionOk;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(snap, null, 2));
}

function healthOk(): boolean {
  try {
    execSync(
      `node -e "fetch('${LOCAL_BASE}/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"`,
      { stdio: "pipe", timeout: 8000 },
    );
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const startedAt = new Date().toISOString();
  if (!healthOk()) {
    console.error("[FAIL] dev not at :8888 — start dev before qa:competitor-gates");
    process.exit(1);
  }

  if (!run("npm run seed:samples")) {
    console.error("[FAIL] seed:samples — 样品馆未就绪，双验证无法跑");
    process.exit(1);
  }

  if (!run("npm run seed:sample-assets")) {
    console.error("[FAIL] seed:sample-assets — 样品 sprite/背景未就绪");
    process.exit(1);
  }

  const e2eGodotOk = true;
  const godotMatrix = RETIRED_GODOT_MATRIX;
  console.log("[gates] Godot matrix skipped (PRODUCT.godot.enabled=false / retired from CI)");

  const e2eAstrocadeOk = run("npm run test:e2e:astrocade");
  writeSnap({ at: startedAt, e2eAstrocadeOk, e2eGodotOk, godotMatrix });
  await cooldown("e2e astrocade");

  const e2eCloneOk = run(
    "npx playwright test e2e/competitor-clone.smoke.spec.ts --workers=1 --reporter=line",
    undefined,
    120_000,
  );
  writeSnap({ at: startedAt, e2eAstrocadeOk, e2eCloneOk, e2eGodotOk, godotMatrix });
  await cooldown("e2e clone smoke");

  const e2eSamplesEnOk = run(
    "npx playwright test e2e/samples-en-matrix.smoke.spec.ts --workers=1 --reporter=line",
    undefined,
    300_000,
  );
  writeSnap({ at: startedAt, e2eAstrocadeOk, e2eCloneOk, e2eGodotOk, e2eSamplesEnOk, godotMatrix });
  await cooldown("samples en");

  const specCanonicalOk = run("npm run qa:spec-canonical-parity");
  writeSnap({
    at: startedAt,
    e2eAstrocadeOk,
    e2eCloneOk,
    e2eGodotOk,
    e2eSamplesEnOk,
    specCanonicalOk,
    godotMatrix,
  });

  const parityValidationOk = run(
    "npm run qa:competitor-parity-validation",
    { COMPETITOR_PARITY_STRICT: "1" },
    600_000,
  );
  writeSnap({
    at: startedAt,
    e2eAstrocadeOk,
    e2eCloneOk,
    e2eGodotOk,
    e2eSamplesEnOk,
    specCanonicalOk,
    parityValidationOk,
    godotMatrix,
  });
  await cooldown("parity validation", 4000);

  /** 玩法交互先于 clone batch，避免连续 Playwright 长跑在 Windows 上挂起 */
  const gameplayInteractionOk = run("npm run qa:sample-gameplay-interaction", LOCAL_ENV, 600_000);
  writeSnap({
    at: startedAt,
    e2eAstrocadeOk,
    e2eCloneOk,
    e2eGodotOk,
    e2eSamplesEnOk,
    specCanonicalOk,
    parityValidationOk,
    gameplayInteractionOk,
    godotMatrix,
  });
  await cooldown("gameplay interaction", 4000);

  const cloneBatchCommandOk = run(
    "npm run qa:competitor-clone-batch",
    { COMPETITOR_CLONE_BATCH: "all" },
    1_800_000,
  );
  const cloneBatchOk = resolveCloneBatchGateOk({
    commandOk: cloneBatchCommandOk,
    summary: readCloneBatchSummary(),
  });

  const snap: GateSnap = {
    at: startedAt,
    e2eAstrocadeOk,
    e2eCloneOk,
    e2eGodotOk,
    e2eSamplesEnOk,
    specCanonicalOk,
    parityValidationOk,
    cloneBatchOk,
    gameplayInteractionOk,
    godotMatrix,
    e2eAllOk:
      e2eAstrocadeOk &&
      e2eCloneOk &&
      e2eSamplesEnOk &&
      specCanonicalOk &&
      parityValidationOk &&
      cloneBatchOk &&
      gameplayInteractionOk,
  };

  writeFinalSnap(snap);
  console.log(`[monitor] gates → ${path.relative(process.cwd(), OUT)}`);
  console.log(`[monitor] godot matrix · retired (skipped)`);

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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
