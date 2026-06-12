import type { GameSpec } from "@/lib/game-spec";
import type { AgenticGameModule } from "@/lib/agentic/game-module";

/** 各语义模板离线 Agentic 模块（LLM 失败时仍保留可辨认玩法） */
const PUZZLE_MATCH3 = `
function createGame(ctx, Phaser) {
  const COLORS = ['#f472b6','#a78bfa','#38bdf8','#4ade80','#fbbf24'];
  return {
    create(scene) {
      const w = ctx.width, h = ctx.height;
      scene.add.rectangle(w/2,h/2,w,h, Phaser.Display.Color.HexStringToColor(ctx.colors.background).color);
      scene.add.text(w/2,24, ctx.labels.title, {fontSize:'20px',color:'#fff'}).setOrigin(0.5);
      let score=0, moves=0;
      const st = scene.add.text(16,16,'Score 0', {fontSize:'16px',color:'#fff'});
      const grid=[]; const cell=44, ox=80, oy=80, cols=7, rows=7;
      for(let r=0;r<rows;r++){ grid[r]=[]; for(let c=0;c<cols;c++) grid[r][c]=Math.floor(ctx.rng()*COLORS.length); }
      function draw(){
        scene.children.list.filter(x=>x.getData&&x.getData('cell')).forEach(x=>x.destroy());
        for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
          const v=grid[r][c]; if(v<0) continue;
          const rect=scene.add.rectangle(ox+c*cell+cell/2, oy+r*cell+cell/2, cell-4, cell-4, Phaser.Display.Color.HexStringToColor(COLORS[v]).color);
          rect.setData('cell', true); rect.setInteractive({useHandCursor:true});
          rect.on('pointerdown', ()=>{
            const group=new Set(); flood(r,c,v,group);
            if(group.size<2) return;
            group.forEach(k=>{const [rr,cc]=k.split(',').map(Number); grid[rr][cc]=-1;});
            score+=group.size*group.size*3; moves++; st.setText('Score '+score+' moves '+moves);
            ctx.onScore(group.size*group.size*3);
            draw(); if(score>=120) ctx.onEnd(true);
          });
        }
      }
      function flood(r,c,color,seen){
        const k=r+','+c; if(seen.has(k)||r<0||c<0||r>=rows||c>=cols||grid[r][c]!==color) return;
        seen.add(k); flood(r-1,c,color,seen); flood(r+1,c,color,seen); flood(r,c-1,color,seen); flood(r,c+1,color,seen);
      }
      draw();
    }
  };
}`;

const PHYSICS_DUMMY = `
function createGame(ctx, Phaser) {
  return {
    create(scene) {
      const w=ctx.width,h=ctx.height;
      scene.add.rectangle(w/2,h/2,w,h, Phaser.Display.Color.HexStringToColor(ctx.colors.background).color);
      const dummy=scene.add.rectangle(w/2,h*0.45,72,120, Phaser.Display.Color.HexStringToColor(ctx.colors.player).color);
      scene.physics.add.existing(dummy); dummy.body.setCollideWorldBounds(true).setBounce(0.35).setDrag(80);
      let score=0, combo=0, comboUntil=0;
      const st=scene.add.text(16,16,'Score 0', {fontSize:'16px',color:'#fff'});
      scene.input.on('pointerdown', (p)=>{
        const dx=dummy.x-p.x, dy=dummy.y-p.y, dist=Math.hypot(dx,dy);
        if(dist>120) return;
        const f=Math.max(120,280-dist);
        dummy.body.setVelocity(dx/(dist||1)*f, dy/(dist||1)*f-80);
        const now=scene.time.now; combo = now<comboUntil?combo+1:1; comboUntil=now+900;
        score+=20+combo*8; st.setText('Score '+score+' x'+combo); ctx.onScore(20+combo*8);
        if(score>=500) ctx.onEnd(true);
      });
    }
  };
}`;

const FARMING_GRID = `
function createGame(ctx, Phaser) {
  return {
    create(scene) {
      const w=ctx.width,h=ctx.height;
      scene.add.rectangle(w/2,h/2,w,h, Phaser.Display.Color.HexStringToColor(ctx.colors.background).color);
      let coins=40, harvests=0; const st=scene.add.text(16,16,'Harvest 0/8 · Coins 40', {fontSize:'15px',color:'#fff'});
      const states=[]; for(let i=0;i<16;i++) states[i]=0;
      for(let i=0;i<16;i++){
        const c=i%4,r=Math.floor(i/4), x=120+c*72, y=100+r*72;
        const tile=scene.add.rectangle(x,y,66,66,0x365314).setStrokeStyle(2,0x84cc16).setInteractive({useHandCursor:true});
        tile.on('pointerdown', ()=>{
          if(states[i]===0 && coins>=5){ coins-=5; states[i]=1; tile.setFillStyle(0x15803d); }
          else if(states[i]===1){ states[i]=2; tile.setFillStyle(0x22c55e); }
          else if(states[i]===2){ states[i]=0; tile.setFillStyle(0x365314); coins+=12; harvests++; ctx.onScore(10);
            st.setText('Harvest '+harvests+'/8 · Coins '+coins);
            if(harvests>=8) ctx.onEnd(true);
          }
        });
      }
    }
  };
}`;

