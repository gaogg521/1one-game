/** 离线验证 physics LLM 样例在沙箱可 create（不调用 LLM） */
import { parseAgenticModule } from "../src/lib/agentic/game-module";
import { validateAgenticRunnable } from "../src/lib/agentic/agentic-runnable";

const SOURCE = `function createGame(ctx, Phaser){
  const W=ctx.width,H=ctx.height;
  const bg=ctx.colors?.background||0x1a1620, playerC=ctx.colors?.player||0x9b8cb2, hazardC=ctx.colors?.hazard||0xa85c40;
  let dummy, floor, hazard, ui, score=0, combo=0, comboT=0, lastHit=0, ended=false;
  function create(scene){
    scene.cameras.main.setBackgroundColor(bg);
    scene.physics.world.gravity.y=900;
    floor=scene.add.rectangle(W/2,H-18,W,36,0x0f0c14).setAlpha(0.9);
    scene.physics.add.existing(floor,true);
    dummy=scene.add.rectangle(W*0.35,H*0.55,64,96,playerC);
    scene.physics.add.existing(dummy);
    dummy.body.setCollideWorldBounds(true);
    hazard=scene.add.rectangle(W*0.72,H-62,70,70,hazardC);
    scene.physics.add.existing(hazard,true);
    scene.physics.add.collider(dummy,floor);
    ui=scene.add.text(12,54,'',{fontFamily:'Arial',fontSize:14,color:'#ffffff'});
    scene.input.on('pointerdown',()=>{ score+=1; ctx.onScore(1); if(score>=50) ctx.onEnd(true); });
  }
  return { create, update(){ } };
}`;

const mod = parseAgenticModule({ version: 1, source: SOURCE, entry: "createGame" });
if (!mod) {
  console.error("parse failed");
  process.exit(1);
}
const run = validateAgenticRunnable(mod);
console.log(run);
process.exit(run.ok ? 0 : 1);
