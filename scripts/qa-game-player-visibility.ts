import assert from "node:assert/strict";
import { mockSpecFromPrompt } from "@/lib/mock-spec";
import type { GameSpec } from "@/lib/game-spec";
import { validateGameRuntime } from "@/lib/game-runtime-validation";
import { chromium } from "playwright";
import fs from "node:fs/promises";
import { GAME_FORGE_SDK_SOURCE } from "@/lib/game-forge/runtime-sdk";
import { runRuntimeProbe } from "@/lib/game-forge/runtime-probe";
import { playerEvidenceFindings } from "@/lib/game-forge/player-evidence";
import type { GameBuild } from "@/lib/game-forge/types";

const base = mockSpecFromPrompt("方向键移动小熊猫");
function fixture(mode: "good" | "offscreen" | "detached") {
  return { ...base, forgeBuild: { design: { assets: [{ kind: "player", key: "player" }], controls: [{ action: "移动", desktop: "方向键" }] } },
    agenticModule: { version: 2, entry: "mountGame", source: `function mountGame(root,ctx){
      const g=GameForge.create(root,{width:540,height:960});
      const im=g.assets.image(null,'player','#ff8a40');let p, detached={x:270,y:860};
      g.start({init(){p=g.world.spawn('player',{x:270,y:${mode === "offscreen" ? 1500 : 860},r:30});},
        update(dt){${mode === "detached" ? "detached" : "p"}.x+=g.input.axis().x*300*dt;},
        draw(r){r.sprite(im,p.x,p.y,66,84);r.ui.begin();r.text('时间 70',270,30,{size:26,color:'#ffffff',stroke:'#000000',strokeWidth:5});r.ui.end();}});
    }` } } as unknown as GameSpec;
}
async function main() {
  const good = await validateGameRuntime(fixture("good"));
  assert.equal(good.status, "passed", JSON.stringify(good));
  const hidden = await validateGameRuntime(fixture("offscreen"));
  assert.ok(hidden.blockers.includes("runtime_player_not_visible"), JSON.stringify(hidden));
  const detached = await validateGameRuntime(fixture("detached"));
  assert.ok(detached.blockers.includes("runtime_player_input_no_visible_response"), JSON.stringify(detached));
  const noCollectible = fixture("good");
  noCollectible.forgeBuild!.design.assets.push({ kind: "collectible", key: "star" });
  const missingPickup = await validateGameRuntime(noCollectible);
  assert.ok(missingPickup.blockers.includes("runtime_collectible_not_visible"), JSON.stringify(missingPickup));

  const offscreenPickup = playerEvidenceFindings(
    noCollectible.forgeBuild!.design,
    Array.from({ length: 8 }, (_, index) => ({
      type: "forge-player-evidence",
      inputActive: true,
      players: [{ kind: "player", x: 270 + index * 5, y: 840, screenX: 0.5 + index * 0.01, screenY: 0.875, visible: true }],
      sprites: [{ kind: "collectible", x: index < 4 ? 760 : 270, y: 200, screenX: index < 4 ? 1.41 : 0.5, screenY: 0.2, visible: index >= 4 }],
    })),
  );
  assert.ok(offscreenPickup.some(finding => finding.code === "collectible_spawn_outside_viewport"), JSON.stringify(offscreenPickup));
  const bad = fixture("detached");
  const probe = await runRuntimeProbe({ design: { ...bad.forgeBuild!.design, title: "fixture", pitch: "move", progression: { winCondition: "collect" } }, source: bad.agenticModule!.source } as GameBuild);
  assert.ok(probe.findings.some(f => f.code === "player_input_no_visible_response"), JSON.stringify(probe));

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 540, height: 960 }, hasTouch: true });
    await page.setContent(`<style>body{margin:0}</style><main id="game" style="width:540px;height:960px"></main><script>${GAME_FORGE_SDK_SOURCE}</script><script>
      const g=GameForge.create(document.getElementById('game'),{width:540,height:960});window.fixture=g;
      const im=g.assets.image(null,'player','#ff8a40');let p;
      g.start({init(){p=g.world.spawn('player',{x:270,y:860,r:30});},update(){if(g.input.pointer.down)p.x=g.input.pointer.x;},
      draw(r){r.sprite(im,p.x,p.y,66,84);r.ui.begin();r.text('时间 70',270,30,{size:26,color:'#ffffff',stroke:'#000000',strokeWidth:5});r.ui.end();}});
    </script>`);
    await page.waitForTimeout(350);
    const inspect = () => page.evaluate(() => {
      const g = (window as unknown as { fixture: { draw: { camera: { x: number; y: number } }; world: { get: (kind: string) => Array<{x:number;y:number}> } } }).fixture;
      const canvas = document.querySelector("canvas")!;
      const ctx = canvas.getContext("2d")!;
      const pixels = ctx.getImageData(190, 10, 160, 40).data;
      let white = 0;
      for (let i=0;i<pixels.length;i+=4) if (pixels[i]! > 230 && pixels[i+1]! > 230 && pixels[i+2]! > 230) white++;
      return { player: {x:g.world.get('player')[0]!.x,y:g.world.get('player')[0]!.y}, white };
    });
    assert.ok((await inspect()).white > 100, "White glyph faces must remain visible inside black stroke");
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:270,y:860}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:400,y:860}]});
    await page.waitForTimeout(350);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.ok((await inspect()).player.x > 390, "Real touch drag must move visible player");
    await page.evaluate("window.fixture.draw.camera.x=0;window.fixture.restart()");
    await page.waitForTimeout(350);
    assert.equal((await inspect()).player.x,270);
    await fs.mkdir('qa-output/game-player-visibility',{recursive:true});
    await page.screenshot({path:'qa-output/game-player-visibility/engine-restart.png'});
  } finally { await browser.close(); }
  console.log("PASS: visible controlled actor passes; offscreen and detached actor fail");
}
void main();
