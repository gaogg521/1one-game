/**
 * The art stage must never hold a build hostage.
 *
 * Measured on this gateway a full art stage is ~36s, but the image layer's
 * own default ceiling is twelve minutes per call with a second provider behind
 * it, and one hung request once turned a 147-second build into a run that was
 * still going 40 minutes later. The budget is what bounds that. This asserts
 * the bound exists and actually fires, with no network involved: a spent
 * budget must refuse the slot before it can start a fresh attempt.
 *
 *   npx tsx scripts/qa-forge-art-budget.ts
 */
import { prisma } from "../src/lib/prisma";
import { runForgeAssetAgent } from "../src/lib/game-forge/asset-agent";
import { PRODUCT } from "../src/lib/product-config";
import type { GameDesignDoc } from "../src/lib/game-forge/types";

const DESIGN = {
  title: "budget probe",
  pitch: "a design that exists only to exercise the art budget",
  genre: "arcade",
  assets: [
    { key: "hero", kind: "player", prompt: "a hero", required: true },
    { key: "foe", kind: "obstacle", prompt: "a foe", required: true },
  ],
} as unknown as GameDesignDoc;

async function main() {
  if (!(PRODUCT.gameForge.artSlotTimeoutMs > 0)) { console.error("[FAIL] artSlotTimeoutMs must be set"); process.exit(1); }
  if (!(PRODUCT.gameForge.artBudgetMs > PRODUCT.gameForge.artSlotTimeoutMs)) {
    console.error("[FAIL] the stage budget must exceed one slot, or the first slot always consumes it");
    process.exit(1);
  }
  console.log(`budget: ${PRODUCT.gameForge.artBudgetMs}ms stage / ${PRODUCT.gameForge.artSlotTimeoutMs}ms slot`);

  const t0 = Date.now();
  const run = await runForgeAssetAgent(`art-budget-probe-${Date.now().toString(36)}`, DESIGN, { budgetMs: 0 });
  const elapsed = Date.now() - t0;

  console.log(`spent-budget run: ${run.generated} generated, ${run.failed} failed in ${elapsed}ms`);
  for (const r of run.results) console.log(`  ${r.key}: ${r.error ?? r.url}`);

  if (elapsed > 3_000) { console.error(`[FAIL] a spent budget must refuse immediately, took ${elapsed}ms`); process.exit(1); }
  if (run.generated !== 0) { console.error("[FAIL] no slot may be generated once the budget is spent"); process.exit(1); }
  if (!run.results.every((r) => (r.error ?? "").includes("budget"))) {
    console.error("[FAIL] every refused slot must say the budget was the reason");
    process.exit(1);
  }
  console.log("\n[OK] qa-forge-art-budget: a spent art budget refuses slots instead of starting fresh attempts");
}

main()
  .catch((e) => { console.error("FATAL", e?.message || e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
