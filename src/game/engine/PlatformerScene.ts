import Phaser from "phaser";
import { playBleep } from "@/game/audio/webBleeps";
import { HudBanner } from "@/game/engine/HudBanner";
import type { GameSpec } from "@/lib/game-spec";

type EndPayload = { score: number; won: boolean };
type DirectorEvent = NonNullable<NonNullable<GameSpec["director"]>["events"]>[number];

function hashTitle(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** 确定性伪随机 0..1 */
function rnd(seed: number, i: number): number {
  const x = Math.sin(seed * 0.001 + i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export class PlatformerScene extends Phaser.Scene {
  private readonly spec: GameSpec;

  private readonly onEnd: (r: EndPayload) => void;

  private player!: Phaser.Types.Physics.Arcade.ImageWithDynamicBody;

  private platforms!: Phaser.Physics.Arcade.StaticGroup;

  private gems!: Phaser.Physics.Arcade.Group;

  private powerups!: Phaser.Physics.Arcade.Group;

  private spikes!: Phaser.Physics.Arcade.StaticGroup;

  private eliteHazards!: Phaser.Physics.Arcade.Group;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private keyW!: Phaser.Input.Keyboard.Key;

  private keyA!: Phaser.Input.Keyboard.Key;

  private keyD!: Phaser.Input.Keyboard.Key;

  private keySpace!: Phaser.Input.Keyboard.Key;

  private keyShift!: Phaser.Input.Keyboard.Key;

  private score = 0;

  private lives = 3;

  private scoreText!: Phaser.GameObjects.Text;

  private livesText!: Phaser.GameObjects.Text;

  private progressText!: Phaser.GameObjects.Text;

  private hintText!: Phaser.GameObjects.Text;

  private banner!: HudBanner;

  private finished = false;

  private invulnUntil = 0;

  private winScore = 36;

  private jumpVel = 420;

  private readonly worldW = 4400;

  private intensity = 0.6;

  private actIndex = 0;

  private actText!: Phaser.GameObjects.Text;

  private skillText!: Phaser.GameObjects.Text;

  private skillCdText!: Phaser.GameObjects.Text;

  private shieldRing!: Phaser.GameObjects.Graphics;

  private powerupTimer!: Phaser.Time.TimerEvent;

  private scoreMult = 1;

  private shieldCharges = 0;

  private magnetUntil = 0;

  private skillReadyAt = 0;

  private slowUntil = 0;

  private lastWorldTimeScale = 1;

  private dashUntil = 0;

  private eventIndex = 0;

  private eventType: DirectorEvent["type"] | null = null;

  private eventUntil = 0;

  private eventStrength = 0;

  private coinRainUntil = 0;

  private miniBossUntil = 0;

  private goalShiftUntil = 0;

  private goalShiftNeed = 0;

  private goalShiftHave = 0;

  private goalShiftSucceeded = false;

  private nextCoinSpawnAt = 0;

  private nextMiniSpawnAt = 0;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void) {
    super("PlatformerScene");
    this.spec = spec;
    this.onEnd = onEnd;
  }

  create() {
    const viewW = this.scale.width;
    const viewH = this.scale.height;
    this.winScore = this.spec.gameplay.winScore ?? 36;
    this.lives = this.spec.gameplay.lives ?? 4;
    this.jumpVel = this.spec.gameplay.jumpStrength ?? 420;
    const grav = this.spec.gameplay.gravity ?? 980;
    this.physics.world.gravity.y = grav;
    this.intensity = this.spec.director?.intensity ?? 0.6;

    this.addStarfield();

    this.add
      .text(viewW / 2, 22, this.spec.title, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "21px",
        color: "#fafafa",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100);

    if (this.spec.labels.subtitle) {
      this.add
        .text(viewW / 2, 48, this.spec.labels.subtitle, {
          fontFamily: "system-ui, sans-serif",
          fontSize: "12px",
          color: "#a1a1aa",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(100);
    }

    this.scoreText = this.add
      .text(18, 14, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "17px",
        color: "#f4f4f5",
      })
      .setScrollFactor(0)
      .setDepth(101);

    this.progressText = this.add
      .text(viewW - 18, 14, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        color: "#67e8f9",
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(101);

    this.actText = this.add
      .text(viewW / 2, 14, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "11px",
        color: "#94a3b8",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(101);

    this.livesText = this.add
      .text(18, 44, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        color: "#fca5a5",
      })
      .setScrollFactor(0)
      .setDepth(101);

    const collLabel = this.spec.labels.collectible ?? "能量核";
    this.hintText = this.add
      .text(viewW / 2, viewH - 20, `← → / A D 移动 · Space / W / ↑ 跳跃 · Shift 技能 · 收集「${collLabel}」`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "11px",
        color: "#71717a",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(101);

    const rectTex = (key: string, w: number, h: number, color: string) => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(parseInt(color.replace("#", ""), 16));
      g.fillRect(0, 0, w, h);
      g.generateTexture(key, w, h);
      g.destroy();
    };

    const circleTex = (key: string, size: number, color: string) => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ x: 0, y: 0 });
      const c = parseInt(color.replace("#", ""), 16);
      g.fillStyle(c);
      g.fillCircle(size / 2, size / 2, size / 2 - 2);
      g.generateTexture(key, size, size);
      g.destroy();
    };

    rectTex("texPlat", 120, 22, "#334155");
    rectTex("texPlatHi", 120, 22, "#475569");
    rectTex("texGround", 64, 40, "#1e293b");
    rectTex("texPlayer", 34, 40, this.spec.theme.playerColor);
    rectTex("texSpike", 36, 18, this.spec.theme.hazardColor);
    circleTex(
      "texGem",
      26,
      this.spec.theme.collectibleColor ?? this.spec.theme.playerColor,
    );
    circleTex(
      "texPower",
      26,
      this.spec.theme.collectibleColor ?? this.spec.theme.playerColor,
    );

    this.platforms = this.physics.add.staticGroup();
    this.spikes = this.physics.add.staticGroup();
    this.gems = this.physics.add.group();
    this.powerups = this.physics.add.group();
    this.eliteHazards = this.physics.add.group();

    this.buildLevel(viewH);

    this.player = this.physics.add.image(140, viewH - 200, "texPlayer");
    this.player.setCollideWorldBounds(true);
    this.player.body.setSize(28, 36);
    this.player.setDepth(10);

    this.physics.add.collider(this.player, this.platforms);

    this.physics.add.overlap(this.player, this.gems, (_p, g) => {
      if (this.finished) return;
      const gem = g as Phaser.Physics.Arcade.Image;
      const gx = gem.x;
      const gy = gem.y;
      gem.destroy();
      this.fxCollect(gx, gy);
      this.score += 1 * this.scoreMult;
      if (this.time.now < this.goalShiftUntil) {
        this.goalShiftHave += 1;
        if (!this.goalShiftSucceeded && this.goalShiftHave >= this.goalShiftNeed) {
          this.goalShiftSucceeded = true;
          const bonus = Math.max(4, Math.floor(6 + this.eventStrength * 8));
          this.score += bonus;
          this.shieldCharges = Math.max(this.shieldCharges, 1);
          this.dashUntil = Math.max(this.dashUntil, this.time.now + 900);
          this.banner.show({ title: "目标达成！", message: `奖励 +${bonus} 分 · 护盾+冲刺`, ms: 1800 });
        }
      }
      this.refreshHud();
      if (this.score >= this.winScore) {
        this.finish({ score: this.score, won: true });
      }
    });

    this.physics.add.overlap(this.player, this.powerups, (_p, pu) => {
      if (this.finished) return;
      const s = pu as Phaser.Physics.Arcade.Image;
      const kind = String(s.getData("kind") ?? "");
      const x = s.x;
      const y = s.y;
      s.destroy();
      this.applyPowerup(kind);
      this.fxCollect(x, y);
      this.refreshHud();
    });

    this.physics.add.overlap(this.player, this.spikes, () => this.onHitHazard());
    this.physics.add.overlap(this.player, this.eliteHazards, () => this.onHitHazard());

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyA = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyW = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyShift = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

    this.banner = new HudBanner(this);

    this.shieldRing = this.add.graphics();
    this.shieldRing.setDepth(120);
    this.shieldRing.setScrollFactor(0);

    const skillName = this.spec.systems?.skill?.name ?? "技能";
    this.skillText = this.add
      .text(18, viewH - 56, `Shift · ${skillName}`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "12px",
        color: "#e4e4e7",
      })
      .setScrollFactor(0)
      .setDepth(130);
    this.skillCdText = this.add
      .text(18, viewH - 38, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "11px",
        color: "#94a3b8",
      })
      .setScrollFactor(0)
      .setDepth(130);

    this.powerupTimer = this.time.addEvent({
      delay: Math.max(1800, Math.floor(5200 - this.intensity * 2200)),
      loop: true,
      callback: () => this.spawnPowerup(),
    });

    this.cameras.main.setBounds(0, 0, this.worldW, viewH);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.08);
    this.cameras.main.setDeadzone(140, 80);

    this.refreshHud();
  }

  private buildLevel(viewH: number) {
    const seed = hashTitle(this.spec.title);
    const groundY = viewH - 36;
    const pad = this.spec.gameplay.arenaPadding ?? 36;

    let gx = 0;
    while (gx < this.worldW) {
      const chunk = this.platforms.create(gx + 320, groundY, "texGround");
      chunk.setDisplaySize(640, 40);
      chunk.refreshBody();
      gx += 620;
    }

    let x = pad + 40;
    let y = groundY - 120;
    let layer = 0;
    const totalLayers = 42;

    while (layer < totalLayers && x < this.worldW - pad - 80) {
      const rw = rnd(seed, layer * 3);
      const platW = Math.floor(72 + rw * 110);
      const plat = this.platforms.create(x + platW / 2, y, rnd(seed, layer) > 0.55 ? "texPlatHi" : "texPlat");
      plat.setDisplaySize(platW, 22);
      plat.refreshBody();

      const gemRoll = rnd(seed, layer * 7 + 1);
      if (gemRoll > 0.18) {
        const gem = this.gems.create(x + platW / 2, y - 36, "texGem");
        gem.setDepth(8);
        const gb = gem.body as Phaser.Physics.Arcade.Body | null;
        if (gb) gb.setAllowGravity(false);
      }

      if (rnd(seed, layer * 11 + 2) > 0.72 && platW > 95) {
        const spike = this.spikes.create(x + platW * 0.72, y - 11 + 9, "texSpike");
        spike.setDisplaySize(32, 16);
        spike.refreshBody();
      }

      const stepX = 96 + rnd(seed, layer * 5 + 4) * 88;
      const stepY = -48 + rnd(seed, layer * 6 + 5) * 112;
      x += stepX;
      y += stepY;
      if (y < 160) y = 200 + rnd(seed, layer + 99) * 80;
      if (y > groundY - 70) y = groundY - 140 - rnd(seed, layer + 40) * 60;
      layer += 1;
    }

    const endPlat = this.platforms.create(this.worldW - 120, groundY - 160, "texPlatHi");
    endPlat.setDisplaySize(200, 26);
    endPlat.refreshBody();
    const flagGem = this.gems.create(this.worldW - 120, groundY - 210, "texGem");
    flagGem.setDepth(12);
    const fb = flagGem.body as Phaser.Physics.Arcade.Body | null;
    if (fb) fb.setAllowGravity(false);
  }

  private addStarfield() {
    const raw = this.spec.theme.particleTint?.replace("#", "") ?? "38bdf8";
    const parsed = parseInt(raw, 16);
    const tint = Number.isFinite(parsed) ? parsed : 0x38bdf8;
    for (let i = 0; i < 110; i += 1) {
      const x = Phaser.Math.Between(4, this.worldW - 4);
      const y = Phaser.Math.Between(4, this.scale.height - 4);
      const s = Phaser.Math.FloatBetween(1, 2.6);
      const a = Phaser.Math.FloatBetween(0.05, 0.32);
      const dot = this.add.rectangle(x, y, s, s, tint, a);
      dot.setDepth(-12);
    }
  }

  private refreshHud() {
    this.scoreText.setText(`得分 ${this.score}`);
    if (this.time.now < this.goalShiftUntil) {
      this.progressText.setText(`目标 ${this.goalShiftHave}/${this.goalShiftNeed}`);
    } else {
      this.progressText.setText(`收集 ${Math.min(this.score, this.winScore)}/${this.winScore}`);
    }
    if (this.livesText) this.livesText.setText(`生命 ${this.lives}`);

    const acts = this.spec.director?.acts ?? null;
    const label = acts?.[this.actIndex]?.label;
    this.actText.setText(label ? `章节 · ${label}` : "");

    const cdLeft = Math.max(0, this.skillReadyAt - this.time.now);
    this.skillCdText.setText(cdLeft <= 0 ? "就绪" : `冷却 ${(cdLeft / 1000).toFixed(1)}s`);
    this.drawShieldRing();
  }

  private onHitHazard() {
    if (this.finished) return;
    if (this.time.now < this.invulnUntil) return;
    if (this.shieldCharges > 0) {
      this.shieldCharges -= 1;
      this.fxShield();
      this.refreshHud();
      return;
    }
    this.fxDamage();
    this.lives -= 1;
    if (this.livesText) this.livesText.setText(`生命 ${this.lives}`);
    this.invulnUntil = this.time.now + 900;
    this.player.setVelocityY(-this.jumpVel * 0.55);
    this.player.setAlpha(0.35);
    this.time.delayedCall(220, () => this.player.setAlpha(1));
    if (this.lives <= 0) {
      this.finish({ score: this.score, won: false });
    }
  }

  private fxCollect(x: number, y: number) {
    const tintStr = this.spec.theme.collectibleColor ?? this.spec.theme.playerColor;
    const tint = parseInt(tintStr.replace("#", ""), 16);
    for (let i = 0; i < 12; i += 1) {
      const bits = this.add.rectangle(x, y, 3, 3, tint, 0.95);
      bits.setDepth(30);
      this.tweens.add({
        targets: bits,
        x: x + Phaser.Math.Between(-64, 64),
        y: y + Phaser.Math.Between(-64, 64),
        alpha: 0,
        scale: 0.2,
        duration: Phaser.Math.Between(260, 400),
        ease: "Cubic.Out",
        onComplete: () => bits.destroy(),
      });
    }
    playBleep("pickup");
  }

  private fxDamage() {
    this.cameras.main.shake(120, 0.005);
    playBleep("hit");
  }

  private fxShield() {
    this.cameras.main.flash(120, 120, 220, 255, false);
    playBleep("pickup");
  }

  private finish(payload: EndPayload) {
    if (this.finished) return;
    this.finished = true;
    this.physics.pause();
    this.hintText.setText(
      payload.won ? "通关！大型关卡已征服 · 可保存分享链接。" : "再接再厉 · 再来一局或加强创意描述。",
    );
    if (payload.won) playBleep("win");
    this.onEnd(payload);
  }

  update() {
    if (this.finished) return;
    const speed = this.spec.gameplay.playerSpeed;
    const body = this.player.body as Phaser.Physics.Arcade.Body;

    this.updateAct();
    this.tickDirectorEvents();
    this.tickEventLoops();

    if (Phaser.Input.Keyboard.JustDown(this.keyShift)) {
      this.tryCastSkill();
    }

    const slowOn = this.time.now < this.slowUntil;
    const wanted = slowOn ? 0.78 : 1;
    if (wanted !== this.lastWorldTimeScale) {
      this.lastWorldTimeScale = wanted;
      this.physics.world.timeScale = wanted;
      this.time.timeScale = slowOn ? 0.92 : 1;
    }

    let vx = 0;
    if (this.cursors.left.isDown || this.keyA.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.keyD.isDown) vx += 1;
    const dashOn = this.time.now < this.dashUntil;
    this.player.setVelocityX(vx * speed * (dashOn ? 1.22 : 1));

    const jumpPressed =
      Phaser.Input.Keyboard.JustDown(this.keySpace) ||
      Phaser.Input.Keyboard.JustDown(this.keyW) ||
      Phaser.Input.Keyboard.JustDown(this.cursors.up);

    if (jumpPressed && body.blocked.down) {
      this.player.setVelocityY(-this.jumpVel);
    }

    if (this.time.now < this.magnetUntil) {
      const items = this.gems.getChildren();
      for (let i = 0; i < items.length; i += 1) {
        const c = items[i] as Phaser.Physics.Arcade.Image;
        if (!c?.active) continue;
        const d = Phaser.Math.Distance.Between(c.x, c.y, this.player.x, this.player.y);
        if (d > 320) continue;
        const dx = this.player.x - c.x;
        const dy = this.player.y - c.y;
        const len = Math.hypot(dx, dy) || 1;
        c.setVelocity((dx / len) * 180, (dy / len) * 180);
      }
    }

    if (this.player.y > this.scale.height + 120) {
      this.finish({ score: this.score, won: false });
    }
  }

  private tickEventLoops() {
    const now = this.time.now;
    if (now < this.coinRainUntil) {
      if (this.nextCoinSpawnAt <= 0) this.nextCoinSpawnAt = now;
      if (now >= this.nextCoinSpawnAt) {
        const n = Phaser.Math.Between(1, this.eventStrength >= 0.75 ? 2 : 1);
        for (let i = 0; i < n; i += 1) this.spawnEventGem();
        const delay = Math.floor(320 + (1 - this.eventStrength) * 240);
        this.nextCoinSpawnAt = now + delay;
      }
    }
    if (now < this.miniBossUntil) {
      if (this.nextMiniSpawnAt <= 0) this.nextMiniSpawnAt = now;
      if (now >= this.nextMiniSpawnAt) {
        this.spawnMiniBossHazard();
        const delay = Math.floor(820 + (1 - this.eventStrength) * 720);
        this.nextMiniSpawnAt = now + delay;
      }
    }
  }

  private spawnEventGem() {
    const viewH = this.scale.height;
    const x = Phaser.Math.Clamp(this.player.x + Phaser.Math.Between(160, 520), 80, this.worldW - 80);
    const y = Phaser.Math.Clamp(this.player.y + Phaser.Math.Between(-120, 120), 140, viewH - 200);
    const g = this.gems.create(x, y, "texGem");
    g.setDepth(8);
    g.setAlpha(0.92);
    const b = g.body as Phaser.Physics.Arcade.Body | null;
    if (b) b.setAllowGravity(false);
  }

  private spawnMiniBossHazard() {
    const viewH = this.scale.height;
    const x = Phaser.Math.Clamp(this.player.x + Phaser.Math.Between(220, 560), 120, this.worldW - 120);
    const y = Phaser.Math.Clamp(this.player.y + Phaser.Math.Between(-80, 80), 150, viewH - 160);
    const h = this.eliteHazards.create(x, y, "texSpike") as Phaser.Physics.Arcade.Image;
    h.setDepth(9);
    h.setAlpha(0.95);
    h.setScale(1.25 + this.eventStrength * 0.35);
    const b = h.body as Phaser.Physics.Arcade.Body | null;
    if (b) {
      b.setAllowGravity(false);
      b.setVelocity(Phaser.Math.Between(-240, -140), Phaser.Math.Between(-30, 30));
      b.setCollideWorldBounds(true);
      b.setBounce(1, 1);
    }
    // 兜底：防止场上残留太久
    this.time.delayedCall(5200, () => {
      if (h.active) h.destroy();
    });
  }

  private tickDirectorEvents() {
    const now = this.time.now;
    this.banner.tick();

    if (this.eventType && now >= this.eventUntil) {
      const ended = this.eventType;
      if (ended === "coinRain" || ended === "goalShift") this.scoreMult = 1;
      if (ended === "miniBoss") {
        const kids = this.eliteHazards.getChildren();
        for (let i = 0; i < kids.length; i += 1) {
          const it = kids[i] as Phaser.GameObjects.GameObject | undefined;
          if (it?.active) it.destroy();
        }
      }

      if (ended === "goalShift" && !this.goalShiftSucceeded) {
        this.banner.show({ title: "目标未达成", message: "没关系，下一段更刺激", ms: 1600 });
      } else {
        this.banner.show({ title: "事件结束", message: "进入下一章节", ms: 1400 });
      }

      this.eventType = null;
      this.eventUntil = 0;
      this.eventStrength = 0;
      this.refreshHud();
    }

    if (this.eventType) return;
    const events = this.spec.director?.events ?? [];
    if (!events.length) return;
    const t = this.winScore > 0 ? Phaser.Math.Clamp(this.score / this.winScore, 0, 1) : 0;
    while (this.eventIndex < events.length) {
      const ev = events[this.eventIndex] as DirectorEvent | undefined;
      if (!ev) break;
      if (t < ev.at) break;
      this.eventIndex += 1;
      this.startEvent(ev);
      break;
    }
  }

  private startEvent(ev: DirectorEvent) {
    const now = this.time.now;
    const strength = ev.strength ?? 0.6;
    const durationMs = ev.durationMs ?? 3500;
    const title = ev.title ?? (ev.type === "coinRain" ? "金币雨" : ev.type === "miniBoss" ? "精英来袭" : "目标变化");
    const message = ev.message ?? "";

    this.eventType = ev.type;
    this.eventStrength = strength;
    this.eventUntil = now + durationMs;

    this.banner.show({ title, message, ms: Math.min(2600, Math.max(1200, durationMs - 200)) });

    if (ev.type === "coinRain") {
      this.coinRainUntil = this.eventUntil;
      this.scoreMult = 2;
      this.magnetUntil = Math.max(this.magnetUntil, this.eventUntil);
      this.nextCoinSpawnAt = 0;
      this.refreshHud();
      return;
    }

    if (ev.type === "miniBoss") {
      this.miniBossUntil = this.eventUntil;
      this.nextMiniSpawnAt = 0;
      this.spawnMiniBossHazard();
      this.refreshHud();
      return;
    }

    if (ev.type === "goalShift") {
      this.goalShiftUntil = this.eventUntil;
      this.scoreMult = 2;
      this.goalShiftNeed = Math.max(4, Math.floor(6 + strength * 6));
      this.goalShiftHave = 0;
      this.goalShiftSucceeded = false;
      this.refreshHud();
    }
  }

  private updateAct() {
    const acts = this.spec.director?.acts ?? null;
    if (!acts?.length) return;
    const t = this.winScore > 0 ? Phaser.Math.Clamp(this.score / this.winScore, 0, 1) : 0;
    let idx = 0;
    for (let i = 0; i < acts.length; i += 1) {
      if (acts[i] && t >= acts[i]!.at) idx = i;
    }
    if (idx !== this.actIndex) {
      this.actIndex = idx;
      const mods = acts[idx]?.modifiers ?? [];
      if (mods.includes("precision")) {
        // 精准段落：稍微增强重力/缩短容错
        this.physics.world.gravity.y = Math.min(1400, (this.spec.gameplay.gravity ?? 980) * (1 + this.intensity * 0.12));
      }
      this.cameras.main.flash(90, 140, 120, 255, false);
      this.refreshHud();
    }
  }

  private spawnPowerup() {
    if (this.finished) return;
    const pool = this.spec.systems?.powerups ?? [];
    if (pool.length === 0) return;
    const pick = pool[Phaser.Math.Between(0, pool.length - 1)];
    if (!pick) return;
    const viewH = this.scale.height;
    const x = Phaser.Math.Clamp(this.player.x + Phaser.Math.Between(240, 520), 120, this.worldW - 120);
    const y = Phaser.Math.Between(160, viewH - 200);
    const s = this.powerups.create(x, y, "texPower");
    s.setDepth(9);
    s.setAlpha(0.95);
    s.setData("kind", pick.type);
    const b = s.body as Phaser.Physics.Arcade.Body | null;
    if (b) b.setAllowGravity(false);
  }

  private applyPowerup(kind: string) {
    const now = this.time.now;
    if (kind === "shield") {
      this.shieldCharges = Math.min(2, this.shieldCharges + 1);
      return;
    }
    if (kind === "doubleScore") {
      this.scoreMult = 2;
      this.time.delayedCall(5200, () => {
        this.scoreMult = 1;
      });
      return;
    }
    if (kind === "magnet") {
      this.magnetUntil = now + 5200;
      return;
    }
    if (kind === "heal") {
      this.lives = Math.min(9, this.lives + 1);
      return;
    }
    if (kind === "timeSlow") {
      this.slowUntil = now + 2600;
      return;
    }
  }

  private tryCastSkill() {
    const skill = this.spec.systems?.skill;
    if (!skill) return;
    if (this.time.now < this.skillReadyAt) return;

    this.skillReadyAt = this.time.now + skill.cooldownMs;
    const dur = skill.durationMs ?? 0;

    if (skill.effect === "shield") {
      this.shieldCharges = Math.max(this.shieldCharges, skill.strength && skill.strength > 0.75 ? 2 : 1);
      if (dur > 0) {
        this.time.delayedCall(dur, () => {
          this.shieldCharges = Math.max(0, this.shieldCharges - 1);
        });
      }
      this.fxShield();
      this.refreshHud();
      return;
    }

    if (skill.effect === "bomb") {
      const hx = this.player.x;
      const hy = this.player.y;
      const kids = this.spikes.getChildren();
      const r = 150;
      for (let i = 0; i < kids.length; i += 1) {
        const sp = kids[i] as Phaser.Physics.Arcade.Image;
        if (!sp?.active) continue;
        const d = Phaser.Math.Distance.Between(hx, hy, sp.x, sp.y);
        if (d <= r) sp.destroy();
      }
      this.cameras.main.flash(120, 255, 200, 90, false);
      playBleep("hit");
      this.refreshHud();
      return;
    }

    if (skill.effect === "dash") {
      this.dashUntil = this.time.now + 1100;
      this.invulnUntil = Math.max(this.invulnUntil, this.time.now + 520);
      this.cameras.main.flash(90, 120, 255, 160, false);
      playBleep("pickup");
      this.refreshHud();
      return;
    }

    if (skill.effect === "timeSlow") {
      this.slowUntil = Math.max(this.slowUntil, this.time.now + Math.max(1400, dur || 2200));
      this.refreshHud();
    }
  }

  private drawShieldRing() {
    this.shieldRing.clear();
    if (this.shieldCharges <= 0) return;
    const c = parseInt((this.spec.theme.collectibleColor ?? "#67e8f9").replace("#", ""), 16);
    this.shieldRing.lineStyle(2, c, 0.65);
    this.shieldRing.strokeCircle(this.player.x - this.cameras.main.scrollX, this.player.y, 28);
    this.shieldRing.strokeCircle(this.player.x - this.cameras.main.scrollX, this.player.y, 22);
  }
}
