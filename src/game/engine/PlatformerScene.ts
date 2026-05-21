import Phaser from "phaser";
import { playBleep, setBleepTemperament } from "@/game/audio/webBleeps";
import { HudBanner } from "@/game/engine/HudBanner";
import { juiceBurst, juiceFlash, juiceShake, themeParticleHex } from "@/game/engine/gameJuice";
import {
  addMinecraftPlatformerBackdrop,
  ensureMinecraftPlatformerTextures,
  isMinecraftLikeSpec,
} from "@/game/engine/minecraft-visuals";
import type { GameSpec } from "@/lib/game-spec";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import {
  buildCohesivePresentation,
  phaserUintToCssHex,
  type CohesivePresentation,
} from "@/lib/cohesive-presentation";

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

function shiftHex(c: number, d: number): number {
  const r = Phaser.Math.Clamp(((c >> 16) & 0xff) + d, 0, 255);
  const g = Phaser.Math.Clamp(((c >> 8) & 0xff) + d, 0, 255);
  const b = Phaser.Math.Clamp((c & 0xff) + d, 0, 255);
  return (r << 16) | (g << 8) | b;
}

export class PlatformerScene extends Phaser.Scene {
  private readonly spec: GameSpec;

  private readonly onEnd: (r: EndPayload) => void;

  private readonly soundscape: GameSoundscape | null;

  private player!: Phaser.Types.Physics.Arcade.ImageWithDynamicBody;

  private platforms!: Phaser.Physics.Arcade.StaticGroup;

  private gems!: Phaser.Physics.Arcade.Group;

  private powerups!: Phaser.Physics.Arcade.Group;

  private spikes!: Phaser.Physics.Arcade.StaticGroup;

  private eliteHazards!: Phaser.Physics.Arcade.Group;

  private sentryHazards!: Phaser.Physics.Arcade.Group;

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

  private cohesive!: CohesivePresentation;

  private dangerVignette: Phaser.GameObjects.Graphics | null = null;

  private finished = false;

  private invulnUntil = 0;

  private winScore = 36;

  private jumpVel = 420;