const COASTER_RACE = `
function createGame(ctx, Phaser) {
  return {
    create(scene) {
      const w=ctx.width,h=ctx.height;
      scene.add.rectangle(w/2,h/2,w,h,0x38bdf8);
      let prog=0, speed=40, elapsed=0, finished=false;
      const track=scene.add.graphics(); const cart=scene.add.graphics();
      const st=scene.add.text(16,16,'Speed · Boost Space', {fontSize:'15px',color:'#fff'});
      const keySpace=scene.input.keyboard.addKey('SPACE');
      scene.events.on('update', (_, dt)=>{
        if(finished) return; elapsed+=dt/1000;
        if(keySpace.isDown) speed=Math.min(140,speed+dt*0.08); else speed=Math.max(20,speed-dt*0.03);
        prog+=speed*dt*0.001; if(prog>=1){ finished=true; ctx.onEnd(true); }
        track.clear(); track.lineStyle(6,0xfde047,1);
        for(let i=0;i<32;i++){ const t=i/31, x=80+t*(w-160), y=200+Math.sin(t*Math.PI*4)*60; if(i===0) track.moveTo(x,y); else track.lineTo(x,y); }
        track.strokePath();
        const t=Math.min(1,prog), cx=80+t*(w-160), cy=200+Math.sin(t*Math.PI*4)*60;
        cart.clear(); cart.fillStyle(0xef4444,1); cart.fillRoundedRect(cx-18,cy-12,36,24,4);
        st.setText('Time '+elapsed.toFixed(1)+'s · Speed '+Math.round(speed));
      });
    }
  };
}`;

const STRATEGY_NODES = `
function createGame(ctx, Phaser) {
  return {
    create(scene) {
      const w=ctx.width,h=ctx.height;
      scene.add.rectangle(w/2,h/2,w,h, Phaser.Display.Color.HexStringToColor(ctx.colors.background).color);
      const nodes=[{x:160,y:200,o:'player',t:20},{x:400,y:160,o:'neutral',t:10},{x:640,y:220,o:'ai',t:18},{x:400,y:320,o:'neutral',t:8}];
      let playerTurn=true, moves=0;
      const st=scene.add.text(16,16,'Click your node then target to send troops', {fontSize:'14px',color:'#fff'});
      let sel=-1;
      function draw(){
        scene.children.list.filter(x=>x.getData&&x.getData('node')).forEach(x=>x.destroy());
        nodes.forEach((n,i)=>{
          const col=n.o==='player'?ctx.colors.player:n.o==='ai'?ctx.colors.accent:'#64748b';
          const c=scene.add.circle(n.x,n.y,28, Phaser.Display.Color.HexStringToColor(col).color).setStrokeStyle(3, sel===i?0xffffff:0x000000);
          c.setData('node',true); c.setInteractive({useHandCursor:true});
          scene.add.text(n.x,n.y,String(Math.round(n.t)), {fontSize:'14px',color:'#fff'}).setOrigin(0.5).setData('node',true);
          c.on('pointerdown', ()=>{
            if(!playerTurn) return;
            if(sel<0 && n.o==='player') sel=i;
            else if(sel>=0 && i!==sel){
              const send=Math.floor(nodes[sel].t/2); nodes[sel].t-=send;
              if(nodes[i].t<=send){ nodes[i].o='player'; nodes[i].t=send-nodes[i].t; } else nodes[i].t-=send;
              sel=-1; moves++; playerTurn=false;
              scene.time.delayedCall(400, ()=>{ nodes.filter(x=>x.o==='ai').forEach(a=>{ if(nodes[2]) nodes[2].t+=2; }); playerTurn=true; draw(); });
              if(nodes.every(x=>x.o==='player')) ctx.onEnd(true);
              draw();
            }
          });
        });
      }
      draw();
    }
  };
}`;

