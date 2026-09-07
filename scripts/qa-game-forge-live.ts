/**
 * Live run: invokes the real multi-agent pipeline (design agent, N code
 * agents, QA agent, repair rounds) against a real model, for one real prompt.
 * Not a regression test — a manual probe to see what the agents actually
 * produce before anyone claims the pipeline works.
 */
import { prisma } from "../src/lib/prisma";
import fs from "node:fs";
import path from "node:path";
import { forgeGame } from "../src/lib/game-forge/forge";

async function main() {
  const prompt = process.argv[2] ?? "一个关于熊猫在竹林里跳跃采集竹笋、躲避猎人陷阱的游戏，30秒内采集20根竹笋获胜";
  console.log(`[live] prompt: ${prompt}`);
  const t0 = Date.now();

  // Stage entry times, so the printed timeline shows which stages overlapped.
  // A pipeline claiming to be concurrent has to be measurable as concurrent.
  const stageTimes: Array<{ stage: string; at: number }> = [];
  const withArt = process.env.FORGE_LIVE_ART === "1";

  const result = await forgeGame({
    prompt,
    onProgress: (stage, detail, percent) => {
      if (stageTimes[stageTimes.length - 1]?.stage !== stage) stageTimes.push({ stage, at: Date.now() - t0 });
      console.log(`  [${String(percent).padStart(3)}%] +${((Date.now() - t0) / 1000).toFixed(1)}s ${stage}: ${detail}`);
    },
    // Mirror the worker exactly: art is handed to the forge so it runs beside
    // the code agents. Running it after the build (as this script used to)
    // measures a pipeline nobody ships.
    generateArt: withArt
      ? async (design, onSlotDone) => {
          const { runForgeAssetAgent } = await import("../src/lib/game-forge/asset-agent");
          const run = await runForgeAssetAgent("forge-live-demo", design, {
            onSlotDone: (slot) => onSlotDone({ key: slot.key, kind: slot.kind, url: slot.url, done: slot.done, total: slot.total }),
          });
          for (const r of run.results) console.log(`  [art] ${r.url ? "OK  " : "FAIL"} ${r.key.padEnd(24)} ${r.url ?? r.error} (${r.durationMs}ms)`);
          return { generated: run.generated, failed: run.failed, durationMs: run.durationMs };
        }
      : undefined,
  });

  const elapsed = Date.now() - t0;
  if (!result.ok) {
    console.error(`[FAIL] forgeGame failed after ${elapsed}ms: ${result.reason}`);
    if (result.partial?.design) {
      console.error(`  partial design was produced: "${result.partial.design.title}", ${result.partial.design.modules.length} modules planned`);
    }
    if (result.partial?.modules) {
      console.error(`  partial modules generated: ${result.partial.modules.map((m) => m.id).join(", ")}`);
    }
    process.exit(1);
  }

  const { build } = result;
  console.log(`\n[OK] build completed in ${elapsed}ms`);
  console.log(`  title: ${build.design.title}`);
  console.log(`  pitch: ${build.design.pitch}`);
  console.log(`  genre: ${build.design.genre}`);
  console.log(`  mechanics: ${build.design.mechanics.map((m) => m.id).join(", ")}`);
  console.log(`  asset slots: ${build.design.assets.map((a) => `${a.key}(${a.kind})`).join(", ")}`);
  console.log(`\n  modules (${build.modules.length}):`);
  for (const m of build.modules) {
    console.log(`    - ${m.id} (${m.role}) : ${m.source.length} chars, model=${m.model ?? "?"}`);
  }
  console.log(`\n  assembled source: ${build.source.length} chars`);
  console.log(`\n  qa: ok=${build.qa.ok} observed=${build.qa.observed} findings=${build.qa.findings.length}`);
  for (const f of build.qa.findings) console.log(`    [${f.severity}] ${f.moduleId}:${f.code} — ${f.message}`);
  console.log(`\n  provenance passes:`);
  for (const p of build.provenance.passes) {
    console.log(`    - ${p.agent} (${p.model ?? "n/a"}) ${p.durationMs}ms : ${p.changed.join(", ")}${p.note ? ` — ${p.note}` : ""}`);
  }

  const outDir = path.join(process.cwd(), "qa-output", "game-forge-live");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "build.json"), JSON.stringify(build, null, 2), "utf8");

  const ctx = { title: build.design.title, prompt, winScore: 20, assets: {} as Record<string, string> };
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${build.design.title}</title><style>html,body,#game{margin:0;width:100%;height:100%;overflow:hidden;background:#06130e}*{box-sizing:border-box}</style></head><body><main id="game"></main>
<script>${fs.readFileSync(path.join(process.cwd(), "src/lib/game-forge/runtime-sdk.ts"), "utf8").match(/GAME_FORGE_SDK_SOURCE = `([\s\S]*)`;\s*$/)?.[1] ?? ""}</script>
<script>
window.__forge={events:[],errors:[]};
window.addEventListener('message',(e)=>{if(e.data&&e.data.type)window.__forge.events.push(e.data);});
const ctx=${JSON.stringify(ctx)};
ctx.finish=(won,score=0)=>window.__forge.events.push({type:'operone-game-end',won:!!won,score});
ctx.reportError=(e)=>{window.__forge.errors.push(String(e&&e.message?e.message:e));console.error(e);};
try{
${build.source}
;if(typeof mountGame!=='function')throw new Error('mountGame missing');
mountGame(document.getElementById('game'),ctx);
}catch(error){ctx.reportError(error);}
</script></body></html>`;
  fs.writeFileSync(path.join(outDir, "live-build.html"), html, "utf8");
  console.log(`\n  stage timeline (a stage overlapping another means it ran in parallel):`);
  for (let i = 0; i < stageTimes.length; i += 1) {
    const cur = stageTimes[i]!;
    const next = stageTimes[i + 1];
    const span = ((next ? next.at : elapsed) - cur.at) / 1000;
    console.log(`    ${cur.stage.padEnd(10)} started +${(cur.at / 1000).toFixed(1)}s  took ${span.toFixed(1)}s`);
  }
  console.log(`    TOTAL ${(elapsed / 1000).toFixed(1)}s`);

  console.log(`\n  wrote ${path.join(outDir, "build.json")}`);
  console.log(`  wrote ${path.join(outDir, "live-build.html")}`);
}

main()
  .catch((err) => {
    console.error("[FAIL] unhandled error", err);
    process.exitCode = 1;
  })
  // The image layer records provider usage through prisma, whose connection
  // pool keeps the event loop alive forever. Without this the script prints
  // its whole report and then hangs -- which is how a three-run measurement
  // silently only ever ran the first one.
  .finally(() => prisma.$disconnect());
