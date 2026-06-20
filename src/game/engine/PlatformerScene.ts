import Phaser from "phaser";
import { playBleep } from "@/game/audio/webBleeps";
import { pointerSteerX, readMoveAxis } from "@/game/engine/phaser-input";
import { HudFrame } from "@/game/engine/HudFrame";
import {
  juiceBoss,
  juiceBurst,
  juiceFail,
  juiceFlash,
  juiceHit,
  juicePickup,
  juiceWin,
  themeParticleHex,
} from "@/game/engine/gameJuice";
import {
  drawStealthLaserBeam,
  paintStealthVaultBackdrop,
} from "@/game/engine/action-visual";
import {
  addMinecraftPlatformerBackdrop,
  ensureMinecraftPlatformerTextures,
  isMinecraftLikeSpec,
} from "@/game/engine/minecraft-visuals";
import type { GameSpec } from "@/lib/game-spec";
import { buildPlatformerBlueprint } from "@/lib/platformer-blueprint";
import {
  paintPlatformerParallax,
} from "@/game/engine/template-theme-visual";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { AppLocale } from "@/i18n/routing";
import { gameEventTitle, platformerFinalSprint } from "@/lib/i18n/game-event-labels";
import {
  bannerActStage,
  bannerCheckpointSaved,
  bannerEventEnd,
  bannerPlatformerGoalMiss,
  bannerPlatformerGoalSuccess,
  hudActChapter,
  hudCooldown,
  hudPlatformerCollect,
  hudPlatformerTarget,
  hudReady,
  hudDefaultSkill,
  platformerFinishText,
  platformerStageMessage,
} from "@/lib/i18n/game-hud-labels";
import { phaserUintToCssHex, resolveAssetStyle, type CohesivePresentation } from "@/lib/cohesive-presentation";
import { buildPlatformerAssetSet } from "@/game/engine/platformer-assets";
import { buildPlayAssetSet } from "@/game/engine/play-assets";
import { showControlsHint, platformerControlLines } from "@/game/engine/controls-hint";
import { spawnDamageNumber } from "@/game/engine/damage-number";
import { buildSceneCohesion } from "@/lib/scene-experience";
import { runtimeSeedFromSpec } from "@/lib/runtime-seed";
import { initQaState, setPhaserQaState } from "@/game/engine/phaser-qa-state";
import { applySpritesOverAliasMap, assetBackgroundAlpha, fitSpriteDisplay, preloadSpriteSet } from "@/game/engine/phaser-loaded-sprites";
import { schedulePhaserPlayReady } from "@/game/engine/phaser-play-ready";
import { buildSceneGoalGuidance } from "@/lib/scene-goal-guidance";
import { applyRuntimeEventImpact } from "@/game/engine/runtimeEventImpact";
import { applySystemImpact } from "@/game/engine/systemImpact";

