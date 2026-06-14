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
      const w=ctx.width,h=ctx.height, win=ctx.winScore||500;
      if(ctx.assets&&ctx.assets.backgroundKey){
        scene.add.image(w/2,h/2,ctx.assets.backgroundKey).setDisplaySize(w,h).setDepth(-10);
      } else {
        scene.add.rectangle(w/2,h/2,w,h, Phaser.Display.Color.HexStringToColor(ctx.colors.background).color);
      }
      scene.physics.world.setBounds(0,0,w,h);
      scene.physics.world.gravity.y=900;
      let dummy;
      if(ctx.assets&&ctx.assets.playerKey){
        dummy=scene.physics.add.sprite(w/2,h*0.48,ctx.assets.playerKey);
        dummy.setDisplaySize(72,120);
      } else {
        dummy=scene.add.rectangle(w/2,h*0.48,72,120, Phaser.Display.Color.HexStringToColor(ctx.colors.player).color);
        scene.physics.add.existing(dummy);
      }
      dummy.body.setCollideWorldBounds(true).setBounce(0.35).setDrag(80);
      const floor=scene.add.rectangle(w/2,h-24,w,48,0x334155);
      scene.physics.add.existing(floor,true);
      scene.physics.add.collider(dummy,floor);
      if(ctx.assets&&ctx.assets.enemyKey){
        scene.add.image(w*0.72,h-62,ctx.assets.enemyKey).setDisplaySize(70,70).setDepth(2);
      } else {
        scene.add.rectangle(w*0.72,h-62,70,70, Phaser.Display.Color.HexStringToColor(ctx.colors.accent).color);
      }
      let score=0, combo=0, comboUntil=0;
      const st=scene.add.text(16,12,'Score 0',{fontSize:'18px',color:'#fff'});
      const cb=scene.add.text(16,38,'Combo x0',{fontSize:'15px',color:'#fbbf24'});
      scene.add.text(w/2,h-52,'Tap dummy · drag impulse',{fontSize:'14px',color:'#cbd5e1'}).setOrigin(0.5);
      scene.input.on('pointerdown',(p)=>{
        const dx=dummy.x-p.x, dy=dummy.y-p.y, dist=Math.hypot(dx,dy);
        if(dist>120) return;
        const f=Math.max(120,Math.min(420,280-dist));
        dummy.body.setVelocity(dx/(dist||1)*f, dy/(dist||1)*f-80);
        const now=scene.time.now;
        combo = now<comboUntil?combo+1:1; comboUntil=now+900;
        score+=20+combo*8; st.setText('Score '+score); cb.setText('Combo x'+combo);
        ctx.onScore(20+combo*8);
        if(score>=win) ctx.onEnd(true);
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
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  function buildPath() {
    const segs = 52, path = [];
    for (let i = 0; i <= segs; i += 1) {
      const t = i / segs;
      const wave = Math.sin(t * Math.PI * 4) * 22;
      const climb = Math.sin(t * Math.PI * 2.2) * 18;
      const loop = t > 0.38 && t < 0.48 ? Math.sin(((t - 0.38) / 0.1) * Math.PI) * 24 : 0;
      const drop = t > 0.62 && t < 0.72 ? -Math.sin(((t - 0.62) / 0.1) * Math.PI) * 30 : 0;
      path.push({ x: wave + Math.sin(t * Math.PI * 7) * 5, y: climb + loop + drop, z: t * 280 });
    }
    return path;
  }
  function pathLen(path) {
    let total = 0;
    for (let i = 1; i < path.length; i += 1) {
      const a = path[i - 1], b = path[i];
      total += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    }
    return total || 1;
  }
  function samplePath(path, t) {
    if (path.length < 2) return { pos: { x: 0, y: 0, z: 0 }, tangent: { x: 0, y: 0, z: 1 }, bank: 0 };
    const total = pathLen(path);
    const target = clamp(t, 0, 1) * total;
    let acc = 0;
    for (let i = 1; i < path.length; i += 1) {
      const a = path[i - 1], b = path[i];
      const seg = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      if (acc + seg >= target || i === path.length - 1) {
        const lt = seg > 0 ? clamp((target - acc) / seg, 0, 1) : 0;
        const pos = { x: a.x + (b.x - a.x) * lt, y: a.y + (b.y - a.y) * lt, z: a.z + (b.z - a.z) * lt };
        const tangent = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
        const len = Math.hypot(tangent.x, tangent.y, tangent.z) || 1;
        tangent.x /= len; tangent.y /= len; tangent.z /= len;
        return { pos, tangent, bank: Math.atan2(b.x - a.x, b.z - a.z) * 0.35 };
      }
      acc += seg;
    }
    const last = path[path.length - 1], prev = path[path.length - 2];
    return { pos: last, tangent: { x: last.x - prev.x, y: last.y - prev.y, z: last.z - prev.z }, bank: 0 };
  }
  function fmtTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ':' + s.toFixed(2).padStart(5, '0');
  }
  return {
    create(scene) {
      const w = ctx.width, h = ctx.height;
      const path = buildPath();
      const playerCol = Phaser.Display.Color.HexStringToColor(ctx.colors.player).color;
      let trackProgress = 0, speed = 28, baseSpeed = 42, maxSpeed = 118, minSpeed = 8;
      let boostPower = 0, brakePower = 0, elapsed = 0, finished = false, thirdPerson = true;
      const trackGfx = scene.add.graphics().setDepth(2);
      const decorGfx = scene.add.graphics().setDepth(1);
      const cartGfx = scene.add.graphics().setDepth(5);
      const clouds = [];
      for (let i = 0; i < 12; i += 1) {
        clouds.push({ x: ctx.rng() * w, y: 20 + ctx.rng() * h * 0.35, r: 18 + ctx.rng() * 24, sp: 0.08 + ctx.rng() * 0.14 });
      }
      scene.add.text(16, 12, ctx.labels.title, { fontSize: '18px', color: '#fff' });
      const timerT = scene.add.text(w / 2, 14, fmtTime(0), { fontSize: '22px', color: '#fff' }).setOrigin(0.5, 0);
      const speedT = scene.add.text(16, 44, '0 KM/H', { fontSize: '14px', color: '#fff' });
      const hintT = scene.add.text(w / 2, h - 28, 'Boost · E/→ · Brake · Q/← · View · V', { fontSize: '11px', color: '#fff' }).setOrigin(0.5);
      const kb = scene.input.keyboard;
      const keyBoost = kb && kb.addKey('E');
      const keyBrake = kb && kb.addKey('Q');
      const keyView = kb && kb.addKey('V');
      const cursors = kb && kb.createCursorKeys ? kb.createCursorKeys() : null;
      function drawWorld() {
        const horizon = h * 0.34;
        const cam = samplePath(path, trackProgress);
        decorGfx.clear();
        decorGfx.fillStyle(0x38bdf8, 1);
        decorGfx.fillRect(0, 0, w, h);
        for (const c of clouds) {
          c.x += c.sp;
          if (c.x > w + 60) c.x = -60;
          decorGfx.fillStyle(0xffffff, 0.55);
          decorGfx.fillCircle(c.x, c.y, c.r);
          decorGfx.fillCircle(c.x + c.r * 0.6, c.y + 4, c.r * 0.72);
        }
        trackGfx.clear();
        const segments = 28;
        for (let i = segments; i >= 0; i -= 1) {
          const t = trackProgress + i * 0.012;
          if (t > 1.02) continue;
          const s = samplePath(path, Math.min(1, t));
          const rel = i / segments;
          const depth = 1 - rel * 0.92;
          const scale = 0.15 + depth * 1.35;
          const screenY = horizon + (1 - depth) * (h - horizon - 90);
          const offsetX = (s.pos.x - cam.pos.x) * scale * 6;
          const cx = w / 2 + offsetX;
          const half = (18 + depth * 42) * (1 + Math.abs(s.bank) * 0.4);
          const lift = (s.pos.y - cam.pos.y) * scale * 3;
          trackGfx.fillStyle(0x92400e, 0.55 + depth * 0.35);
          trackGfx.fillRect(cx - half - 6, screenY + lift - 3, half * 2 + 12, 5);
          trackGfx.lineStyle(3 + depth * 2, 0xc0c0c0, 0.5 + depth * 0.45);
          trackGfx.lineBetween(cx - half, screenY + lift, cx + half, screenY + lift);
          if (i % 4 === 0 && depth > 0.35) {
            trackGfx.fillStyle(0xfde047, 0.35 + depth * 0.4);
            trackGfx.fillCircle(cx + Math.sin(i * 1.7) * half * 1.4, screenY + lift - 30 * depth, 4 + depth * 5);
          }
        }
        cartGfx.clear();
        const cartY = h - 118 + (thirdPerson ? 0 : -40);
        const cartX = w / 2;
        const cartW = thirdPerson ? 54 : 72;
        const cartH = thirdPerson ? 28 : 36;
        cartGfx.fillStyle(playerCol, 1);
        cartGfx.fillRoundedRect(cartX - cartW / 2, cartY - cartH, cartW, cartH, 6);
        cartGfx.fillStyle(0x1f2937, 1);
        cartGfx.fillCircle(cartX - cartW * 0.32, cartY + 4, 7);
        cartGfx.fillCircle(cartX + cartW * 0.32, cartY + 4, 7);
        if (thirdPerson) {
          cartGfx.fillStyle(0xfbbf24, 1);
          cartGfx.fillRect(cartX - 8, cartY - cartH - 14, 16, 14);
        }
      }
      scene.events.on('update', (_, dt) => {
        if (finished) return;
        const sec = dt / 1000;
        elapsed += sec;
        const boostOn = (keyBoost && keyBoost.isDown) || (cursors && cursors.right && cursors.right.isDown) || scene.input.activePointer.isDown;
        const brakeOn = (keyBrake && keyBrake.isDown) || (cursors && cursors.left && cursors.left.isDown);
        if (keyView && Phaser.Input && Phaser.Input.Keyboard && Phaser.Input.Keyboard.JustDown && Phaser.Input.Keyboard.JustDown(keyView)) {
          thirdPerson = !thirdPerson;
        }
        boostPower = lerp(boostPower, boostOn ? 1 : 0, sec * 4);
        brakePower = lerp(brakePower, brakeOn ? 1 : 0, sec * 5);
        const sample = samplePath(path, trackProgress);
        const hill = -sample.tangent.y;
        const target = baseSpeed + boostPower * 48 - brakePower * 36 + 18 * hill;
        speed = lerp(speed, clamp(target, minSpeed, maxSpeed), sec * 2.2);
        trackProgress += (speed * sec) / pathLen(path);
        drawWorld();
        timerT.setText(fmtTime(elapsed));
        speedT.setText(Math.round(speed * 3.2) + ' KM/H');
        if (trackProgress >= 1) {
          finished = true;
          ctx.onScore(Math.max(1, Math.round(10000 / Math.max(elapsed, 1))));
          ctx.onEnd(true);
        }
      });
      drawWorld();
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

const ARENA_AVOIDER = `
function createGame(ctx, Phaser) {
  return {
    create(scene) {
      const w=ctx.width,h=ctx.height, win=ctx.winScore||120;
      scene.add.rectangle(w/2,h/2,w,h, Phaser.Display.Color.HexStringToColor(ctx.colors.background).color);
      scene.physics.world.setBounds(0,0,w,h);
      let score=0;
      const st=scene.add.text(16,12,'Score 0',{fontSize:'16px',color:'#fff'});
      const player=scene.add.rectangle(w/2,h-48,34,34, Phaser.Display.Color.HexStringToColor(ctx.colors.player).color);
      scene.physics.add.existing(player); player.body.setCollideWorldBounds(true);
      const hazards=scene.physics.add.group();
      scene.input.on('pointermove', p=>{ player.x=Phaser.Math.Clamp(p.x,20,w-20); });
      scene.time.addEvent({delay:750,loop:true,callback:()=>{
        const e=scene.add.rectangle(Phaser.Math.Between(24,w-24),-18,22,22, Phaser.Display.Color.HexStringToColor(ctx.colors.accent).color);
        scene.physics.add.existing(e); e.body.setVelocityY(110+score*0.2); hazards.add(e);
      }});
      scene.physics.add.overlap(player,hazards,()=>ctx.onEnd(false));
      scene.events.on('update',(_,dt)=>{ score+=dt*0.025; st.setText('Score '+Math.floor(score)); ctx.onScore(1); if(score>=win) ctx.onEnd(true); });
    }
  };
}`;

const ARENA_COLLECTOR = `
function createGame(ctx, Phaser) {
  return {
    create(scene) {
      const w=ctx.width,h=ctx.height, win=ctx.winScore||100;
      scene.add.rectangle(w/2,h/2,w,h, Phaser.Display.Color.HexStringToColor(ctx.colors.background).color);
      scene.physics.world.setBounds(0,0,w,h);
      let score=0;
      const st=scene.add.text(16,12,'Collect 0/'+win,{fontSize:'16px',color:'#fff'});
      const player=scene.add.rectangle(w/2,h-48,32,32, Phaser.Display.Color.HexStringToColor(ctx.colors.player).color);
      scene.physics.add.existing(player); player.body.setCollideWorldBounds(true);
      const gems=scene.physics.add.group(); const foes=scene.physics.add.group();
      scene.input.on('pointermove', p=>{ player.x=Phaser.Math.Clamp(p.x,20,w-20); });
      scene.time.addEvent({delay:900,loop:true,callback:()=>{
        const g=scene.add.circle(Phaser.Math.Between(30,w-30),Phaser.Math.Between(40,h-80),10,0xfbbf24);
        scene.physics.add.existing(g); gems.add(g);
        const e=scene.add.rectangle(Phaser.Math.Between(30,w-30),-16,20,20, Phaser.Display.Color.HexStringToColor(ctx.colors.accent).color);
        scene.physics.add.existing(e); e.body.setVelocityY(90); foes.add(e);
      }});
      scene.physics.add.overlap(player,gems,(p,g)=>{ g.destroy(); score+=10; st.setText('Collect '+score+'/'+win); ctx.onScore(10); if(score>=win) ctx.onEnd(true); });
      scene.physics.add.overlap(player,foes,()=>ctx.onEnd(false));
    }
  };
}`;

const ARENA_SURVIVOR = `
function createGame(ctx, Phaser) {
  return {
    create(scene) {
      const w=ctx.width,h=ctx.height;
      scene.add.rectangle(w/2,h/2,w,h, Phaser.Display.Color.HexStringToColor(ctx.colors.background).color);
      scene.physics.world.setBounds(0,0,w,h);
      let lives=3, score=0, elapsed=0;
      const st=scene.add.text(16,12,'Lives 3',{fontSize:'16px',color:'#fff'});
      const player=scene.add.rectangle(w/2,h-48,32,32, Phaser.Display.Color.HexStringToColor(ctx.colors.player).color);
      scene.physics.add.existing(player); player.body.setCollideWorldBounds(true);
      const foes=scene.physics.add.group();
      scene.input.on('pointermove', p=>{ player.x=Phaser.Math.Clamp(p.x,20,w-20); });
      scene.time.addEvent({delay:700,loop:true,callback:()=>{
        const e=scene.add.rectangle(Phaser.Math.Between(24,w-24),-16,24,24, Phaser.Display.Color.HexStringToColor(ctx.colors.accent).color);
        scene.physics.add.existing(e); e.body.setVelocityY(95+elapsed*8); foes.add(e);
      }});
      scene.physics.add.overlap(player,foes,()=>{ lives--; st.setText('Lives '+lives); if(lives<=0) ctx.onEnd(false); });
      scene.events.on('update',(_,dt)=>{ elapsed+=dt/1000; score+=dt*0.02; ctx.onScore(1); if(elapsed>=45) ctx.onEnd(true); });
    }
  };
}`;

const TD_LANE = `
function createGame(ctx, Phaser) {
  return {
    create(scene) {
      const w=ctx.width,h=ctx.height;
      scene.add.rectangle(w/2,h/2,w,h, Phaser.Display.Color.HexStringToColor(ctx.colors.background).color);
      let coins=80, built=0, kills=0, baseHp=18, wave=1;
      const st=scene.add.text(16,12,'Wave 1 · Base 18 · Coins 80',{fontSize:'14px',color:'#fff'});
      const slots=[];
      for(let i=0;i<5;i++){
        const x=70+i*105, y=h-96;
        const slot=scene.add.rectangle(x,y,52,52,0x334155).setStrokeStyle(2,0x64748b).setInteractive({useHandCursor:true});
        slot.on('pointerdown',()=>{ if(coins>=30){ coins-=30; built++; slot.setFillStyle(Phaser.Display.Color.HexStringToColor(ctx.colors.player).color); st.setText('Wave '+wave+' · Base '+baseHp+' · Towers '+built); }});
        slots.push(slot);
      }
      const foes=scene.physics.add.group();
      scene.time.addEvent({delay:850,loop:true,callback:()=>{
        wave+=0.15;
        const e=scene.add.circle(Phaser.Math.Between(36,w-36),-14,12, Phaser.Display.Color.HexStringToColor(ctx.colors.accent).color);
        scene.physics.add.existing(e); e.body.setVelocityY(35+wave*12); foes.add(e);
      }});
      scene.events.on('update',()=>{
        if(built>=2 && wave>=4 && baseHp>0){ ctx.onScore(kills+baseHp*10); ctx.onEnd(true); }
      });
    }
  };
}`;

const CHESS_LITE = `
function createGame(ctx, Phaser) {
  return {
    create(scene) {
      const w=ctx.width,h=ctx.height;
      scene.add.rectangle(w/2,h/2,w,h, Phaser.Display.Color.HexStringToColor(ctx.colors.background).color);
      const cell=Math.min(48,(w-40)/8), ox=(w-cell*8)/2, oy=72;
      const pieces=[{color:'w',row:6,col:3},{color:'w',row:6,col:4},{color:'b',row:1,col:2},{color:'b',row:1,col:5}];
      let sel=-1, moves=0;
      const st=scene.add.text(16,12,'Tap piece then square',{fontSize:'15px',color:'#fff'});
      const gfx=scene.add.graphics();
      function draw(){
        gfx.clear();
        for(let r=0;r<8;r++) for(let c=0;c<8;c++){
          gfx.fillStyle((r+c)%2?0x78716c:0xd6d3d1,1); gfx.fillRect(ox+c*cell,oy+r*cell,cell,cell);
        }
        pieces.forEach((p)=>{
          const col=p.color==='w'?0xffffff:0x111827;
          gfx.fillStyle(col,1); gfx.fillCircle(ox+p.col*cell+cell/2,oy+p.row*cell+cell/2,cell*0.32);
        });
      }
      scene.input.on('pointerdown',(pt)=>{
        const c=Math.floor((pt.x-ox)/cell), r=Math.floor((pt.y-oy)/cell);
        if(c<0||c>7||r<0||r>7) return;
        const idx=pieces.findIndex(p=>p.col===c&&p.row===r);
        if(sel<0 && idx>=0 && pieces[idx].color==='w') sel=idx;
        else if(sel>=0){ pieces[sel].col=c; pieces[sel].row=r; sel=-1; moves++; ctx.onScore(5); draw(); if(moves>=4){ ctx.onEnd(true); } }
        else sel=-1;
        st.setText('Moves '+moves);
      });
      draw();
    }
  };
}`;

const CUSTOMIZE_PAINT = `
function createGame(ctx, Phaser) {
  return {
    create(scene) {
      const w=ctx.width,h=ctx.height;
      let body=ctx.colors.player, wheel=ctx.colors.accent, bg=ctx.colors.background, edits=0;
      const bgRect=scene.add.rectangle(w/2,h/2,w,h, Phaser.Display.Color.HexStringToColor(bg).color);
      const car=scene.add.graphics();
      const palette=['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#a855f7','#ec4899','#ffffff','#1e293b'];
      let part='body';
      function drawCar(){
        car.clear();
        const cx=w/2, cy=h*0.42;
        car.fillStyle(Phaser.Display.Color.HexStringToColor(body).color,1);
        car.fillRoundedRect(cx-90,cy-28,180,56,10);
        car.fillStyle(Phaser.Display.Color.HexStringToColor(wheel).color,1);
        car.fillCircle(cx-55,cy+34,16); car.fillCircle(cx+55,cy+34,16);
      }
      palette.forEach((col,i)=>{
        const sw=26, x=16+(i%10)*(sw+6), y=h-52+Math.floor(i/10)*(sw+6);
        scene.add.rectangle(x,y,sw,sw, Phaser.Display.Color.HexStringToColor(col).color).setStrokeStyle(2,0xffffff).setInteractive({useHandCursor:true})
          .on('pointerdown',()=>{ if(part==='body') body=col; else if(part==='wheel') wheel=col; else { bg=col; bgRect.setFillStyle(Phaser.Display.Color.HexStringToColor(bg).color); } edits++; drawCar(); ctx.onScore(3); if(edits>=6) ctx.onEnd(true); });
      });
      ['Body','Wheels','BG'].forEach((label,i)=>{
        scene.add.text(16+i*72,44,label,{fontSize:'13px',color:'#e2e8f0',backgroundColor:'#334155',padding:{x:8,y:4}}).setInteractive({useHandCursor:true})
          .on('pointerdown',()=>{ part=['body','wheel','bg'][i]; });
      });
      drawCar();
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
  towerDefense: TD_LANE,
  shooter: SHOOTER_WAVE,
  sniper: SHOOTER_WAVE,
  platformer: PLATFORMER_JUMP,
  stealth: PLATFORMER_JUMP,
  chess: CHESS_LITE,
  customization: CUSTOMIZE_PAINT,
  avoider: ARENA_AVOIDER,
  collector: ARENA_COLLECTOR,
  survivor: ARENA_SURVIVOR,
};

export function buildTemplateFallbackModule(spec: GameSpec): AgenticGameModule {
  const source = BY_TEMPLATE[spec.templateId] ?? GENERIC_CLICK;
  return { version: 1, entry: "createGame", source: source.trim() };
}