  private baseGravity = 980;

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

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape?: GameSoundscape) {
    super("PlatformerScene");
    this.spec = spec;
    this.onEnd = onEnd;
    this.soundscape = soundscape ?? null;
  }

  create() {
    const viewW = this.scale.width;
    const viewH = this.scale.height;
    this.winScore = this.spec.gameplay.winScore ?? 36;
    this.lives = this.spec.gameplay.lives ?? 4;
    this.jumpVel = this.spec.gameplay.jumpStrength ?? 420;
    const grav = this.spec.gameplay.gravity ?? 980;
    this.baseGravity = grav;
    this.physics.world.gravity.y = grav;
    this.intensity = this.spec.director?.intensity ?? 0.6;

    const ui = buildCohesivePresentation(this.spec);
    setBleepTemperament(ui.bleepTemperament);
    this.cohesive = ui;

    const blockyWorld = isMinecraftLikeSpec(this.spec);
    if (blockyWorld) {
      addMinecraftPlatformerBackdrop(this, this.worldW);
    } else {
      this.addStarfield();
    }

    this.add
      .text(viewW / 2, 22, this.spec.title, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "21px",
        color: ui.hud.title,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100);

    if (this.spec.labels.subtitle) {
      this.add
        .text(viewW / 2, 48, this.spec.labels.subtitle, {
          fontFamily: "system-ui, sans-serif",
          fontSize: "12px",
          color: ui.hud.subtitle,
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(100);
    }

    this.scoreText = this.add
      .text(18, 14, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "17px",
        color: ui.hud.body,
      })
      .setScrollFactor(0)
      .setDepth(101);

    this.progressText = this.add
      .text(viewW - 18, 14, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        color: ui.hud.accent,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(101);

    this.actText = this.add
      .text(viewW / 2, 68, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "11px",
        color: ui.hud.muted,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(101);

    this.livesText = this.add
      .text(18, 44, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        color: ui.hud.danger,
      })
      .setScrollFactor(0)
      .setDepth(101);

    const collLabel = this.spec.labels.collectible ?? "能量核";
    this.hintText = this.add
      .text(viewW / 2, viewH - 20, `← → / A D 移动 · Space / W / ↑ 跳跃 · Shift 技能 · 收集「${collLabel}」`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "11px",
        color: ui.hud.hint,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(101);

    // ─── Procedural textures (much more detailed than flat rect/circle) ───
    const makePlayerTex = (key: string, fillHex: string) => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ x: 0, y: 0 });
      const base = parseInt(fillHex.replace("#", ""), 16);
      const dark = (base & 0xfefefe) >> 1; // roughly half brightness
      const light = Math.min(0xffffff, base + 0x303030);
      // Body
      g.fillStyle(base, 1); g.fillRoundedRect(4, 10, 26, 26, 8);
      g.lineStyle(2, dark, 0.8); g.strokeRoundedRect(4, 10, 26, 26, 8);
      // Highlight
      g.fillStyle(light, 0.35); g.fillRoundedRect(7, 12, 16, 8, 4);
      // Head
      g.fillStyle(base, 1); g.fillRoundedRect(7, 1, 20, 16, 6);
      g.lineStyle(1.5, dark, 0.7); g.strokeRoundedRect(7, 1, 20, 16, 6);
      // Eyes
      g.fillStyle(0x0f172a, 1); g.fillCircle(12, 8, 3); g.fillCircle(22, 8, 3);
      g.fillStyle(0xffffff, 0.7); g.fillCircle(13, 7, 1.2); g.fillCircle(23, 7, 1.2);
      g.generateTexture(key, 34, 40); g.destroy();
    };

    const makePlatTex = (key: string, fillHex: string, hiHex: string) => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ x: 0, y: 0 });
      const base = parseInt(fillHex.replace("#", ""), 16);
      const hi = parseInt(hiHex.replace("#", ""), 16);
      g.fillStyle(base, 1); g.fillRoundedRect(0, 2, 120, 20, 5);
      g.lineStyle(1.5, 0x000000, 0.25); g.strokeRoundedRect(0, 2, 120, 20, 5);
      // Top highlight strip
      g.fillStyle(hi, 0.55); g.fillRoundedRect(2, 2, 116, 6, 3);
      // Plank lines
      g.lineStyle(1, 0x000000, 0.12);
      for (let x = 24; x < 120; x += 24) g.lineBetween(x, 4, x, 20);
      g.generateTexture(key, 120, 22); g.destroy();
    };

    const makeGemTex = (key: string, fillHex: string) => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ x: 0, y: 0 });
      const col = parseInt(fillHex.replace("#", ""), 16);
      const dark = (col & 0xfefefe) >> 1;
      // Diamond shape
      g.fillStyle(col, 0.9);
      g.fillTriangle(13, 0, 26, 10, 13, 26);
      g.fillTriangle(13, 0, 0, 10, 13, 26);
      g.lineStyle(1.5, dark, 0.7);
      g.strokeTriangle(13, 0, 26, 10, 13, 26);
      g.strokeTriangle(13, 0, 0, 10, 13, 26);
      // Shine
      g.fillStyle(0xffffff, 0.55); g.fillTriangle(13, 1, 5, 9, 13, 9);
      g.generateTexture(key, 26, 26); g.destroy();
    };

    const makeSpikeTex = (key: string, fillHex: string) => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ x: 0, y: 0 });
      const col = parseInt(fillHex.replace("#", ""), 16);
      // 3 triangular spikes
      for (let i = 0; i < 3; i++) {
        const bx = i * 12 + 6;
        g.fillStyle(col, 1); g.fillTriangle(bx, 0, bx - 6, 18, bx + 6, 18);
        g.lineStyle(1, 0x000000, 0.4); g.strokeTriangle(bx, 0, bx - 6, 18, bx + 6, 18);
      }
      g.generateTexture(key, 36, 18); g.destroy();
    };

    const makeGroundTex = (key: string, fillHex: string) => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ x: 0, y: 0 });
      const col = parseInt(fillHex.replace("#", ""), 16);
      const dark = (col & 0xfefefe) >> 1;
      g.fillStyle(col, 1); g.fillRect(0, 0, 64, 40);
      g.fillStyle(dark, 0.2);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
        g.fillRect(c * 32 + (r % 2 === 0 ? 0 : 16), r * 14 + 1, 30, 12);
      }
      g.lineStyle(1, 0x000000, 0.18);
      for (let x = 32; x < 64; x += 32) g.lineBetween(x, 0, x, 40);
      for (let y = 14; y < 40; y += 14) g.lineBetween(0, y, 64, y);
      g.generateTexture(key, 64, 40); g.destroy();
    };

    if (blockyWorld) {
      ensureMinecraftPlatformerTextures(this, this.spec);
    } else {
      makePlayerTex("texPlayer", this.spec.theme.playerColor);
      makePlatTex("texPlat", phaserUintToCssHex(ui.platformMid), phaserUintToCssHex(ui.platformHi));
      makePlatTex("texPlatHi", phaserUintToCssHex(ui.platformHi), phaserUintToCssHex(ui.platformHi));
      makeGroundTex("texGround", phaserUintToCssHex(ui.platformGround));
      makeSpikeTex("texSpike", this.spec.theme.hazardColor);
      makeGemTex("texGem", this.spec.theme.collectibleColor ?? this.spec.theme.playerColor);
      makeGemTex("texPower", this.spec.theme.collectibleColor ?? this.spec.theme.playerColor);
    }

    this.platforms = this.physics.add.staticGroup();
    this.spikes = this.physics.add.staticGroup();
    this.gems = this.physics.add.group();
    this.powerups = this.physics.add.group();
    this.eliteHazards = this.physics.add.group();
    this.sentryHazards = this.physics.add.group();

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
    this.physics.add.overlap(this.player, this.sentryHazards, () => this.onHitHazard());

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyA = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyW = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyShift = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

    this.banner = new HudBanner(this, ui.banner);

    this.shieldRing = this.add.graphics();
    this.shieldRing.setDepth(120);
    this.shieldRing.setScrollFactor(0);

    const skillName = this.spec.systems?.skill?.name ?? "技能";
    this.skillText = this.add
      .text(18, viewH - 56, `Shift · ${skillName}`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "12px",
        color: ui.hud.body,
      })
      .setScrollFactor(0)
      .setDepth(130);
    this.skillCdText = this.add
      .text(18, viewH - 38, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "11px",
        color: ui.hud.muted,
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

    // Danger vignette overlay (hidden until low HP)
    this.dangerVignette = this.add.graphics();
    this.dangerVignette.setDepth(24);
    this.dangerVignette.setAlpha(0);
    this.dangerVignette.fillStyle(0xff2233, 1);
    this.dangerVignette.fillRect(0, 0, viewW * 4, viewH);
  }

  private buildLevel(viewH: number) {
    const seed = hashTitle(this.spec.title);
    const groundY = viewH - 36;
    const pad = this.spec.gameplay.arenaPadding ?? 36;
    const acts = this.spec.director?.acts ?? [];
    const totalLayers = 44;

    const getActIndexForRatio = (ratio: number) => {
      let idx = 0;
      for (let i = 0; i < acts.length; i += 1) {
        if (acts[i] && ratio >= acts[i]!.at) idx = i;
      }
      return idx;
    };

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
    let lastActIdx = -1;

    while (layer < totalLayers && x < this.worldW - pad - 80) {
      const ratio = layer / Math.max(1, totalLayers - 1);
      const actIdx = getActIndexForRatio(ratio);
      const mods = acts[actIdx]?.modifiers ?? [];
      const isGapAct = mods.includes("gaps");
      const isSpikeAct = mods.includes("spikes");
      const isPrecisionAct = mods.includes("precision");
      const isFinaleAct = mods.includes("finale");

      if (actIdx !== lastActIdx) {
        const stageWidth = isFinaleAct ? 220 : 180;
        const stage = this.platforms.create(x + stageWidth / 2, y + 18, "texPlatHi");
        stage.setDisplaySize(stageWidth, 24);
        stage.refreshBody();

        for (let i = 0; i < 2 + (isFinaleAct ? 1 : 0); i += 1) {
          const gem = this.gems.create(x + 44 + i * 42, y - 24, "texGem");
          gem.setDepth(8);
          const gb = gem.body as Phaser.Physics.Arcade.Body | null;
          if (gb) gb.setAllowGravity(false);
        }

        if ((isSpikeAct || isFinaleAct) && actIdx > 0) {
          this.spawnSentryHazard(x + stageWidth + 18, y - 18, isFinaleAct ? 72 : 52, isFinaleAct ? 1.15 : 0.92);
        }

        x += stageWidth - 26;
        y = Phaser.Math.Clamp(y - (isPrecisionAct ? 18 : 8), 190, groundY - 120);
        lastActIdx = actIdx;
      }

      const rw = rnd(seed, layer * 3);
      const platW = Math.floor(
        isPrecisionAct
          ? 68 + rw * 64
          : isGapAct
            ? 82 + rw * 78
            : isFinaleAct
              ? 88 + rw * 86
              : 78 + rw * 112,
      );
      const plat = this.platforms.create(x + platW / 2, y, rnd(seed, layer) > 0.55 ? "texPlatHi" : "texPlat");
      plat.setDisplaySize(platW, 22);
      plat.refreshBody();

      const gemRoll = rnd(seed, layer * 7 + 1);
      const gemThreshold = isPrecisionAct ? 0.28 : isGapAct ? 0.2 : 0.16;
      if (gemRoll > gemThreshold) {
        const gem = this.gems.create(x + platW / 2, y - 36, "texGem");
        gem.setDepth(8);
        const gb = gem.body as Phaser.Physics.Arcade.Body | null;
        if (gb) gb.setAllowGravity(false);
      }

      const spikeRoll = rnd(seed, layer * 11 + 2);
      const spikeThreshold = isSpikeAct ? 0.46 : isPrecisionAct ? 0.58 : 0.72;
      if (spikeRoll > spikeThreshold && platW > (isPrecisionAct ? 82 : 95)) {
        const spikeCount = isSpikeAct || isFinaleAct ? 2 : 1;
        for (let i = 0; i < spikeCount; i += 1) {
          const spikeX = x + platW * (spikeCount === 1 ? 0.72 : 0.52 + i * 0.22);
          const spike = this.spikes.create(spikeX, y - 2, "texSpike");
          spike.setDisplaySize(32, 16);
          spike.refreshBody();
        }
      }

      if ((isSpikeAct || isFinaleAct) && rnd(seed, layer * 13 + 9) > (isFinaleAct ? 0.58 : 0.76)) {
        this.spawnSentryHazard(
          x + platW + Phaser.Math.Between(42, 74),
          y - Phaser.Math.Between(26, 54),
          isFinaleAct ? 84 : 58,
          isFinaleAct ? 1.08 : 0.82,
        );
      }

      const stepX =
        (isGapAct ? 124 : isPrecisionAct ? 88 : isFinaleAct ? 118 : 96) +
        rnd(seed, layer * 5 + 4) * (isGapAct ? 110 : isPrecisionAct ? 68 : 88);
      const stepY =
        (isPrecisionAct ? -62 : -48) +
        rnd(seed, layer * 6 + 5) * (isPrecisionAct ? 132 : isGapAct ? 126 : 112);
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

  private spawnSentryHazard(x: number, y: number, patrolRange: number, speedScale: number) {
    const sentry = this.sentryHazards.create(x, y, "texSpike") as Phaser.Physics.Arcade.Image;
    sentry.setDepth(9);
    sentry.setScale(1.18);
    sentry.setAlpha(0.96);
    const b = sentry.body as Phaser.Physics.Arcade.Body | null;
    if (b) {
      b.setAllowGravity(false);
      b.setImmovable(true);
    }
    this.tweens.add({
      targets: sentry,
      x: x + patrolRange,
      duration: Math.floor(1200 / Math.max(0.45, speedScale)),
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
  }

  private addStarfield() {
    const raw = this.spec.theme.particleTint?.replace("#", "") ?? "6b7f78";
    const parsed = parseInt(raw, 16);
    const tint = Number.isFinite(parsed) ? parsed : 0x38bdf8;
    const W = this.worldW;
    const H = this.scale.height;
    const p = this.spec.labels.subtitle?.toLowerCase() ?? "";
    const title = this.spec.title.toLowerCase();
    const prompt = `${p} ${title}`;
    const isOcean = /海|珊瑚|水下|ocean|sea|coral|bubble/.test(prompt);
    const isForest = /森林|树|草地|丛林|forest|jungle|tree|meadow/.test(prompt);
    const isSpace = /太空|宇宙|星|银河|space|galaxy|star|cosmos/.test(prompt);
    const isCyber = /赛博|霓虹|cyber|neon|数字|digital/.test(prompt);

    // Base particle dots (all themes)
    for (let i = 0; i < 90; i += 1) {
      const x = Phaser.Math.Between(4, W - 4);
      const y = Phaser.Math.Between(4, H - 4);
      const s = Phaser.Math.FloatBetween(1, 2.4);
      const a = Phaser.Math.FloatBetween(0.06, 0.28);
      this.add.rectangle(x, y, s, s, tint, a).setDepth(-12);
    }

    const bg = parseInt(this.spec.theme.backgroundColor.replace("#", ""), 16);

    if (isSpace) {
      // Stars: more dots, some bright + distant planets
      for (let i = 0; i < 80; i += 1) {
        const x = Phaser.Math.Between(4, W - 4);
        const y = Phaser.Math.Between(4, H * 0.75);
        const s = Phaser.Math.FloatBetween(1.5, 3.5);
        this.add.circle(x, y, s, 0xffffff, Phaser.Math.FloatBetween(0.25, 0.85)).setDepth(-11);
      }
      // Distant planets / moons
      for (let p2 = 0; p2 < 3; p2 += 1) {
        const x = Phaser.Math.Between(W * 0.1, W * 0.9);
        const y = Phaser.Math.Between(30, H * 0.45);
        const r = Phaser.Math.Between(18, 42);
        this.add.circle(x, y, r, tint, 0.18).setDepth(-13);
        this.add.circle(x, y, r, 0xffffff, 0.06).setDepth(-12);
      }
    } else if (isOcean) {
      // Bubbles drifting up
      for (let i = 0; i < 55; i += 1) {
        const x = Phaser.Math.Between(4, W - 4);
        const y = Phaser.Math.Between(H * 0.1, H - 60);
        const r = Phaser.Math.FloatBetween(2, 7);
        const g = this.add.graphics().setDepth(-11);
        g.lineStyle(1, 0xbae6fd, 0.35);
        g.strokeCircle(x, y, r);
        g.fillStyle(0xbae6fd, 0.08);
        g.fillCircle(x, y, r);
      }
      // Wavy distant coral silhouettes
      const gCoral = this.add.graphics().setDepth(-13);
      for (let cx = 0; cx < W; cx += 180) {
        const bx = cx + Phaser.Math.Between(0, 120);
        const bh = Phaser.Math.Between(30, 80);
        gCoral.fillStyle(tint, 0.2);
        gCoral.fillEllipse(bx, H - bh / 2, 28, bh);
        gCoral.fillEllipse(bx + 18, H - bh * 0.6, 20, bh * 0.7);
        gCoral.fillEllipse(bx - 14, H - bh * 0.5, 18, bh * 0.5);
      }
    } else if (isForest) {
      // Tree silhouettes in background
      const gTree = this.add.graphics().setDepth(-13);
      const bgDark = shiftHex(bg, -30);
      for (let tx = 0; tx < W; tx += Phaser.Math.Between(60, 140)) {
        const th = Phaser.Math.Between(60, 140);
        const tw = Phaser.Math.Between(28, 55);
        gTree.fillStyle(bgDark, 0.55);
        // Trunk
        gTree.fillRect(tx + tw / 2 - 5, H - 50, 10, 50);
        // Canopy (3 circles)
        gTree.fillCircle(tx + tw / 2, H - 50 - th * 0.4, tw / 2.2);
        gTree.fillCircle(tx + tw / 2 - tw * 0.28, H - 50 - th * 0.3, tw / 3);
        gTree.fillCircle(tx + tw / 2 + tw * 0.28, H - 50 - th * 0.3, tw / 3);
      }
      // Ground haze
      const gHaze = this.add.graphics().setDepth(-12);
      gHaze.fillStyle(tint, 0.07);
      gHaze.fillRect(0, H - 80, W, 80);
    } else if (isCyber) {
      // Grid lines + scanlines
      const gGrid = this.add.graphics().setDepth(-13);
      gGrid.lineStyle(0.5, tint, 0.12);
      for (let gx = 0; gx < W; gx += 80) gGrid.lineBetween(gx, 0, gx, H);
      for (let gy = 0; gy < H; gy += 60) gGrid.lineBetween(0, gy, W, gy);
      // Glowing data nodes
      for (let i = 0; i < 22; i += 1) {
        const x = Phaser.Math.Between(0, W);
        const y = Phaser.Math.Between(0, H);
        this.add.circle(x, y, Phaser.Math.FloatBetween(2, 5), tint, 0.45).setDepth(-11);
      }
    } else {
      // Generic: soft hill silhouettes in distant background
      const gHills = this.add.graphics().setDepth(-13);
      gHills.fillStyle(bg, 1);
      const hillColor = shiftHex(bg, -18);
      gHills.fillStyle(hillColor, 0.6);
      for (let hx = 0; hx < W; hx += 320) {
        gHills.fillEllipse(hx + 160, H - 20, 380, 120);
        gHills.fillEllipse(hx + 320, H - 10, 280, 80);
      }
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
    if (this.lives === 1) {
      this.soundscape?.triggerEvent("danger");
      this.startDangerVignette();
    }
    if (this.lives <= 0) {
      this.finish({ score: this.score, won: false });
    }
  }

  private fxCollect(x: number, y: number) {
    juiceBurst(this, x, y, themeParticleHex(this.spec), 12);
    juiceFlash(this, { r: 180, g: 160, b: 255 }, { durationMs: 100 });
    playBleep("pickup");
    this.soundscape?.triggerKillStinger();
  }

  private fxDamage() {
    juiceShake(this, { durationMs: 120, intensity: 0.005 });
    juiceFlash(this, { r: 255, g: 60, b: 60 }, { durationMs: 130 });
    playBleep("hit");
  }

  private fxShield() {
    juiceFlash(this, { r: 120, g: 120, b: 255 }, { durationMs: 120 });
    playBleep("pickup");
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
    this.physics.pause();
    this.hintText.setText(
      payload.won ? "通关！大型关卡已征服 · 可保存分享链接。" : "再接再厉 · 再来一局或加强创意描述。",
    );
    if (payload.won) {
      playBleep("win");
      this.soundscape?.triggerEvent("victory");
    }
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
      juiceShake(this, { durationMs: 350, intensity: 0.016 });
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
      return;
    }

    // 未知事件类型：横幅即可，避免残留 scoreMult / 刷怪窗口
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
      const gravityMul = mods.includes("precision") ? 1.12 : mods.includes("gaps") ? 0.96 : 1;
      this.physics.world.gravity.y = Math.min(1400, this.baseGravity * gravityMul);
      if (mods.includes("finale")) {
        this.soundscape?.triggerEvent("boss");
      }
      const sections = ["intro", "build", "drop", "climax"] as const;
      this.soundscape?.setSection(sections[idx] ?? "intro");
      const stageMessage = mods.includes("precision")
        ? "精准段落：容错变小，注意落点"
        : mods.includes("gaps")
          ? "断层段落：准备连续长跳"
          : mods.includes("spikes")
            ? "陷阱段落：平台上危险更密集"
            : mods.includes("finale")
              ? "终局冲刺：精英守卫正在拦截"
              : "进入下一段关卡";
      this.banner.show({ title: `章节 · ${acts[idx]?.label ?? "推进"}`, message: stageMessage, ms: 1400 });
      juiceFlash(this, { r: 140, g: 120, b: 255 }, { durationMs: 90 });
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
      juiceFlash(this, { r: 255, g: 200, b: 90 }, { durationMs: 120 });
      playBleep("hit");
      this.refreshHud();
      return;
    }

    if (skill.effect === "dash") {
      this.dashUntil = this.time.now + 1100;
      this.invulnUntil = Math.max(this.invulnUntil, this.time.now + 520);
      juiceFlash(this, { r: 120, g: 255, b: 160 }, { durationMs: 90 });
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