type EndPayload = { score: number; won: boolean };
type DirectorEvent = NonNullable<NonNullable<GameSpec["director"]>["events"]>[number];

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
  public backgroundUrl: string | null = null;
  public projectId: string | null = null;
  public uiLocale: AppLocale = "zh-Hans";

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

  private movingPlatforms!: Phaser.Physics.Arcade.Group;

  private movingPlatConfigs: Array<{
    spr: Phaser.Physics.Arcade.Image;
    baseX: number;
    baseY: number;
    ampX: number;
    ampY: number;
    freq: number;
    phase: number;
  }> = [];

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private keyW!: Phaser.Input.Keyboard.Key;

  private keyS!: Phaser.Input.Keyboard.Key;

  private keyA!: Phaser.Input.Keyboard.Key;

  private keyD!: Phaser.Input.Keyboard.Key;

  private keySpace!: Phaser.Input.Keyboard.Key;

  private keyShift!: Phaser.Input.Keyboard.Key;

  private score = 0;

  private lives = 3;

  private hud!: HudFrame;

  private cohesive!: CohesivePresentation;

  private finished = false;

  private invulnUntil = 0;

  private winScore = 36;

  private jumpVel = 420;

  private baseGravity = 980;

  private worldW = 4800;

  private intensity = 0.6;

  private actIndex = 0;

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

  private stealthMode = false;

  private grappleEnabled = false;

  private doubleJumpAllowed = false;

  private doubleJumpUsed = false;

  private grappleActive = false;

  private grappleGfx!: Phaser.GameObjects.Graphics;
  private trailGfx!: Phaser.GameObjects.Graphics;

  private treasureHeist = false;

  private laserSentries = false;

  private grapplePull = 0.022;

  private treasureSprite: Phaser.Physics.Arcade.Image | null = null;

  private laserGfx!: Phaser.GameObjects.Graphics;

  private laserHitCd = 0;
  private laserPulse = 0;
  private treasureGlow?: Phaser.GameObjects.Arc;

  private checkpoints!: Phaser.Physics.Arcade.StaticGroup;
  private lastCheckpointX = 140;
  private lastCheckpointY = 0; // set in create() after viewH is known
  private spawnX = 140;
  private spawnY = 0;

  // 游戏手感：Coyote Time + Jump Buffer
  /** 离开平台后仍可跳跃的截止时间（coyote time 120ms） */
  private coyoteUntil = 0;
  /** 提前输入跳跃的截止时间（jump buffer 110ms） */
  private jumpBufferUntil = 0;

  // Mobile controls
  private mobileJumpZone: Phaser.GameObjects.Zone | null = null;
  private mobileJumpBtnGfx: Phaser.GameObjects.Graphics | null = null;

  // Procedural character animation state
  private wasGrounded = true;
  private hurtFlashUntil = 0;

  // Player movement trail
  private playerTrail: Array<{ x: number; y: number; t: number }> = [];

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape?: GameSoundscape) {
    super("PlatformerScene");
    this.spec = spec;
    this.onEnd = onEnd;
    this.soundscape = soundscape ?? null;
  }

  preload() {
    if (this.backgroundUrl) {
      this.load.image("bgTex", this.backgroundUrl);
    }
    if (this.projectId) {
      preloadSpriteSet(this, this.projectId, ["player", "gem", "power", "boss"]);
    }
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

    const platBp = this.spec.platformer ?? buildPlatformerBlueprint({ spec: this.spec });
    this.stealthMode = platBp.mode === "stealth";
    this.grappleEnabled = platBp.grappleEnabled ?? this.stealthMode;
    this.doubleJumpAllowed = platBp.doubleJump ?? this.stealthMode;
    if (this.stealthMode) {
      this.jumpVel = Math.max(this.jumpVel, 480);
      this.baseGravity = Math.min(this.baseGravity, 820);
      this.physics.world.gravity.y = this.baseGravity;
    }
    this.worldW = platBp.worldWidth ?? this.worldW;
    const suggestedWin = platBp.suggestedWinScore ?? this.winScore;
    if ((this.spec.gameplay.winScore ?? 0) < suggestedWin) {
      this.winScore = suggestedWin;
    }
    this.grappleGfx = this.add.graphics().setDepth(50);
    this.trailGfx = this.add.graphics().setDepth(6);

    const samplePf = this.spec.samplePlayProfile?.platformer;
    this.treasureHeist = samplePf?.treasureHeist ?? false;
    this.laserSentries = samplePf?.laserSentries ?? false;
    this.grapplePull = samplePf?.grapplePull ?? 0.022;
    this.laserGfx = this.add.graphics().setDepth(48);

    const ui = buildSceneCohesion(this.spec);
    this.cohesive = ui;

    const blockyWorld = isMinecraftLikeSpec(this.spec);
    if (this.treasureHeist) {
      paintStealthVaultBackdrop(this, this.spec, this.worldW, viewH);
    } else if (blockyWorld) {
      addMinecraftPlatformerBackdrop(this, this.worldW);
    } else {
      this.addStarfield();
      paintPlatformerParallax(this, this.spec, this.worldW, viewH);
    }

    // 文生图背景
    if (this.backgroundUrl && this.textures.exists("bgTex")) {
      this.add
        .image(this.worldW / 2, viewH / 2, "bgTex")
        .setDepth(-10)
        .setAlpha(assetBackgroundAlpha(this.projectId, ui.qualityTier));
    }

    const guidance = buildSceneGoalGuidance(this.spec, this.uiLocale);

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
      const dark = (base & 0xfefefe) >> 1;
      // Drop shadow
      g.fillStyle(0x000000, 0.18); g.fillRoundedRect(3, 6, 120, 20, 5);
      // Body
      g.fillStyle(base, 1); g.fillRoundedRect(0, 2, 120, 20, 5);
      g.lineStyle(1.5, dark, 0.35); g.strokeRoundedRect(0, 2, 120, 20, 5);
      // Top highlight strip
      g.fillStyle(hi, 0.6); g.fillRoundedRect(2, 2, 116, 7, 3);
      // Bottom shadow strip
      g.fillStyle(0x000000, 0.12); g.fillRoundedRect(2, 16, 116, 5, 2);
      // Plank lines
      g.lineStyle(1, 0x000000, 0.10);
      for (let x = 24; x < 120; x += 24) g.lineBetween(x, 4, x, 20);
      g.generateTexture(key, 120, 26); g.destroy();
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
      // 高保真程序化资产：平台/地面/尖刺/旗 走 platformer-assets；
      // 玩家/宝石/道具/boss 优先用 SVG/PNG；无则回退程序化 play-assets。
      const platStyle = resolveAssetStyle(this.spec);
      const platPalette = {
        player: this.spec.theme.playerColor,
        hazard: this.spec.theme.hazardColor,
        collectible: this.spec.theme.collectibleColor ?? this.spec.theme.playerColor,
        particle: this.spec.theme.particleTint ?? this.spec.theme.collectibleColor ?? "#a3a3a3",
        background: this.spec.theme.backgroundColor,
        platformMid: phaserUintToCssHex(ui.platformMid),
        platformHi: phaserUintToCssHex(ui.platformHi),
        platformGround: phaserUintToCssHex(ui.platformGround),
      };
      const platSet = buildPlatformerAssetSet(this, platPalette, platStyle, "texPlatA");
      const playSet = buildPlayAssetSet(this, platPalette, platStyle, "texPlatP");
      const aliasMap: Array<[string, string]> = [
        ["texPlayer", playSet.player],
        ["texGem", playSet.gem],
        ["texPower", playSet.power],
        ["texBoss", playSet.boss],
        ["texPlat", platSet.platformShort],
        ["texPlatHi", platSet.platformLong],
        ["texGround", platSet.ground],
        ["texSpike", platSet.spike],
        ["texFlag", platSet.flag],
        ["texSpring", platSet.spring],
      ];
      for (const [alias, src] of aliasMap) {
        if (this.textures.exists(alias)) this.textures.remove(alias);
        const img = this.textures.get(src).getSourceImage();
        if (img instanceof HTMLImageElement) this.textures.addImage(alias, img);
        else if (img instanceof HTMLCanvasElement) this.textures.addCanvas(alias, img);
      }
      // Override procedural with SVG/PNG sprites where available (SVG > PNG > procedural)
      applySpritesOverAliasMap(this, ["texPlayer", "texGem", "texPower", "texBoss"]);
    }

    const hadPlayerSprite = !blockyWorld && (this.textures.exists("texPlayer_svg") || this.textures.exists("texPlayer_png"));

    this.platforms = this.physics.add.staticGroup();
    this.spikes = this.physics.add.staticGroup();
    this.gems = this.physics.add.group();
    this.powerups = this.physics.add.group();
    this.eliteHazards = this.physics.add.group();
    this.sentryHazards = this.physics.add.group();
    this.movingPlatforms = this.physics.add.group();
    this.checkpoints = this.physics.add.staticGroup();
    this.movingPlatConfigs = [];

    this.spawnX = 140;
    this.spawnY = viewH - 200;
    this.lastCheckpointX = this.spawnX;
    this.lastCheckpointY = this.spawnY;

    this.buildLevel(viewH);

    this.player = this.physics.add.image(140, viewH - 200, "texPlayer");
    if (hadPlayerSprite) fitSpriteDisplay(this.player, 44);
    this.player.setCollideWorldBounds(true);
    this.player.body.setSize(28, 36);
    this.player.setDepth(10);

    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.player, this.movingPlatforms);

    this.physics.add.overlap(this.player, this.gems, (_p, g) => {
      if (this.finished) return;
      const gem = g as Phaser.Physics.Arcade.Image;
      const gx = gem.x;
      const gy = gem.y;
      const gemValue = (gem.getData("gemValue") as number | undefined) ?? 1;
      gem.destroy();
      this.fxCollect(gx, gy);
      this.score += gemValue * this.scoreMult;
      if (this.time.now < this.goalShiftUntil) {
        this.goalShiftHave += 1;
        if (!this.goalShiftSucceeded && this.goalShiftHave >= this.goalShiftNeed) {
          this.goalShiftSucceeded = true;
          const bonus = Math.max(4, Math.floor(6 + this.eventStrength * 8));
          this.score += bonus;
          this.shieldCharges = Math.max(this.shieldCharges, 1);
          this.dashUntil = Math.max(this.dashUntil, this.time.now + 900);
          this.hud.flashBanner({ ...bannerPlatformerGoalSuccess(this.uiLocale, bonus), ms: 1800 });
        }
      }
      this.refreshHud();
      if (!this.treasureHeist && this.score >= this.winScore) {
        this.finish({ score: this.score, won: true });
      }
    });

    if (this.treasureHeist) {
      this.setupTreasureHeist(viewH);
    }

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

    this.physics.add.overlap(this.player, this.checkpoints, (_p, cp) => {
      const flag = cp as Phaser.Physics.Arcade.Image;
      if (flag.getData("activated")) return;
      flag.setData("activated", true);
      flag.setTint(0x4ade80); // green when activated
      this.lastCheckpointX = flag.x;
      this.lastCheckpointY = flag.y - 60;
      this.hud.flashBanner({ title: bannerCheckpointSaved(this.uiLocale), ms: 1200 });
      playBleep("pickup");
    });

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyA = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyW = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyS = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyShift = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

    this.hud = new HudFrame(this, { title: this.spec.title }, guidance, ui);

    this.shieldRing = this.add.graphics();
    this.shieldRing.setDepth(120);
    this.shieldRing.setScrollFactor(0);

    this.powerupTimer = this.time.addEvent({
      delay: Math.max(1800, Math.floor(5200 - this.intensity * 2200)),
      loop: true,
      callback: () => this.spawnPowerup(),
    });

    this.cameras.main.setBounds(0, 0, this.worldW, viewH);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.08);
    this.cameras.main.setDeadzone(140, 80);

    this.refreshHud();

    this.cameras.main.setScroll(Math.max(0, this.player.x - viewW / 2), 0);
    setPhaserQaState({ playerX: Math.round(this.player.x) });
    schedulePhaserPlayReady(this, 350, { playerX: Math.round(this.player.x) });

    this.setupMobileControls();

    showControlsHint(this, platformerControlLines(this.uiLocale));
  }

  private setupMobileControls() {
    const isMobile = typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
    const { width, height } = this.scale;

    // Desktop: any tap anywhere still queues a jump via the buffer
    this.input.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
      if (this.finished) return;
      // On mobile, only trigger jump if tap is in the right 45% of screen
      if (isMobile && ptr.x < width * 0.55) return;
      this.jumpBufferUntil = this.time.now + 110;
    });

    if (!isMobile) return;

    // Draw a visible jump button bottom-right
    const btnR = 34;
    const btnX = width - btnR - 20;
    const btnY = height - btnR - 28;

    const gfx = this.add.graphics().setScrollFactor(0).setDepth(290);
    this.mobileJumpBtnGfx = gfx;

    const redrawBtn = (pressed: boolean) => {
      gfx.clear();
      gfx.fillStyle(pressed ? 0xffffff : 0x000000, pressed ? 0.55 : 0.35);
      gfx.fillCircle(btnX, btnY, btnR);
      gfx.lineStyle(2.5, 0xffffff, 0.7);
      gfx.strokeCircle(btnX, btnY, btnR);
      // Arrow up symbol
      gfx.fillStyle(0xffffff, 0.9);
      const ax = btnX, ay = btnY - 10, aw = 16;
      gfx.fillTriangle(ax, ay - 10, ax - aw / 2, ay + 4, ax + aw / 2, ay + 4);
      gfx.fillRect(ax - 5, ay + 4, 10, 10);
    };
    redrawBtn(false);

    const zone = this.add
      .zone(btnX, btnY, btnR * 2 + 20, btnR * 2 + 20)
      .setScrollFactor(0)
      .setDepth(291)
      .setInteractive({ useHandCursor: false });
    this.mobileJumpZone = zone;

    zone.on("pointerdown", () => {
      if (this.finished) return;
      redrawBtn(true);
      this.jumpBufferUntil = this.time.now + 110;
    });
    zone.on("pointerup", () => redrawBtn(false));
    zone.on("pointerout", () => redrawBtn(false));
  }

  private buildLevel(viewH: number) {
    const seed = runtimeSeedFromSpec(this.spec);
    const groundY = viewH - 36;
    const pad = this.spec.gameplay.arenaPadding ?? 36;
    const acts = this.spec.director?.acts ?? [];
    const totalLayers = this.spec.platformer?.levelLayers ?? 56;
    const levelStyle = this.spec.platformer?.levelStyle ?? "challenge";
    // 风格参数覆写
    const styleExplore = levelStyle === "explore";
    const styleSpeedrun = levelStyle === "speedrun";

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

        // Checkpoint flag at act boundary (skip first act — spawn is already there)
        if (actIdx > 0) {
          const cpX = x + stageWidth / 2 - 52;
          const cpY = y - 8;
          const cp = this.checkpoints.create(cpX, cpY, "texFlag") as Phaser.Physics.Arcade.Image;
          cp.setDisplaySize(22, 36);
          cp.setDepth(9);
          cp.setTint(0xfbbf24); // yellow until activated
          cp.refreshBody();
          // Idle bob animation
          this.tweens.add({ targets: cp, y: cpY - 5, duration: 650, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
        }

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
      // levelStyle 覆写平台宽度：explore→更宽、speedrun→适中长条、challenge→沿用原逻辑
      const platW = Math.floor(
        isPrecisionAct
          ? (styleExplore ? 90 + rw * 80 : 68 + rw * 64)
          : isGapAct
            ? (styleExplore ? 110 + rw * 90 : styleSpeedrun ? 100 + rw * 60 : 82 + rw * 78)
            : isFinaleAct
              ? 88 + rw * 86
              : styleExplore
                ? 110 + rw * 140
                : styleSpeedrun
                  ? 100 + rw * 100
                  : 78 + rw * 112,
      );

      // Moving platforms: ~22% of gap/precision act platforms move
      const movRoll = rnd(seed, layer * 17 + 8);
      const makeMoving = (isGapAct || isPrecisionAct) && movRoll < 0.22 && platW < 130;

      let plat: Phaser.Physics.Arcade.Image;
      if (makeMoving) {
        const movSpr = this.movingPlatforms.create(
          x + platW / 2, y,
          "texPlatHi",
        ) as Phaser.Physics.Arcade.Image;
        movSpr.setDisplaySize(platW, 22);
        movSpr.setTint(0x7dd3fc); // cyan tint — signals "this platform moves"
        const mb = movSpr.body as Phaser.Physics.Arcade.Body;
        mb.setImmovable(true);
        mb.setAllowGravity(false);
        mb.setSize(platW, 22);
        const ampX = isGapAct ? 52 + rnd(seed, layer) * 48 : 0;
        const ampY = isPrecisionAct ? 26 + rnd(seed, layer) * 30 : 0;
        const freq = 0.55 + rnd(seed, layer * 3 + 7) * 0.75;
        const phase = rnd(seed, layer * 5 + 13) * Math.PI * 2;
        this.movingPlatConfigs.push({
          spr: movSpr,
          baseX: x + platW / 2,
          baseY: y,
          ampX,
          ampY,
          freq,
          phase,
        });
        plat = movSpr;
      } else {
        const staticPlat = this.platforms.create(x + platW / 2, y, rnd(seed, layer) > 0.55 ? "texPlatHi" : "texPlat") as Phaser.Physics.Arcade.Image;
        staticPlat.setDisplaySize(platW, 22);
        staticPlat.refreshBody();
        plat = staticPlat;
      }

      const gemRoll = rnd(seed, layer * 7 + 1);
      // explore→ gem 更多；speedrun→ gem 更少（追速度感）
      const gemThreshold = styleExplore
        ? (isPrecisionAct ? 0.1 : 0.06)
        : styleSpeedrun
          ? (isPrecisionAct ? 0.45 : 0.35)
          : isPrecisionAct ? 0.28 : isGapAct ? 0.2 : 0.16;
      if (!makeMoving && gemRoll > gemThreshold) {
        const gem = this.gems.create(x + platW / 2, y - 36, "texGem");
        gem.setDepth(8);
        const isBonusGem = rnd(seed, layer * 7 + 33) > 0.88; // ~12% chance gold bonus gem
        if (isBonusGem) {
          gem.setScale(1.22);
          gem.setTint(0xfcd34d);
          gem.setData("gemValue", 3);
        }
        const gb = gem.body as Phaser.Physics.Arcade.Body | null;
        if (gb) gb.setAllowGravity(false);
      }

      const spikeRoll = rnd(seed, layer * 11 + 2);
      // explore→ spike 少；challenge/speedrun→ 按原逻辑
      const spikeThreshold = styleExplore
        ? (isSpikeAct ? 0.62 : 0.88)
        : isSpikeAct ? 0.46 : isPrecisionAct ? 0.58 : 0.72;
      if (!makeMoving && spikeRoll > spikeThreshold && platW > (isPrecisionAct ? 82 : 95)) {
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

      // levelStyle 影响水平间距和垂直落差
      // explore: 水平间距大，垂直落差小（宽场景）；speedrun: 水平密，垂直小（直线流）
      const stepX = styleExplore
        ? (isGapAct ? 148 : 116) + rnd(seed, layer * 5 + 4) * (isGapAct ? 130 : 100)
        : styleSpeedrun
          ? (isGapAct ? 100 : 78) + rnd(seed, layer * 5 + 4) * (isGapAct ? 80 : 60)
          : (isGapAct ? 124 : isPrecisionAct ? 88 : isFinaleAct ? 118 : 96) +
            rnd(seed, layer * 5 + 4) * (isGapAct ? 110 : isPrecisionAct ? 68 : 88);
      const stepY = styleExplore
        ? (-36) + rnd(seed, layer * 6 + 5) * 90  // 小垂直落差，更平坦
        : styleSpeedrun
          ? (-24) + rnd(seed, layer * 6 + 5) * 72 // 更平，速度感
          : (isPrecisionAct ? -62 : -48) +
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
    flagGem.setScale(1.45);
    flagGem.setTint(0xffd700);
    flagGem.setData("gemValue", 5);
    const fb = flagGem.body as Phaser.Physics.Arcade.Body | null;
    if (fb) fb.setAllowGravity(false);
    // Flag gem pulse animation
    this.tweens.add({
      targets: flagGem,
      scaleX: { from: 1.45, to: 1.72 },
      scaleY: { from: 1.45, to: 1.72 },
      alpha: { from: 1, to: 0.65 },
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
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
    if (this.laserSentries) {
      sentry.setData("laserOriginX", x);
      sentry.setData("laserOriginY", y);
      sentry.setData("laserRange", patrolRange);
    }
  }

  private setupTreasureHeist(viewH: number) {
    const groundY = viewH - 36;
    const tx = this.worldW - 120;
    const ty = groundY - 210;
    this.treasureSprite = this.physics.add.image(tx, ty, "texGem");
    this.treasureSprite.setDepth(14).setScale(1.35).setTint(0xfbbf24);
    const tb = this.treasureSprite.body as Phaser.Physics.Arcade.Body | null;
    if (tb) tb.setAllowGravity(false);
    this.treasureGlow = this.add.circle(tx, ty, 42, 0xfbbf24, 0).setDepth(13);
    this.tweens.add({
      targets: this.treasureGlow,
      alpha: { from: 0.12, to: 0.38 },
      scale: { from: 0.9, to: 1.15 },
      yoyo: true,
      repeat: -1,
      duration: 800,
    });
    this.tweens.add({
      targets: this.treasureSprite,
      y: ty - 8,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    this.physics.add.overlap(this.player, this.treasureSprite, () => {
      if (this.finished) return;
      this.finish({ score: this.score + 50, won: true });
    });
    this.hud.setBottomHint(
      this.uiLocale === "zh-Hans"
        ? "Shift 摆荡 · 偷取金色目标 · 避开激光"
        : "Shift swing · Steal the gold · Avoid lasers",
    );
  }

  private drawLaserSentries() {
    if (!this.laserSentries) return;
    this.laserGfx.clear();
    this.laserPulse = 0.5 + Math.sin(this.time.now * 0.008) * 0.5;
    const children = this.sentryHazards.getChildren();
    for (let i = 0; i < children.length; i += 1) {
      const s = children[i] as Phaser.Physics.Arcade.Image;
      if (!s?.active) continue;
      const ox = (s.getData("laserOriginX") as number) ?? s.x;
      const oy = (s.getData("laserOriginY") as number) ?? s.y;
      const range = (s.getData("laserRange") as number) ?? 60;
      const ex = ox + range * (s.x >= ox ? 1 : -1);
      drawStealthLaserBeam(this.laserGfx, ox, oy, ex, oy + 120, this.laserPulse);
    }
  }

  /** 激光束命中（不仅是 sentry 本体碰撞） */
  private checkLaserBeamHits() {
    if (!this.laserSentries || this.finished || this.laserHitCd > 0) return;
    const px = this.player.x;
    const py = this.player.y;
    for (const child of this.sentryHazards.getChildren()) {
      const s = child as Phaser.Physics.Arcade.Image;
      if (!s?.active) continue;
      const ox = (s.getData("laserOriginX") as number) ?? s.x;
      const oy = (s.getData("laserOriginY") as number) ?? s.y;
      const range = (s.getData("laserRange") as number) ?? 60;
      const ex = ox + range * (s.x >= ox ? 1 : -1);
      if (Math.abs(px - ex) < 16 && py >= oy - 8 && py <= oy + 128) {
        this.laserHitCd = 700;
        this.onHitHazard();
        return;
      }
    }
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
    const right = this.time.now < this.goalShiftUntil
      ? hudPlatformerTarget(this.uiLocale, this.goalShiftHave, this.goalShiftNeed)
      : hudPlatformerCollect(this.uiLocale, Math.min(this.score, this.winScore), this.winScore);
    const acts = this.spec.director?.acts ?? null;
    const label = acts?.[this.actIndex]?.label;
    const cdLeft = Math.max(0, this.skillReadyAt - this.time.now);
    const skillName = this.stealthMode && this.grappleEnabled
      ? (this.uiLocale === "zh-Hans" ? "弹性摆荡" : "Elastic swing")
      : (this.spec.systems?.skill?.name ?? hudDefaultSkill(this.uiLocale));
    const cdStr = cdLeft <= 0 ? hudReady(this.uiLocale) : hudCooldown(this.uiLocale, (cdLeft / 1000).toFixed(1));
    this.hud.update({
      score: this.score,
      lives: this.lives,
      right,
      actLabel: label ? hudActChapter(this.uiLocale, label) : "",
      skill: `Shift · ${skillName} · ${cdStr}`,
    });
    this.drawShieldRing();
  }

  private onHitHazard() {
    if (this.finished) return;
    if (this.time.now < this.invulnUntil) return;
    if (this.grappleActive && this.stealthMode) return;
    if (this.shieldCharges > 0) {
      this.shieldCharges -= 1;
      this.fxShield();
      this.refreshHud();
      return;
    }
    this.fxDamage();
    this.lives -= 1;
    this.refreshHud();
    this.invulnUntil = this.time.now + 1400;
    if (this.lives <= 0) {
      this.finish({ score: this.score, won: false });
      return;
    }
    // Respawn at last checkpoint
    this.respawnAtCheckpoint();
    const maxLives = this.spec.gameplay.lives ?? 3;
    this.soundscape?.setTension(1 - (this.lives - 1) / Math.max(1, maxLives - 1));
    if (this.lives === 1) {
      this.soundscape?.triggerEvent("danger");
      this.startDangerVignette();
    }
  }

  private respawnAtCheckpoint() {
    this.player.setPosition(this.lastCheckpointX, this.lastCheckpointY);
    this.player.setVelocity(0, 0);
    this.player.setAlpha(0.3);
    this.grappleActive = false;
    this.doubleJumpUsed = false;
    this.time.delayedCall(300, () => this.player.setAlpha(1));
  }

  private fxCollect(x: number, y: number) {
    juicePickup(this, {
      x,
      y,
      colorHex: themeParticleHex(this.spec),
      text: "+1",
      textColorCss: this.cohesive.hud.body,
    });
    playBleep("pickup");
    this.soundscape?.triggerKillStinger();
  }

  private fxDamage() {
    const dying = this.lives <= 1;
    juiceHit(this, {
      x: this.player?.x ?? this.scale.width / 2,
      y: this.player?.y ?? this.scale.height / 2,
      colorHex: this.spec.theme.hazardColor,
      large: dying,
    });
    playBleep("hit");
    this.hurtFlashUntil = this.time.now + 260;
    this.cameras.main.shake(dying ? 280 : 180, dying ? 0.012 : 0.006);
    spawnDamageNumber(this, this.player.x, this.player.y, 1, {
      color: dying ? "#ff1111" : "#ff6644",
      large: dying,
    });
  }

  private fxShield() {
    juicePickup(this, {
      x: this.player?.x ?? this.scale.width / 2,
      y: this.player?.y ?? this.scale.height / 2,
      colorHex: this.cohesive.hud.accent2,
      text: this.spec.systems?.skill?.name ?? "shield",
      textColorCss: this.cohesive.hud.accent,
    });
    playBleep("pickup");
  }

  private startDangerVignette() {
    this.hud.update({ dangerLevel: 1 });
  }

  private finish(payload: EndPayload) {
    if (this.finished) return;
    this.hud.update({ dangerLevel: 0 });
    this.finished = true;
    this.physics.pause();
    this.hud.setBottomHint(platformerFinishText(this.uiLocale, payload.won));
    if (payload.won) {
      this.cameras.main.shake(300, 0.008);
      juiceWin(this, {
        x: this.player.x,
        y: this.player.y,
        colorHex: themeParticleHex(this.spec),
        text: this.uiLocale === "zh-Hans" ? "胜利" : "Win",
        textColorCss: this.cohesive.hud.accent,
      });
      playBleep("win");
      this.soundscape?.triggerEvent("victory");
    } else {
      juiceFail(this, {
        x: this.player.x,
        y: this.player.y,
        colorHex: this.spec.theme.hazardColor,
        text: this.uiLocale === "zh-Hans" ? "失败" : "Fail",
        textColorCss: this.cohesive.hud.danger,
      });
    }
    this.onEnd(payload);
  }

  private updateGrapple(body: Phaser.Physics.Arcade.Body) {
    const wantGrapple = this.keyShift.isDown && !body.blocked.down;
    if (wantGrapple) {
      if (!this.grappleActive) {
        this.grappleActive = true;
        playBleep("pickup");
      }
      const cam = this.cameras.main;
      const wx = cam.scrollX + this.input.activePointer.x;
      const wy = cam.scrollY + this.input.activePointer.y;
      const dx = wx - this.player.x;
      const dy = wy - this.player.y;
      const dist = Math.hypot(dx, dy) || 1;
      const maxLen = 260;
      const ax = dist > maxLen ? this.player.x + (dx / dist) * maxLen : wx;
      const ay = dist > maxLen ? this.player.y + (dy / dist) * maxLen : wy;
      const pull = this.grapplePull;
      this.player.setVelocityX(body.velocity.x + (ax - this.player.x) * pull);
      this.player.setVelocityY(body.velocity.y + (ay - this.player.y) * pull * 1.15);
      this.player.setAlpha(0.55);
      this.grappleGfx.clear();
      this.grappleGfx.lineStyle(3, 0xfde047, 0.85);
      this.grappleGfx.lineBetween(this.player.x, this.player.y, ax, ay);
      this.grappleGfx.fillStyle(0xfde047, 1);
      this.grappleGfx.fillCircle(ax, ay, 5);
      return;
    }
    if (this.grappleActive) {
      this.grappleActive = false;
      this.player.setAlpha(1);
    }
    this.grappleGfx.clear();
  }

  update() {
    this.hud.update({});
    if (this.finished) return;
    const speed = this.spec.gameplay.playerSpeed;
    const body = this.player.body as Phaser.Physics.Arcade.Body;

    this.updateAct();
    this.tickDirectorEvents();
    this.tickEventLoops();
    this.updateMovingPlatforms();

    if (Phaser.Input.Keyboard.JustDown(this.keyShift) && !(this.stealthMode && this.grappleEnabled)) {
      this.tryCastSkill();
    }

    const slowOn = this.time.now < this.slowUntil;
    const wanted = slowOn ? 0.78 : 1;
    if (wanted !== this.lastWorldTimeScale) {
      this.lastWorldTimeScale = wanted;
      this.physics.world.timeScale = wanted;
      this.time.timeScale = slowOn ? 0.92 : 1;
    }

    setPhaserQaState({ playerX: Math.round(this.player.x) });

    const dashOn = this.time.now < this.dashUntil;

    const keys = {
      cursors: this.cursors,
      w: this.keyW,
      a: this.keyA,
      s: this.keyS,
      d: this.keyD,
      space: this.keySpace,
      shift: this.keyShift,
    };
    const axis = readMoveAxis(keys, { allowVertical: false });
    const ptr = pointerSteerX(this, this.player.x);
    const vx = (axis.x !== 0 ? axis.x : ptr) * speed * (dashOn ? 1.22 : 1);
    this.player.setVelocityX(vx);
    if (this.stealthMode && vx !== 0) {
      juiceBurst(this, this.player.x, this.player.y + 16, "#38bdf8", 8);
      juiceFlash(this, { r: 56, g: 189, b: 248 }, { durationMs: 60 });
    }

    const jumpPressed =
      Phaser.Input.Keyboard.JustDown(this.keySpace) ||
      Phaser.Input.Keyboard.JustDown(this.keyW) ||
      Phaser.Input.Keyboard.JustDown(this.cursors.up);

    const now2 = this.time.now;
    const grounded2 = body.blocked.down;

    // Coyote time：落地时刷新，离地后 120ms 内仍视为可跳
    if (grounded2) {
      this.coyoteUntil = now2 + 120;
      this.doubleJumpUsed = false;
    }

    // Jump buffer：提前 110ms 预输入，落地时自动触发
    if (jumpPressed) this.jumpBufferUntil = now2 + 110;

    const canCoyoteJump = now2 < this.coyoteUntil && !grounded2;
    const bufferedJump = now2 < this.jumpBufferUntil;

    if ((grounded2 || canCoyoteJump) && bufferedJump) {
      this.player.setVelocityY(-this.jumpVel);
      this.coyoteUntil = 0;      // 消耗 coyote 机会
      this.jumpBufferUntil = 0;  // 消耗 buffer
      this.doubleJumpUsed = false;
    } else if (jumpPressed && this.doubleJumpAllowed && !this.doubleJumpUsed && !grounded2 && !canCoyoteJump) {
      this.doubleJumpUsed = true;
      this.jumpBufferUntil = 0;
      this.player.setVelocityY(-this.jumpVel * 0.82);
      juiceBurst(this, this.player.x, this.player.y + 18, themeParticleHex(this.spec), 8);
      playBleep("pickup");
    } else if ((this.keyS.isDown || this.cursors.down.isDown) && !grounded2) {
      this.player.setVelocityY(Math.max(body.velocity.y, 420));
    }

    if (this.grappleEnabled) {
      this.updateGrapple(body);
    }

    this.drawLaserSentries();
    this.checkLaserBeamHits();
    if (this.laserHitCd > 0) {
      this.laserHitCd = Math.max(0, this.laserHitCd - this.game.loop.delta);
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

    if (this.player.y > this.scale.height + 120 && this.time.now >= this.invulnUntil) {
      if (this.lives <= 1) {
        this.lives = 0;
        this.finish({ score: this.score, won: false });
      } else {
        this.lives -= 1;
        this.refreshHud();
        this.invulnUntil = this.time.now + 1400;
        this.fxDamage();
        this.respawnAtCheckpoint();
        if (this.lives === 1) {
          this.soundscape?.triggerEvent("danger");
          this.startDangerVignette();
        }
      }
    }

    // Player trail recording
    const dashOn2 = this.time.now < this.dashUntil;
    if (this.player?.active && (dashOn2 || Math.abs(vx) > 110)) {
      this.playerTrail.push({ x: this.player.x, y: this.player.y, t: this.time.now });
      if (this.playerTrail.length > 7) this.playerTrail.shift();
    } else if (this.playerTrail.length > 0) {
      this.playerTrail.shift();
    }

    this.updatePlayerAnim(body, vx);
  }

  private updatePlayerAnim(body: Phaser.Physics.Arcade.Body, vx: number) {
    const now = this.time.now;
    const grounded = body.blocked.down;

    // Player movement trail
    const g = this.trailGfx;
    g.clear();
    if (this.playerTrail.length > 1) {
      const dashOn3 = now < this.dashUntil;
      const trailColor = dashOn3 ? 0xa78bfa : 0x38bdf8;
      for (let i = 0; i < this.playerTrail.length - 1; i++) {
        const pt = this.playerTrail[i]!;
        const age = (now - pt.t) / 220;
        const alpha = Math.max(0, (1 - age) * 0.20 * (i / this.playerTrail.length));
        if (alpha <= 0) continue;
        g.fillStyle(trailColor, alpha);
        const sz = 10 + i * 1.2;
        g.fillCircle(pt.x, pt.y, sz);
      }
    }

    // Flip to face movement direction
    if (vx > 6) this.player.setFlipX(false);
    else if (vx < -6) this.player.setFlipX(true);

    // Squash on landing, stretch on jumping
    if (grounded && !this.wasGrounded) {
      // Just landed — squash
      this.tweens.add({
        targets: this.player,
        scaleX: 1.28,
        scaleY: 0.72,
        duration: 60,
        yoyo: true,
        ease: "Sine.easeOut",
        onComplete: () => { this.player.setScale(1); },
      });
    } else if (!grounded && this.wasGrounded) {
      // Just left ground — stretch
      this.tweens.add({
        targets: this.player,
        scaleX: 0.82,
        scaleY: 1.22,
        duration: 80,
        yoyo: true,
        ease: "Sine.easeOut",
        onComplete: () => { this.player.setScale(1); },
      });
    }
    this.wasGrounded = grounded;

    // Hurt tint flash: starts white, fades to red-orange then clears
    if (now < this.hurtFlashUntil) {
      const t = (this.hurtFlashUntil - now) / 260; // 1→0
      const g = Math.round(255 * Math.max(0, t - 0.35));
      this.player.setTint(Phaser.Display.Color.GetColor(255, g, g));
    } else {
      this.player.clearTint();
    }

    // Running bob: slight vertical oscillation when grounded and moving
    if (grounded && Math.abs(vx) > 20) {
      const bob = Math.sin(now * 0.018) * 1.5;
      this.player.setY(this.player.y + bob * (this.game.loop.delta / 16.67));
    }
  }

  private updateMovingPlatforms() {
    if (this.movingPlatConfigs.length === 0) return;
    const tSec = this.time.now / 1000;
    const dt = Math.max(0.008, this.game.loop.delta / 1000);
    for (const mp of this.movingPlatConfigs) {
      if (!mp.spr?.active) continue;
      const nx = mp.baseX + Math.sin(tSec * mp.freq + mp.phase) * mp.ampX;
      const ny = mp.baseY + Math.sin(tSec * mp.freq * 0.8 + mp.phase + 1.57) * mp.ampY;
      const vx = Phaser.Math.Clamp((nx - mp.spr.x) / dt, -480, 480);
      const vy = Phaser.Math.Clamp((ny - mp.spr.y) / dt, -360, 360);
      (mp.spr.body as Phaser.Physics.Arcade.Body).setVelocity(vx, vy);
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
        this.hud.flashBanner({ ...bannerPlatformerGoalMiss(this.uiLocale), ms: 1600 });
      } else {
        this.hud.flashBanner({ ...bannerEventEnd(this.uiLocale, "platformer"), ms: 1400 });
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
    const title = gameEventTitle(this.uiLocale, ev.type, this.spec.templateId);
    const message = ev.message ?? "";

    this.eventType = ev.type;
    this.eventStrength = strength;
    this.eventUntil = now + durationMs;

    this.hud.flashBanner({ title, message, ms: Math.min(2600, Math.max(1200, durationMs - 200)) });
    applyRuntimeEventImpact(this, ev.type, {
      x: this.player?.x ?? this.scale.width / 2,
      y: this.player?.y ?? this.scale.height / 2,
      title,
      spec: this.spec,
      cohesive: this.cohesive,
      strength,
    });

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
      juiceBoss(this, {
        x: this.player.x,
        y: this.player.y,
        colorHex: this.spec.theme.hazardColor,
        text: title,
        textColorCss: this.cohesive.hud.danger,
      });
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
      const mod = mods.includes("precision")
        ? "precision"
        : mods.includes("gaps")
          ? "gaps"
          : mods.includes("spikes")
            ? "spikes"
            : mods.includes("finale")
              ? "finale"
              : "default";
      const stageMessage = platformerStageMessage(this.uiLocale, mod);
      this.hud.flashBanner({ ...bannerActStage(this.uiLocale, acts[idx]?.label, stageMessage), ms: 1400 });
      juicePickup(this, {
        x: this.player.x,
        y: this.player.y - 18,
        colorHex: this.cohesive.hud.accent2,
        text: acts[idx]?.label ?? stageMessage,
        textColorCss: this.cohesive.hud.accent,
      });
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
    applySystemImpact(this, "powerup", {
      effect: kind,
      label: kind,
      x: this.player?.x ?? this.scale.width / 2,
      y: this.player?.y ?? this.scale.height / 2,
      spec: this.spec,
      cohesive: this.cohesive,
    });
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
    applySystemImpact(this, "skill", {
      effect: skill.effect,
      label: skill.name,
      x: this.player?.x ?? this.scale.width / 2,
      y: this.player?.y ?? this.scale.height / 2,
      spec: this.spec,
      cohesive: this.cohesive,
    });

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
      juiceBoss(this, {
        x: hx,
        y: hy,
        colorHex: themeParticleHex(this.spec),
        text: skill.name,
        textColorCss: this.cohesive.hud.accent,
      });
      playBleep("hit");
      this.refreshHud();
      return;
    }

    if (skill.effect === "dash") {
      this.dashUntil = this.time.now + 1100;
      this.invulnUntil = Math.max(this.invulnUntil, this.time.now + 520);
      juicePickup(this, {
        x: this.player.x,
        y: this.player.y,
        colorHex: this.cohesive.hud.accent,
        text: skill.name,
        textColorCss: this.cohesive.hud.accent,
      });
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
