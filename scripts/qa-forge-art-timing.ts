/**
 * Times the art agent slot by slot against the last live design.
 *
 * The code line finishes in ~150s while a full build with art ran past 40
 * minutes, so art is the whole gap. A per-slot timing tells the difference
 * between "the image model is slow" and "one slot hangs with no ceiling",
 * which need opposite fixes.
 *
 *   npx tsx scripts/qa-forge-art-timing.ts
 */
import { prisma } from "../src/lib/prisma";
import fs from "node:fs";
import path from "node:path";
import { runForgeAssetAgent } from "../src/lib/game-forge/asset-agent";
import type { GameBuild } from "../src/lib/game-forge/types";

async function main() {
  const buildPath = path.join(process.cwd(), "qa-output", "game-forge-live", "build.json");
  const build = JSON.parse(fs.readFileSync(buildPath, "utf8")) as GameBuild;
  console.log(`design: ${build.design.title} — ${build.design.assets.length} slot(s)`);
  for (const a of build.design.assets) console.log(`  - ${a.key} (${a.kind}) required=${a.required}`);

  const t0 = Date.now();
  // A fresh id every run: the agent reuses an existing file for a slot, so a
  // fixed id measures the filesystem, not the image model.
  const projectId = `forge-art-timing-${Date.now().toString(36)}`;
  const run = await runForgeAssetAgent(projectId, build.design, {
    onSlotDone: (s) =>
      console.log(`  +${((Date.now() - t0) / 1000).toFixed(1)}s  ${s.url ? "OK  " : "FAIL"} ${s.key.padEnd(20)} ${s.durationMs}ms  ${s.url ?? s.error}`),
  });
  console.log(`\n[art] ${run.generated} generated, ${run.failed} failed, wall clock ${(run.durationMs / 1000).toFixed(1)}s`);
  const slowest = [...run.results].sort((a, b) => b.durationMs - a.durationMs)[0];
  if (slowest) console.log(`  slowest slot: ${slowest.key} at ${(slowest.durationMs / 1000).toFixed(1)}s`);
}

main()
  .catch((e) => { console.error("FATAL", e?.message || e); process.exitCode = 1; })
  // Generating an image records provider usage through prisma, whose pool
  // holds the event loop open. Disconnect or the process never exits.
  .finally(() => prisma.$disconnect());
