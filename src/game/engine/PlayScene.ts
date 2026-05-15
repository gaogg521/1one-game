import Phaser from "phaser";
import { playBleep, setBleepTemperament } from "@/game/audio/webBleeps";
import type { GameSpec } from "@/lib/game-spec";
import { buildCohesivePresentation, type CohesivePresentation } from "@/lib/cohesive-presentation";
import { HudBanner } from "@/game/engine/HudBanner";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";

type EndPayload = { score: number; won: boolean };
type DirectorEvent = NonNullable<NonNullable<GameSpec["director"]>["events"]>[number];

export class PlayScene extends Phaser.Scene {
  private readonly spec: GameSpec;

  private readonly onEnd: (r: EndPayload) => void;

  private readonly soundscape: GameSoundscape | null;

  private player!: Phaser.Types.Physics.Arcade.ImageWithDynamicBody;

  private hazards!: Phaser.Physics.Arcade.Group;

  private collectibles!: Phaser.Physics.Arcade.Group;

  private powerups!: Phaser.Physics.Arcade.Group;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private keyW!: Phaser.Input.Keyboard.Key;

  private keyA!: Phaser.Input.Keyboard.Key;

  private keyS!: Phaser.Input.Keyboard.Key;

  private keyD!: Phaser.Input.Keyboard.Key;

  private keyShift!: Phaser.Input.Keyboard.Key;

  private score = 0;

  private lives = 3;

  private scoreText!: Phaser.GameObjects.Text;

  private livesText!: Phaser.GameObjects.Text | null;

  private progressText!: Phaser.GameObjects.Text;

  private hintText!: Phaser.GameObjects.Text;

  private actText!: Phaser.GameObjects.Text;

  private skillText!: Phaser.GameObjects.Text;

  private skillCdText!: Phaser.GameObjects.Text;

  private shieldRing!: Phaser.GameObjects.Graphics;

  private banner!: HudBanner;

  private cohesive!: CohesivePresentation;

  private dangerVignette: Phaser.GameObjects.Graphics | null = null;

  private spawnTimer!: Phaser.Time.TimerEvent;

  private powerupTimer!: Phaser.Time.TimerEvent;

  private finished = false;

  private invulnUntil = 0;

  private pad = 40;

  private winScore = 40;

  private intensity = 0.58;

  private actIndex = 0;

  private lastActUpdate = 0;

  private scoreMult = 1;

  private shieldCharges = 0;

  private magnetUntil = 0;

  private skillReadyAt = 0;

  private slowUntil = 0;

  private lastWorldTimeScale = 1;

  private eventIndex = 0;

  private eventUntil = 0;

  private eventType: string | null = null;

  private eventStrength = 0;

  private coinRainUntil = 0;

  private miniBossUntil = 0;

  private goalShiftUntil = 0;

