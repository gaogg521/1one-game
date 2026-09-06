/**
 * Rebuilds the playable page from the last live run, wiring the art the asset
 * agent actually produced. Model-free, so the browser check can be repeated
 * without paying for another pipeline run.
 */
import fs from "node:fs";
import path from "node:path";
import { GAME_FORGE_SDK_SOURCE } from "../src/lib/game-forge/runtime-sdk";
import type { GameBuild } from "../src/lib/game-forge/types";

const OUT_DIR = path.join(process.cwd(), "qa-output", "game-forge-live");
const PROJECT_ID = process.env.FORGE_PREVIEW_PROJECT ?? "forge-live-demo";

/**
 * Served over HTTP from the repo root, so the page can reference the art the
 * way the real app does. A file:// page is turned into a `data:` URL by the
 * preview pane, and a data URL has no base — relative hrefs never resolve
 * there, so every actor falls back to the SDK placeholder and a working art
 * pipeline looks broken.
 */
function assetHref(rel: string): string {
  return `/public/${rel}`;
}

function main() {
  const build = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "build.json"), "utf8")) as GameBuild;

  const assets: Record<string, string> = {};
  for (const slot of build.design.assets) {
    const rel = slot.kind === "background" ? `game-bg/${PROJECT_ID}.png` : `game-sprites/${PROJECT_ID}/${slot.key}.png`;
    const abs = path.join(process.cwd(), "public", rel);
    if (fs.existsSync(abs)) assets[slot.key] = assetHref(rel);
  }
  const missing = build.design.assets.filter((s) => !assets[s.key]).map((s) => s.key);

  const ctx = { title: build.design.title, prompt: build.design.pitch, winScore: 20, assets };
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${build.design.title}</title><style>html,body,#game{margin:0;width:100%;height:100%;overflow:hidden;background:#06130e}*{box-sizing:border-box}</style></head><body><main id="game"></main>
<script>${GAME_FORGE_SDK_SOURCE}</script>
<script>
window.__forge={events:[],errors:[]};
window.addEventListener('message',(e)=>{if(e.data&&e.data.type)window.__forge.events.push(e.data);});
const ctx=${JSON.stringify(ctx)};
ctx.finish=(won,score=0)=>window.__forge.events.push({type:'operone-game-end',won:!!won,score:score});
ctx.reportError=(e)=>{window.__forge.errors.push(String(e&&e.message?e.message:e));console.error(e);};
try{
${build.source}
;if(typeof mountGame!=='function')throw new Error('mountGame missing');
mountGame(document.getElementById('game'),ctx);
}catch(error){ctx.reportError(error);}
</script></body></html>`;

  const outFile = path.join(OUT_DIR, "playable.html");
  fs.writeFileSync(outFile, html, "utf8");
  console.log(`title      : ${build.design.title}`);
  console.log(`modules    : ${build.modules.length}, assembled ${build.source.length} chars`);
  console.log(`qa         : ok=${build.qa.ok} findings=${build.qa.findings.length}`);
  console.log(`art wired  : ${Object.keys(assets).length}/${build.design.assets.length}${missing.length ? ` (missing: ${missing.join(", ")})` : ""}`);
  console.log(`page       : ${outFile}`);
}
main();
