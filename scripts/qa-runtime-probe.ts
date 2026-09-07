/**
 * Verifies the runtime probe against builds whose behaviour is already known.
 *
 * A probe that reports success on a broken build is worse than no probe, so
 * this checks it both ways: the last real build (which was verified playable
 * by hand in a browser) must come back observed and clean, and deliberately
 * broken variants of it must come back with the matching finding.
 *
 *   npx tsx scripts/qa-runtime-probe.ts
 */
import fs from "node:fs";
import path from "node:path";
import { runRuntimeProbe } from "../src/lib/game-forge/runtime-probe";
import type { GameBuild } from "../src/lib/game-forge/types";

const BUILD_PATH = path.join(process.cwd(), "qa-output", "game-forge-live", "build.json");

function loadBuild(): GameBuild {
  if (!fs.existsSync(BUILD_PATH)) {
    console.error(`[skip] no build at ${BUILD_PATH} — run qa-game-forge-live first`);
    process.exit(0);
  }
  return JSON.parse(fs.readFileSync(BUILD_PATH, "utf8")) as GameBuild;
}

function withSource(build: GameBuild, source: string): GameBuild {
  return { ...build, source };
}

async function main() {
  const build = loadBuild();
  console.log(`build: ${build.design.title} (${build.source.length} chars, ${build.modules.length} modules)\n`);

  /* ------------------------------------------------- the known-good build -- */
  const good = await runRuntimeProbe(build);
  if (!good.observed) {
    console.error(`[FAIL] probe could not run: ${good.unavailable}`);
    process.exit(1);
  }
  console.log("known-good build:");
  console.log(`  booted=${good.booted} firstFrame=${good.firstFrameMs}ms frames=${good.frames} entities=${good.maxEntities}`);
  console.log(`  errors=${good.errors.length} findings=${good.findings.map((f) => f.code).join(",") || "none"} (${good.durationMs}ms)`);
  if (!good.booted) { console.error("[FAIL] a build verified playable by hand must boot under the probe"); process.exit(1); }
  if (good.errors.length) { console.error(`[FAIL] unexpected runtime errors: ${good.errors.join(" | ")}`); process.exit(1); }
  // A false "inert" is worse than a slow probe: it sends a working build into
  // a repair round that rewrites whole modules and can only regress it.
  if (good.findings.some((f) => f.code === "inert_build")) {
    console.error("[FAIL] a build verified playable by hand must not be called inert — the observation window is too short");
    process.exit(1);
  }

  /* ------------------------------------------- a build that cannot parse -- */
  const broken = await runRuntimeProbe(withSource(build, `${build.source}\nfunction G.oops(a, b) { return 1; }`));
  console.log("\nsyntax-error build:");
  console.log(`  booted=${broken.booted} findings=${broken.findings.map((f) => f.code).join(",") || "none"}`);
  if (broken.booted) { console.error("[FAIL] a build that cannot parse must not report as booted"); process.exit(1); }
  if (!broken.findings.some((f) => f.code === "did_not_boot" || f.code === "runtime_error")) {
    console.error("[FAIL] a build that cannot parse must produce a blocker");
    process.exit(1);
  }

  /* ------------------------------------------ a build that throws on boot -- */
  const throws = await runRuntimeProbe(
    withSource(build, "function mountGame(root, ctx) { throw new Error('probe_boot_failure'); }"),
  );
  console.log("\nthrowing build:");
  console.log(`  booted=${throws.booted} errors=${throws.errors.length} findings=${throws.findings.map((f) => f.code).join(",") || "none"}`);
  if (throws.booted) { console.error("[FAIL] a build that throws must not report as booted"); process.exit(1); }
  if (!throws.errors.some((e) => e.includes("probe_boot_failure"))) {
    console.error("[FAIL] the thrown message must be captured");
    process.exit(1);
  }

  /* ------------------------------------- a build that mounts but does nothing -- */
  const inert = await runRuntimeProbe(
    withSource(
      build,
      `function mountGame(root, ctx) {
         var g = GameForge.create(root, { width: 960, height: 540, title: ctx.title, onFinish: ctx.finish });
         g.start({ update: function () {}, draw: function () {} });
       }`,
    ),
  );
  console.log("\ninert build (mounts, renders, does nothing):");
  console.log(`  booted=${inert.booted} frames=${inert.frames} findings=${inert.findings.map((f) => f.code).join(",") || "none"}`);
  if (!inert.booted) { console.error("[FAIL] the inert build does mount, so it must report booted"); process.exit(1); }
  if (!inert.findings.some((f) => f.code === "inert_build")) {
    console.error("[FAIL] a build where nothing responds to input must be flagged inert — this is the G.player defect's signature");
    process.exit(1);
  }

  console.log("\n[OK] qa-runtime-probe: observes a good build cleanly and catches unparseable, throwing and inert builds");
}

main().catch((e) => { console.error("FATAL", e?.message || e); process.exit(1); });