  private goalText!: Phaser.GameObjects.Text;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape?: GameSoundscape) {
    super("PlayScene");
    this.spec = spec;
    this.onEnd = onEnd;
    this.soundscape = soundscape ?? null;
  }

  create() {
    const { width, height } = this.scale;
    this.pad = this.spec.gameplay.arenaPadding ?? 40;
    this.winScore = this.spec.gameplay.winScore ?? 40;
    this.lives = this.spec.gameplay.lives ?? 3;
    this.intensity = this.spec.director?.intensity ?? 0.58;

    const ui = buildCohesivePresentation(this.spec);
    setBleepTemperament(ui.bleepTemperament);
    this.cohesive = ui;

    this.addStarfield();

    this.add
      .text(width / 2, 22, this.spec.title, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "21px",
        color: ui.hud.title,
      })
      .setOrigin(0.5)
      .setDepth(20);

    if (this.spec.labels.subtitle) {
      this.add
        .text(width / 2, 48, this.spec.labels.subtitle, {
          fontFamily: "system-ui, sans-serif",
          fontSize: "12px",
          color: ui.hud.subtitle,
        })
        .setOrigin(0.5)
        .setDepth(20);
    }

    this.scoreText = this.add
      .text(18, 14, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "17px",
        color: ui.hud.body,
      })
      .setDepth(25);

    this.progressText = this.add
      .text(width - 18, 14, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        color: ui.hud.accent2,
      })
      .setOrigin(1, 0)
      .setDepth(25);

    this.actText = this.add
      .text(width / 2, 14, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "11px",
        color: ui.hud.muted,
      })
      .setOrigin(0.5, 0)
      .setDepth(25);

    const showLives =
      this.spec.templateId === "survivor" || this.spec.templateId === "collector";
    this.livesText = showLives
      ? this.add
          .text(18, 44, `生命 ${this.lives}`, {
            fontFamily: "system-ui, sans-serif",
            fontSize: "14px",
            color: ui.hud.danger,
          })
          .setDepth(25)
      : null;

    const controls =
      this.spec.templateId === "collector"
        ? "WASD / 方向键 · 收集「" +
          (this.spec.labels.collectible ?? "收集物") +
          "」· 躲开「" +
          this.spec.labels.hazard +
          "」"
        : "← → / A D · 躲开「" + this.spec.labels.hazard + "」";

    this.hintText = this.add
      .text(width / 2, height - 20, `${controls} · Shift 技能`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "11px",
        color: ui.hud.hint,
      })
      .setOrigin(0.5)
      .setDepth(25);

    const shiftCol = (c: number, d: number) => {
      const r = Phaser.Math.Clamp(((c >> 16) & 0xff) + d, 0, 255);
      const g2 = Phaser.Math.Clamp(((c >> 8) & 0xff) + d, 0, 255);
      const b = Phaser.Math.Clamp((c & 0xff) + d, 0, 255);
      return (r << 16) | (g2 << 8) | b;
    };

    // Player: rounded body + highlight + eyes
    if (!this.textures.exists("texPlayer")) {
      const pc = parseInt(this.spec.theme.playerColor.replace("#", ""), 16);
      const pd = shiftCol(pc, -55);
      const pl = shiftCol(pc, 50);
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x000000, 0.18); g.fillEllipse(19, 37, 28, 7); // shadow
      g.lineStyle(2.5, pd, 1); g.strokeRoundedRect(4, 6, 28, 28, 9);
      g.fillStyle(pc, 1); g.fillRoundedRect(4, 6, 28, 28, 9);
      g.fillStyle(pl, 0.4); g.fillRoundedRect(7, 8, 18, 9, 4); // highlight
      g.fillStyle(0x0f172a, 1); g.fillCircle(13, 18, 4); g.fillCircle(23, 18, 4); // eyes
      g.fillStyle(0xffffff, 0.75); g.fillCircle(14.2, 16.8, 1.5); g.fillCircle(24.2, 16.8, 1.5);
      g.fillStyle(pd, 1); g.fillRoundedRect(8, 32, 8, 5, 2); g.fillRoundedRect(20, 32, 8, 5, 2); // feet
      g.generateTexture("texPlayer", 36, 38); g.destroy();
    }

    // Hazard: angular menacing enemy with spiky silhouette
    if (!this.textures.exists("texHazard")) {
      const hc = parseInt(this.spec.theme.hazardColor.replace("#", ""), 16);
      const hd = shiftCol(hc, -55);
      const hl = shiftCol(hc, 45);
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x000000, 0.2); g.fillEllipse(22, 43, 30, 8); // shadow
      // Spiky crown
      g.fillStyle(hd, 1);
      g.fillTriangle(10, 14, 14, 2, 18, 14);
      g.fillTriangle(18, 14, 22, 0, 26, 14);
      g.fillTriangle(26, 14, 30, 2, 34, 14);
      // Body
      g.lineStyle(2.5, hd, 1); g.strokeRoundedRect(6, 12, 32, 26, 8);
      g.fillStyle(hc, 1); g.fillRoundedRect(6, 12, 32, 26, 8);
      g.fillStyle(hl, 0.3); g.fillRoundedRect(9, 14, 22, 9, 4);
      // Angry eyes
      g.fillStyle(0xfef3c7, 1); g.fillEllipse(15, 24, 10, 8); g.fillEllipse(29, 24, 10, 8);
      g.fillStyle(0x1a0000, 1); g.fillCircle(16, 25, 3.5); g.fillCircle(30, 25, 3.5);
      g.fillStyle(0xff3333, 0.7); g.fillCircle(16, 25, 1.8); g.fillCircle(30, 25, 1.8);
      g.generateTexture("texHazard", 44, 44); g.destroy();
    }

    // Gem: diamond with shine
    if (!this.textures.exists("texGem")) {
      const gc = parseInt((this.spec.theme.collectibleColor ?? this.spec.theme.playerColor).replace("#", ""), 16);
      const gd = shiftCol(gc, -50);
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(gc, 0.92);
      g.fillTriangle(14, 0, 27, 11, 14, 27); g.fillTriangle(14, 0, 1, 11, 14, 27);
      g.lineStyle(1.5, gd, 0.8);
      g.strokeTriangle(14, 0, 27, 11, 14, 27); g.strokeTriangle(14, 0, 1, 11, 14, 27);
      g.fillStyle(0xffffff, 0.6); g.fillTriangle(14, 1, 5, 10, 14, 10);
      g.generateTexture("texGem", 28, 28); g.destroy();
    }

    // Power-up: star shape
    if (!this.textures.exists("texPower")) {
      const pc2 = parseInt((this.spec.theme.collectibleColor ?? this.spec.theme.playerColor).replace("#", ""), 16);
      const g = this.make.graphics({ x: 0, y: 0 });
      const cx = 13, cy = 13, r1 = 12, r2 = 5.5, pts = 5;
      g.fillStyle(pc2, 0.95);
      g.beginPath();
      for (let i = 0; i < pts * 2; i++) {
        const ang = (i * Math.PI) / pts - Math.PI / 2;
        const r = i % 2 === 0 ? r1 : r2;
        if (i === 0) g.moveTo(cx + r * Math.cos(ang), cy + r * Math.sin(ang));
        else g.lineTo(cx + r * Math.cos(ang), cy + r * Math.sin(ang));
      }
      g.closePath(); g.fillPath();
      g.fillStyle(0xffffff, 0.5); g.fillCircle(cx - 3, cy - 3, 4);
      g.generateTexture("texPower", 26, 26); g.destroy();
    }

    const startX = width / 2;
    const startY =
      this.spec.templateId === "collector" ? height / 2 : height - this.pad;

    this.player = this.physics.add.image(startX, startY, "texPlayer");
    this.player.setCollideWorldBounds(true);
    this.player.body.setSize(30, 30);
    this.player.setDepth(5);

    this.hazards = this.physics.add.group();
    this.collectibles = this.physics.add.group();
    this.powerups = this.physics.add.group();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyA = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyW = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyS = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyShift = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

    this.shieldRing = this.add.graphics();
    this.shieldRing.setDepth(24);

    this.banner = new HudBanner(this, ui.banner);

    this.physics.add.overlap(this.player, this.hazards, (_p, h) => {
      if (this.finished) return;
      if (this.spec.templateId === "survivor" && this.time.now < this.invulnUntil) return;
      const hazard = h as Phaser.Physics.Arcade.Image;
      hazard.destroy();
      if (this.shieldCharges > 0) {
        this.shieldCharges -= 1;
        this.fxShield();
        this.refreshHud();
        return;
      }
      this.fxDamage();
      this.hitHazard();
    });

    this.physics.add.overlap(this.player, this.collectibles, (_p, gem) => {
      if (this.finished) return;
      const g = gem as Phaser.Physics.Arcade.Image;
      const gx = g.x;
      const gy = g.y;
      g.destroy();
      this.fxCollect(gx, gy);
      this.score += 1 * this.scoreMult;
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
    });

    this.physics.add.collider(this.hazards, this.powerups);

    const interval = this.spec.gameplay.spawnIntervalMs;
    this.spawnTimer = this.time.addEvent({
      delay: Math.max(240, Math.floor(interval * (1 - this.intensity * 0.18))),
      loop: true,
      callback: () => this.spawnWave(),
    });

    this.powerupTimer = this.time.addEvent({
      delay: Math.max(1800, Math.floor(5200 - this.intensity * 2200)),
      loop: true,
      callback: () => this.spawnPowerup(),
    });

    const skillName = this.spec.systems?.skill?.name ?? "技能";
    this.skillText = this.add
      .text(18, height - 56, `Shift · ${skillName}`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "12px",
        color: ui.hud.body,
      })
      .setDepth(26);
    this.skillCdText = this.add
      .text(18, height - 38, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "11px",
        color: ui.hud.muted,
      })
      .setDepth(26);

    this.goalText = this.add
      .text(width / 2, 64, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "12px",
        color: ui.hud.accent,
      })
      .setOrigin(0.5, 0)
      .setDepth(26);

    this.refreshHud();
    this.spawnWave();

    // Danger vignette overlay (hidden until low HP)
    this.dangerVignette = this.add.graphics();
    this.dangerVignette.setDepth(24);
    this.dangerVignette.setAlpha(0);
    this.dangerVignette.fillStyle(0xff2233, 1);
    this.dangerVignette.fillRect(0, 0, width, height);
  }

  private addStarfield() {
    const { width, height } = this.scale;
    const raw = this.spec.theme.particleTint?.replace("#", "") ?? "69746c";
    const parsed = parseInt(raw, 16);
    const tint = Number.isFinite(parsed) ? parsed : 0xa78bfa;
    for (let i = 0; i < 96; i += 1) {
      const x = Phaser.Math.Between(4, width - 4);
      const y = Phaser.Math.Between(4, height - 4);
      const s = Phaser.Math.FloatBetween(1, 2.4);
      const a = Phaser.Math.FloatBetween(0.06, 0.35);
      const dot = this.add.rectangle(x, y, s, s, tint, a);
      dot.setDepth(-12);
    }
  }

  private refreshHud() {
    this.scoreText.setText(`得分 ${this.score}`);
    const prog = Math.min(this.score, this.winScore);
    const suffix =
      this.spec.templateId === "collector"
        ? "收集进度"
        : this.spec.templateId === "avoider"
          ? "回避进度"
          : "进度";
    this.progressText.setText(`${suffix} ${prog}/${this.winScore}`);

    const acts = this.spec.director?.acts ?? null;
    const label = acts?.[this.actIndex]?.label;
    this.actText.setText(label ? `章节 · ${label}` : "");

    const cdLeft = Math.max(0, this.skillReadyAt - this.time.now);
    if (cdLeft <= 0) {
      this.skillCdText.setText("就绪");
    } else {
      this.skillCdText.setText(`冷却 ${(cdLeft / 1000).toFixed(1)}s`);
    }

    this.drawShieldRing();

    const now = this.time.now;
    if (now < this.goalShiftUntil) {
      this.goalText.setText("限时目标 · 疯狂收集 / 回避（奖励更高）");
      this.goalText.setAlpha(1);
    } else {
      this.goalText.setText("");
      this.goalText.setAlpha(0.85);
    }
  }

  private fxCollect(x: number, y: number) {
    const tintStr = this.spec.theme.collectibleColor ?? this.spec.theme.playerColor;
    const tint = parseInt(tintStr.replace("#", ""), 16);
    const n = 14;
    for (let i = 0; i < n; i += 1) {
      const bits = this.add.rectangle(x, y, 3, 3, tint, 0.95);
      bits.setDepth(30);
      this.tweens.add({
        targets: bits,
        x: x + Phaser.Math.Between(-72, 72),
        y: y + Phaser.Math.Between(-72, 72),
        alpha: 0,
        scale: 0.2,
        duration: Phaser.Math.Between(280, 420),
        ease: "Cubic.Out",
        onComplete: () => bits.destroy(),
      });
    }
    const floater = this.add
      .text(x, y - 14, "+1", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "16px",
        color: this.cohesive.hud.body,
      })
      .setOrigin(0.5)
      .setDepth(35);
    this.tweens.add({
      targets: floater,
      y: y - 52,
      alpha: 0,
      duration: 520,
      ease: "Quad.Out",
      onComplete: () => floater.destroy(),
    });
    this.cameras.main.flash(120, 180, 160, 255, false);
    playBleep("pickup");
  }

  private fxDamage() {
    this.cameras.main.shake(140, 0.0045);
    this.cameras.main.flash(160, 255, 90, 90, false);
    playBleep("hit");
  }

  private fxShield() {
    this.cameras.main.flash(120, 120, 220, 255, false);
    playBleep("pickup");
  }

  private spawnWave() {
    if (this.finished) return;
    const { width } = this.scale;
    const margin = 80;

    this.updateAct();
    this.tickDirectorEvents();

    if (this.spec.templateId === "collector") {
      if (Phaser.Math.Between(0, 1) === 0) {
        this.spawnCollectible(
          Phaser.Math.Between(margin, width - margin),
          Phaser.Math.Between(120, this.scale.height - 120),
        );
      }
      if (this.time.now < this.coinRainUntil && Phaser.Math.Between(0, 2) !== 0) {
        this.spawnCollectible(
          Phaser.Math.Between(margin, width - margin),
          Phaser.Math.Between(120, this.scale.height - 120),
        );
      }
      this.spawnHazard(
        Phaser.Math.Between(margin, width - margin),
        Phaser.Math.Between(120, this.scale.height - 120),
      );
      if (this.time.now < this.miniBossUntil && Phaser.Math.Between(0, 1) === 0) {
        this.spawnEliteHazard();
      }
      return;
    }

    const x = Phaser.Math.Between(margin, width - margin);
    const y = -40;
    this.spawnHazard(x, y);

    if (this.time.now < this.coinRainUntil && Phaser.Math.Between(0, 1) === 0) {
      this.spawnPowerup();
    }
    if (this.time.now < this.miniBossUntil && Phaser.Math.Between(0, 1) === 0) {
      this.spawnEliteHazard();
    }
  }

  private spawnEliteHazard() {
    const { width } = this.scale;
    const x = Phaser.Math.Between(90, width - 90);
    const h = this.hazards.create(x, -70, "texHazard");
    h.setDepth(6);
    h.setScale(1.55);
    h.setAlpha(0.9);
    h.setVelocity(
      Phaser.Math.Between(-80, 80),
      Math.floor(this.spec.gameplay.hazardSpeed * (1.25 + this.eventStrength * 0.25)),
    );
    const body = h.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    body.setBounce(1, 1);
    body.setAngularVelocity(Phaser.Math.Between(-220, 220));
  }

  private tickDirectorEvents() {
    const now = this.time.now;
    this.banner.tick();

    if (this.eventType && now >= this.eventUntil) {
      // 事件结束
      if (this.eventType === "coinRain") this.scoreMult = 1;
      if (this.eventType === "goalShift") this.scoreMult = 1;
      this.banner.show({ title: "事件结束", message: "准备迎接下一段挑战", ms: 1400 });
      this.eventType = null;
      this.eventUntil = 0;
      this.eventStrength = 0;
      this.refreshHud();
    }

    const events = this.spec.director?.events ?? [];
    if (!events.length) return;

    const t = this.winScore > 0 ? Phaser.Math.Clamp(this.score / this.winScore, 0, 1) : 0;
    while (this.eventIndex < events.length) {
      const ev = events[this.eventIndex];
      if (!ev) break;
      if (t < ev.at) break;
      this.eventIndex += 1;
      this.startEvent(ev);
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
      return;
    }

    if (ev.type === "miniBoss") {
      this.miniBossUntil = this.eventUntil;
      this.soundscape?.triggerEvent("boss");
      this.cameras.main.shake(380, 0.018);
      const x = Phaser.Math.Between(90, this.scale.width - 90);
      const h = this.hazards.create(x, -60, "texHazard");
      h.setDepth(6);
      h.setScale(1.7);
      h.setAlpha(0.92);
      h.setVelocity(Phaser.Math.Between(-60, 60), Math.floor(this.spec.gameplay.hazardSpeed * (1.35 + strength * 0.25)));
      const body = h.body as Phaser.Physics.Arcade.Body;
      body.setCollideWorldBounds(true);
      body.setBounce(1, 1);
      body.setAngularVelocity(Phaser.Math.Between(-220, 220));
      return;
    }

    if (ev.type === "goalShift") {
      this.goalShiftUntil = this.eventUntil;
      this.scoreMult = 2;
    }
  }

  private updateAct() {
    const now = this.time.now;
    if (now - this.lastActUpdate < 160) return;
    this.lastActUpdate = now;
    const acts = this.spec.director?.acts ?? null;
    if (!acts?.length) return;
    const t = this.winScore > 0 ? Phaser.Math.Clamp(this.score / this.winScore, 0, 1) : 0;
    let idx = 0;
    for (let i = 0; i < acts.length; i += 1) {
      if (acts[i] && t >= acts[i]!.at) idx = i;
    }
    if (idx !== this.actIndex) {
      this.actIndex = idx;
      const label = acts[idx]?.label ?? "";
      this.actText.setText(label ? `章节 · ${label}` : "");
      this.cameras.main.flash(90, 140, 120, 255, false);
      // Dynamic music: increase tension as act progresses
      const tension = this.intensity * (0.5 + 0.5 * (idx / Math.max(1, acts.length - 1)));
      this.soundscape?.setTension(tension);
    }
  }

  private spawnHazard(x: number, y: number) {
    const h = this.hazards.create(x, y, "texHazard");
    h.setDepth(4);
    const acts = this.spec.director?.acts ?? null;
    const mods = acts?.[this.actIndex]?.modifiers ?? [];
    const zigzag = mods.includes("zigzag");
    const doubleSpawn = mods.includes("doubleSpawn");

    h.setVelocity(
      this.spec.templateId === "collector"
        ? Phaser.Math.Between(-90, 90)
        : zigzag
          ? Phaser.Math.Between(-120, 120)
          : Phaser.Math.Between(-50, 50),
      this.spec.templateId === "collector"
        ? Phaser.Math.Between(-90, 90)
        : Math.floor(this.spec.gameplay.hazardSpeed * (1 + this.intensity * 0.22)),
    );
    const body = h.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    body.setBounce(1, 1);
    if (this.spec.templateId !== "collector") {
      body.setAngularVelocity(Phaser.Math.Between(-120, 120));
    }

    if (doubleSpawn && this.spec.templateId !== "collector") {
      const x2 = Phaser.Math.Clamp(x + Phaser.Math.Between(-120, 120), 80, this.scale.width - 80);
      const h2 = this.hazards.create(x2, y - 40, "texHazard");
      h2.setDepth(4);
      h2.setVelocity(Phaser.Math.Between(-60, 60), Math.floor(this.spec.gameplay.hazardSpeed * (1 + this.intensity * 0.18)));
      const b2 = h2.body as Phaser.Physics.Arcade.Body;
      b2.setCollideWorldBounds(true);
      b2.setBounce(1, 1);
      b2.setAngularVelocity(Phaser.Math.Between(-120, 120));
    }
  }

  private spawnCollectible(x: number, y: number) {
    const g = this.collectibles.create(x, y, "texGem");
    g.setDepth(6);
  }

  private spawnPowerup() {
    if (this.finished) return;
    const pool = this.spec.systems?.powerups ?? [];
    if (pool.length === 0) return;
    const pick = pool[Phaser.Math.Between(0, pool.length - 1)];
    if (!pick) return;
    const { width, height } = this.scale;
    const x =
      this.spec.templateId === "collector"
        ? Phaser.Math.Between(90, width - 90)
        : Phaser.Math.Between(90, width - 90);
    const y =
      this.spec.templateId === "collector"
        ? Phaser.Math.Between(120, height - 120)
        : -30;
    const s = this.powerups.create(x, y, "texPower");
    s.setDepth(7);
    s.setAlpha(0.95);
    s.setData("kind", pick.type);
    if (this.spec.templateId !== "collector") {
      s.setVelocity(Phaser.Math.Between(-30, 30), Math.floor(this.spec.gameplay.hazardSpeed * 0.62));
    } else {
      s.setVelocity(Phaser.Math.Between(-40, 40), Phaser.Math.Between(-40, 40));
      const body = s.body as Phaser.Physics.Arcade.Body;
      body.setCollideWorldBounds(true);
      body.setBounce(1, 1);
    }
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
      if (this.livesText) {
        this.lives = Math.min(9, this.lives + 1);
        this.livesText.setText(`生命 ${this.lives}`);
      }
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

    const cd = skill.cooldownMs;
    this.skillReadyAt = this.time.now + cd;

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
      const hazards = this.hazards.getChildren();
      const r = 160;
      for (let i = 0; i < hazards.length; i += 1) {
        const s = hazards[i] as Phaser.Physics.Arcade.Image;
        if (!s?.active) continue;
        const d = Phaser.Math.Distance.Between(hx, hy, s.x, s.y);
        if (d <= r) s.destroy();
      }
      this.cameras.main.flash(120, 255, 200, 90, false);
      playBleep("hit");
      this.refreshHud();
      return;
    }

    if (skill.effect === "dash") {
      const boostUntil = this.time.now + 900;
      const old = this.intensity;
      // dash：短时间提升操控速度（不改 spec）
      this.intensity = Math.max(0.2, old - 0.12);
      this.invulnUntil = Math.max(this.invulnUntil, this.time.now + 520);
      this.time.delayedCall(boostUntil - this.time.now, () => {
        this.intensity = old;
      });
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

  private hitHazard() {
    if (this.finished) return;

    if (this.spec.templateId === "survivor") {
      this.invulnUntil = this.time.now + 720;
      this.lives -= 1;
      this.cameras.main.shake(180, 0.009);
      this.cameras.main.flash(130, 255, 60, 60, false);
      playBleep("hit");
      this.player.setAlpha(0.35);
      this.time.delayedCall(200, () => this.player.setAlpha(1));
      if (this.livesText) this.livesText.setText(`生命 ${this.lives}`);
      if (this.lives === 1) {
        this.soundscape?.triggerEvent("danger");
        this.startDangerVignette();
      }
      if (this.lives <= 0) {
        this.finish({ score: this.score, won: false });
      }
      return;
    }

    if (this.spec.templateId === "collector") {
      this.lives -= 1;
      this.cameras.main.shake(160, 0.008);
      this.cameras.main.flash(120, 255, 60, 60, false);
      playBleep("hit");
      if (this.livesText) this.livesText.setText(`生命 ${this.lives}`);
      if (this.lives === 1) {
        this.soundscape?.triggerEvent("danger");
        this.startDangerVignette();
      }
      if (this.lives <= 0) {
        this.finish({ score: this.score, won: false });
      }
      return;
    }

    this.cameras.main.shake(200, 0.012);
    this.cameras.main.flash(150, 255, 60, 60, false);
    playBleep("hit");
    this.finish({ score: this.score, won: false });
  }

  private startDangerVignette() {
    if (!this.dangerVignette) return;
    this.tweens.killTweensOf(this.dangerVignette);
    this.tweens.add({
      targets: this.dangerVignette,
      alpha: { from: 0.0, to: 0.18 },
      duration: 800,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
  }

  private finish(payload: EndPayload) {
    if (this.finished) return;
    if (this.dangerVignette) {
      this.tweens.killTweensOf(this.dangerVignette);
      this.dangerVignette.setAlpha(0);
    }
    this.finished = true;
    this.spawnTimer.remove(false);
    this.physics.pause();
    this.hintText.setText(
      payload.won ? "胜利！可在页面按钮再来一局或分享链接。" : "再接再厉 · 再来一局或调整创意描述。",
    );
    if (payload.won) {
      playBleep("win");
      this.soundscape?.triggerEvent("victory");
    }
    this.onEnd(payload);
  }

  update() {
    if (this.finished) return;
    const baseSpeed = this.spec.gameplay.playerSpeed;
    const speed =
      this.time.now < this.magnetUntil && this.spec.templateId === "collector"
        ? Math.floor(baseSpeed * 1.08)
        : baseSpeed;
    const { width, height } = this.scale;

    if (Phaser.Input.Keyboard.JustDown(this.keyShift)) {
      this.tryCastSkill();
    }

    // 时间减速：直接用 world/time timeScale（避免每个物体重复缩放速度）
    const slowOn = this.time.now < this.slowUntil;
    const wanted = slowOn ? 0.75 : 1;
    if (wanted !== this.lastWorldTimeScale) {
      this.lastWorldTimeScale = wanted;
      this.physics.world.timeScale = wanted;
      this.time.timeScale = slowOn ? 0.92 : 1;
    }

    if (this.spec.templateId === "collector") {
      let vx = 0;
      let vy = 0;
      if (this.cursors.left.isDown || this.keyA.isDown) vx -= 1;
      if (this.cursors.right.isDown || this.keyD.isDown) vx += 1;
      if (this.cursors.up.isDown || this.keyW.isDown) vy -= 1;
      if (this.cursors.down.isDown || this.keyS.isDown) vy += 1;
      if (vx !== 0 || vy !== 0) {
        const len = Math.hypot(vx, vy);
        vx = (vx / len) * speed;
        vy = (vy / len) * speed;
      }
      this.player.setVelocity(vx, vy);

      // 磁铁：吸附收集物
      if (this.time.now < this.magnetUntil) {
        const items = this.collectibles.getChildren();
        for (let i = 0; i < items.length; i += 1) {
          const c = items[i] as Phaser.Physics.Arcade.Image;
          if (!c?.active) continue;
          const d = Phaser.Math.Distance.Between(c.x, c.y, this.player.x, this.player.y);
          if (d > 280) continue;
          const dx = this.player.x - c.x;
          const dy = this.player.y - c.y;
          const len = Math.hypot(dx, dy) || 1;
          c.setVelocity((dx / len) * 180, (dy / len) * 180);
        }
      }
      return;
    }

    let vx = 0;
    if (this.cursors.left.isDown || this.keyA.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.keyD.isDown) vx += 1;
    this.player.setVelocityX(vx * speed);
    this.player.setVelocityY(0);
    this.player.y = height - this.pad;

    const half = 18;
    this.player.x = Phaser.Math.Clamp(this.player.x, half + 8, width - half - 8);

    const hazards = this.hazards.getChildren();
    for (let i = 0; i < hazards.length; i += 1) {
      const s = hazards[i] as Phaser.Physics.Arcade.Image;
      if (!s.active) continue;
      if (s.y > height + 80) {
        s.destroy();
        if (!this.finished) {
          this.score += 1 * this.scoreMult;
          this.refreshHud();
          if (this.score >= this.winScore) {
            this.finish({ score: this.score, won: true });
          }
        }
      }
    }
  }

  private drawShieldRing() {
    this.shieldRing.clear();
    if (this.shieldCharges <= 0) return;
    const c = parseInt((this.spec.theme.collectibleColor ?? "#67e8f9").replace("#", ""), 16);
    this.shieldRing.lineStyle(2, c, 0.65);
    this.shieldRing.strokeCircle(this.player.x, this.player.y, 28);
    this.shieldRing.strokeCircle(this.player.x, this.player.y, 22);
  }
}
