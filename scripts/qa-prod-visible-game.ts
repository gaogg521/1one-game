/** Real pointer/keyboard play against a generated production game. Observes draw calls; never changes game state. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";

type Draw = { src: string; x: number; y: number; at: number };
type Observation = { draws: Draw[]; text: Array<{ text: string; at: number }> };
type Event = { type: string; won?: boolean; score?: number; players?: Array<{x:number;y:number;screenX:number;screenY:number;visible:boolean}> };
const base = "https://operone.1oneclaw.com";
async function main() {
  assert.equal(process.env.QA_PROD_VISIBLE_GAME, "1");
  const id = process.env.QA_PROJECT_ID;
  const state = process.env.QA_RESUME_STATE;
  assert.ok(id && state);
  const mode = process.env.QA_PLAY_MODE ?? "inspect";
  const out = `qa-output/prod-visible-game-20260910/${mode}`;
  await fs.mkdir(out, {recursive:true});
  const browser = await chromium.launch();
  const context = await browser.newContext({ storageState:state, viewport:{width:393,height:852},hasTouch:true,isMobile:true });
  await context.addInitScript(() => {
    const scope = window as unknown as { events: Event[]; observation: Observation };
    scope.events=[];scope.observation={draws:[],text:[]};
    window.addEventListener('message',e=>{if(e.source===document.querySelector('iframe')?.contentWindow && e.data?.type) scope.events.push(e.data);});
    const draw=CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage=function(...args: Parameters<typeof draw>){
      Reflect.apply(draw,this,args);
      if(this.canvas.width<200)return;
      const im=args[0];
      if(!(im instanceof HTMLImageElement))return;
      const m=this.getTransform();
      scope.observation.draws.push({src:im.src,x:m.e/this.canvas.width,y:m.f/this.canvas.height,at:performance.now()});
      if(scope.observation.draws.length>1000)scope.observation.draws.splice(0,500);
    };
    const text=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(...args:Parameters<typeof text>){
      Reflect.apply(text,this,args);
      scope.observation.text.push({text:String(args[0]),at:performance.now()});
      if(scope.observation.text.length>500)scope.observation.text.splice(0,250);
    };
  });
  const page=await context.newPage();
  const report: Record<string,unknown>={pass:false,projectId:id,mode};
  try {
    await page.goto(`${base}/zh-Hans/play/${id}`,{waitUntil:'domcontentloaded'});
    const canvas=page.frameLocator('iframe').locator('canvas');
    await canvas.waitFor({timeout:30000});
    await canvas.scrollIntoViewIfNeeded();
    await page.waitForFunction("window.events.some(e=>e.type==='forge-player-evidence')",undefined,{timeout:15000});
    const frame=page.frames().find(f=>f!==page.mainFrame())!;
    const player=()=>page.evaluate("window.events.filter(e=>e.type==='forge-player-evidence').at(-1)?.players?.find(p=>p.visible)") as Promise<NonNullable<Event['players']>[number]>;
    const observe=()=>frame.evaluate<Observation>("({draws:window.observation.draws.filter(d=>d.at>performance.now()-100),text:window.observation.text.filter(d=>d.at>performance.now()-100)})");
    const first=await player();assert.ok(first?.visible,'Player must be drawn inside viewport');
    await page.screenshot({path:`${out}/initial.png`});
    await canvas.tap();
    await page.keyboard.down('ArrowRight');await page.waitForTimeout(700);await page.keyboard.up('ArrowRight');
    const right=await player();
    await page.screenshot({path:`${out}/keyboard-right.png`});
    await page.keyboard.down('ArrowLeft');await page.waitForTimeout(1000);await page.keyboard.up('ArrowLeft');
    const left=await player();
    assert.ok(right.x>first.x+10 && left.x<right.x-10,'Visible actor must follow both keyboard directions');
    const box=await canvas.boundingBox();assert.ok(box);
    const cdp=await context.newCDPSession(page);
    const point=(x:number,y:number)=>({x:box.x+box.width*x,y:box.y+box.height*y});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(left.screenX,left.screenY)]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(0.7,left.screenY)]});
    await page.waitForTimeout(700);
    const touch=await player();assert.ok(touch.x>left.x+20,'Touch drag must move the rendered actor');
    await page.screenshot({path:`${out}/touch-right.png`});
    report.controls={first,right,left,touch};
    if(mode==='inspect') { await fs.writeFile(`${out}/observation.json`,JSON.stringify(await observe(),null,2)); return; }
    const started=Date.now();let lastHud='';let screenshots=0;
    const timeline:unknown[]=[];
    while(Date.now()-started<100000) {
      const obs=await observe();const p=await player();
      const falling=obs.draws.filter(d=>d.y>0.1 && d.y<p.screenY+0.04);
      const hazards=falling.filter(d=>/meteor|hazard|rock|enemy/i.test(d.src));
      const stars=falling.filter(d=>/star|collectible|gem/i.test(d.src));
      const targets=(mode==='lose'?hazards:stars).sort((a,b)=>b.y-a.y);
      let x=targets[0]?.x ?? p.screenX;
      if(mode==='win') {
        const near=hazards.filter(d=>d.y>p.screenY-0.2 && Math.abs(d.x-x)<0.13);
        if(near.length)x=near[0]!.x<0.5?0.85:0.15;
      }
      x=Math.max(0.08,Math.min(0.92,x));
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(x,p.screenY)]});
      const hud=[...new Set(obs.text.map(t=>t.text))].join(' | ');
      if(hud!==lastHud){timeline.push({ms:Date.now()-started,hud,player:p,targets:targets.slice(0,2)});lastHud=hud;}
      if(Date.now()-started>(screenshots+1)*12000 && screenshots<5){screenshots++;await page.screenshot({path:`${out}/playing-${screenshots}.png`});}
      if(await page.evaluate("window.events.some(e=>e.type==='forge-end'||e.type==='operone-game-end')"))break;
      await page.waitForTimeout(180);
    }
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const events=await page.evaluate<Event[]>('window.events');
    const end=events.find(e=>e.type==='forge-end');
    report.end=end;report.timeline=timeline;report.events=events;
    await page.screenshot({path:`${out}/outcome.png`});
    assert.ok(end,'Must reach an outcome through actual play');
    assert.equal(end.won,mode==='win','Outcome must match intentional play path');
    const replay=point(0.5,0.75);
    await page.touchscreen.tap(replay.x,replay.y);
    await page.waitForFunction("window.events.some(e=>e.type==='forge-restart')",undefined,{timeout:10000});
    await page.waitForTimeout(500);
    assert.ok((await player())?.visible,'Restart must restore visible player');
    await page.screenshot({path:`${out}/restart.png`});
    report.restart=true;report.pass=true;
    console.log(JSON.stringify({projectId:id,mode,end,restart:true}));
  } catch(error) {
    report.error=error instanceof Error?error.message:String(error);
    await page.screenshot({path:`${out}/failure.png`}).catch(()=>undefined);
    throw error;
  } finally {
    await fs.writeFile(`${out}/REPORT.json`,JSON.stringify(report,null,2));
    await browser.close();
  }
}
void main();
