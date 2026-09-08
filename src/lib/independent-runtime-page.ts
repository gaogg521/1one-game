import type { GameSpec } from "@/lib/game-spec";
import { GAME_FORGE_SDK_SOURCE } from "@/lib/game-forge/runtime-sdk";

export function independentRuntimeContext(spec: GameSpec, projectId?: string) {
  const assets: Record<string, string> = {};
  if (projectId) {
    assets.background = `/game-bg/${projectId}.png`;
    for (const [key, file] of [["player", "player"], ["enemy", "hazard"], ["collectible", "gem"], ["power", "power"], ["boss", "boss"]]) {
      assets[key!] = `/game-sprites/${projectId}/${file}.png`;
    }
    const design = spec.forgeBuild?.design as { assets?: Array<{ key?: string; kind?: string }> } | undefined;
    for (const slot of design?.assets ?? []) {
      if (slot.key) assets[slot.key] = slot.kind === "background" ? assets.background! : `/game-sprites/${projectId}/${slot.key}.png`;
    }
    assets.music = `/api/projects/${projectId}/bgm`;
  }
  return { title: spec.title, prompt: spec.labels.subtitle ?? "", winScore: spec.gameplay.winScore ?? 100, assets };
}

/** Shared by the player and the delivery probe, including sandbox execution. */
export function buildIndependentRuntimePage(spec: GameSpec, projectId?: string): string {
  const script = (value: string) => value.replace(/<\/script/gi, "<\\/script");
  const context = JSON.stringify(independentRuntimeContext(spec, projectId)).replace(/</g, "\\u003c");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>html,body,#game{margin:0;width:100%;height:100%;overflow:hidden;background:#06130e}*{box-sizing:border-box}</style></head><body><main id="game"></main>
<script>
window.__runtimePost=function(t,p){parent.postMessage(Object.assign({type:t},p||{}),'*')};
window.addEventListener('error',function(e){if(e.message)window.__runtimePost('operone-game-error',{message:String(e.message)})});
window.addEventListener('unhandledrejection',function(e){window.__runtimePost('operone-game-error',{message:String(e.reason)})});
['pointerdown','keydown'].forEach(function(type){window.addEventListener(type,function(e){if(e.isTrusted)window.__runtimePost('operone-game-input')},true)});
</script>
<script>${script(GAME_FORGE_SDK_SOURCE)}</script>
<script>
(function(){
const ctx=${context};
ctx.finish=(won,score=0)=>window.__runtimePost('operone-game-end',{won:!!won,score:Number(score)||0});
ctx.reportError=(e)=>window.__runtimePost('operone-game-error',{message:String(e&&e.message?e.message:e)});
try {
${script(spec.agenticModule?.source ?? "")}
;if(typeof mountGame!=='function')throw new Error('mountGame missing');
mountGame(document.getElementById('game'),ctx);
window.__runtimePost('operone-game-mounted');
${spec.forgeBuild ? "" : "let lastPulse=0;function pulse(t){if(t-lastPulse>1000){window.__runtimePost('operone-game-heartbeat');lastPulse=t}requestAnimationFrame(pulse)}requestAnimationFrame(pulse);"}
}catch(error){ctx.reportError(error)}
})();
</script></body></html>`;
}