const SHOOTER_WAVE = `
function createGame(ctx, Phaser) {
  return {
    create(scene) {
      const w=ctx.width,h=ctx.height;
      if(ctx.assets&&ctx.assets.backgroundKey) scene.add.image(w/2,h/2,ctx.assets.backgroundKey).setDisplaySize(w,h);
      else scene.add.rectangle(w/2,h/2,w,h, Phaser.Display.Color.HexStringToColor(ctx.colors.background).color);
      let score=0, wave=1;
      const st=scene.add.text(16,16,'Score 0', {fontSize:'16px',color:'#fff'});
      const player=ctx.assets&&ctx.assets.playerKey
        ? scene.add.sprite(w/2,h-60,ctx.assets.playerKey).setScale(0.5)
        : scene.add.triangle(w/2,h-60,0,20,20,20,10,0, Phaser.Display.Color.HexStringToColor(ctx.colors.player).color);
      scene.physics.add.existing(player); player.body.setCollideWorldBounds(true);
      const bullets=scene.physics.add.group(); const foes=scene.physics.add.group();
      scene.input.on('pointermove', p=>{ if(player.body) player.x=Phaser.Math.Clamp(p.x,24,w-24); });
      scene.input.on('pointerdown', ()=>{
        const b=scene.add.rectangle(player.x,player.y-20,6,14,0xfbbf24);
        scene.physics.add.existing(b); b.body.setVelocityY(-420); bullets.add(b);
      });
      scene.physics.add.overlap(bullets,foes,(b,f)=>{ b.destroy(); f.destroy(); score+=25; st.setText('Score '+score); ctx.onScore(25); if(score>=300) ctx.onEnd(true); });
      scene.time.addEvent({ delay:900, loop:true, callback:()=>{
        wave+=0.1; const e=scene.add.rectangle(Phaser.Math.Between(40,w-40),-20,28,28, Phaser.Display.Color.HexStringToColor(ctx.colors.accent).color);
        scene.physics.add.existing(e); e.body.setVelocityY(80+wave*20); foes.add(e);
        scene.physics.add.overlap(player,foes,()=>ctx.onEnd(false));
      }});
    }
  };
}`;

const PLATFORMER_JUMP = `
function createGame(ctx, Phaser) {
  return {
    create(scene) {
      const w=ctx.width,h=ctx.height;
      scene.add.rectangle(w/2,h/2,w,h, Phaser.Display.Color.HexStringToColor(ctx.colors.background).color);
      const platforms=scene.physics.add.staticGroup();
      [[80,h-40,w-160,24],[120,h-120,160,20],[360,h-200,140,20],[520,h-280,120,20]].forEach(([x,y,ww,hh])=>{
        const p=scene.add.rectangle(x+ww/2,y,ww,hh,0x475569); scene.physics.add.existing(p,true); platforms.add(p);
      });
      const player=scene.add.rectangle(60,h-80,28,36, Phaser.Display.Color.HexStringToColor(ctx.colors.player).color);
      scene.physics.add.existing(player); player.body.setCollideWorldBounds(true).setBounce(0.05);
      scene.physics.add.collider(player,platforms);
      const key=scene.input.keyboard.addKeys('SPACE,UP,W');
      let score=0; const st=scene.add.text(16,16,'Reach the flag', {fontSize:'15px',color:'#fff'});
      const flag=scene.add.star(w-80,h-300,5,14,28,0xfbbf24);
      scene.physics.add.existing(flag,true);
      scene.physics.add.overlap(player,flag,()=>{ ctx.onScore(100); ctx.onEnd(true); });
      scene.events.on('update', ()=>{
        if(key.SPACE.isDown||key.UP.isDown||key.W.isDown){ if(player.body.blocked.down) player.body.setVelocityY(-380); }
        if(player.x>w-100 && player.y<h-320) { score=100; st.setText('Score '+score); }
      });
    }
  };
}`;

const GENERIC_CLICK = `
function createGame(ctx, Phaser) {
  return {
    create(scene) {
      scene.add.rectangle(ctx.width/2,ctx.height/2,ctx.width,ctx.height,
        Phaser.Display.Color.HexStringToColor(ctx.colors.background).color);
      scene.add.text(ctx.width/2,40,ctx.labels.title,{fontSize:'22px',color:'#fff'}).setOrigin(0.5);
      let score=0; const t=scene.add.text(20,20,'Score 0',{fontSize:'18px',color:'#fff'});
      scene.input.on('pointerdown',()=>{ score+=10; t.setText('Score '+score); ctx.onScore(10); if(score>=100) ctx.onEnd(true); });
    }
  };
}`;

const BY_TEMPLATE: Partial<Record<GameSpec["templateId"], string>> = {
  puzzle: PUZZLE_MATCH3,
  physics: PHYSICS_DUMMY,
  farming: FARMING_GRID,
  coaster: COASTER_RACE,
  racing: COASTER_RACE,
  strategy: STRATEGY_NODES,
  towerDefense: STRATEGY_NODES,
  shooter: SHOOTER_WAVE,
  sniper: SHOOTER_WAVE,
  platformer: PLATFORMER_JUMP,
  stealth: PLATFORMER_JUMP,
  chess: GENERIC_CLICK,
  customization: GENERIC_CLICK,
  sniper: GENERIC_CLICK,
};

export function buildTemplateFallbackModule(spec: GameSpec): AgenticGameModule {
  const source = BY_TEMPLATE[spec.templateId] ?? GENERIC_CLICK;
  return { version: 1, entry: "createGame", source: source.trim() };
}
