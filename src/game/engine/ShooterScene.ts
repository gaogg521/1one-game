import Phaser from "phaser";
import { playBleep } from "@/game/audio/webBleeps";
import { pointerSteerX, readMoveAxis } from "@/game/engine/phaser-input";
import { HudFrame } from "@/game/engine/HudFrame";
import type { GameSpec } from "@/lib/game-spec";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { AppLocale } from "@/i18n/routing";
import { gameEventTitle, shooterWaveBanner } from "@/lib/i18n/game-event-labels";
import {
  hudLives,
  hudScore,
  hudShooterKills,
  hudShooterWave,
  hudDefaultSkill,
  shooterFinishText,
  shooterSkillStatus,
  shooterShiftReady,
  shooterShiftCooldown,
} from "@/lib/i18n/game-hud-labels";
import { tMessage } from "@/lib/i18n/messages";
import type { RuntimeReferencePayload } from "@/game/engine/runtime-reference-payload";
import { classifyReferencePayloads } from "@/lib/reference-classify";
import { resolveAssetStyle, type CohesivePresentation } from "@/lib/cohesive-presentation";
import {
  juiceBoss,
  juiceFail,
  juiceHit,
  juicePickup,
  juiceShake,
  juiceWin,
  themeParticleHex,
} from "@/game/engine/gameJuice";
import { buildSceneCohesion } from "@/lib/scene-experience";
import { paintOrbitPlanetRich, paintSniperScopeOverlay } from "@/game/engine/action-visual";
import { bumpQaTouch, setPhaserQaState } from "@/game/engine/phaser-qa-state";
import {
  applySpritesOverAliasMap,
  assetBackgroundAlpha,
  fitSpriteDisplay,
  firstExistingTexture,
  preloadSpriteSet,
} from "@/game/engine/phaser-loaded-sprites";
import { schedulePhaserPlayReady } from "@/game/engine/phaser-play-ready";
import { runtimeSeedFromSpec, seededFloatBetween, seededIntBetween, seededRandom } from "@/lib/runtime-seed";
import { inferThemeMood } from "@/game/engine/template-theme-visual";
import { buildSceneGoalGuidance } from "@/lib/scene-goal-guidance";
import { applyRuntimeEventImpact } from "@/game/engine/runtimeEventImpact";
import { applySystemImpact } from "@/game/engine/systemImpact";
import { translateDirectorEvent } from "@/game/engine/director-translator";
import {
  buildShooterAssetSet,
  buildShooterStarfieldTexture,
  type ShooterAssetSet,
} from "@/game/engine/shooter-assets";
import {
  BossController,
  advanceWeaponTree,
  applyEnemyMotion,
  emitEnemyBulletsByPattern,
  emitPlayerBulletsByWeapon,
  fallbackShooterBlueprint,
  spawnFormationFromPattern,
  type SpawnEnemyParams,
} from "@/game/engine/shooter-runtime";
import type { ShooterBlueprint, ShooterBulletPattern, ShooterWave } from "@/lib/shooter-blueprint";
import { showControlsHint, shooterControlLines } from "@/game/engine/controls-hint";
import { spawnDamageNumber } from "@/game/engine/damage-number";

type EndPayload = { score: number; won: boolean };
type DirectorEvent = NonNullable<NonNullable<GameSpec["director"]>["events"]>[number];

const WEAPON_LABEL: Record<string, string> = {
  single: "单发",
  "spread-3": "散弹×3",
  "spread-5": "散弹×5",
  "fan-7": "扇形×7",
  spiral: "螺旋",
  ring: "圆环",
  shotgun: "霰弹",
  "aimed-volley": "齐射",
  "laser-beam": "激光",
};

function isSpaceShooterSpec(spec: GameSpec): boolean {
  const blob = [
    spec.title,
    spec.labels?.subtitle ?? "",
    spec.labels?.player ?? "",
    spec.labels?.hazard ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return /星|舰|太空|space|star|war|星际|galaxy|fleet/.test(blob);
}

/** 俯视角射击场景：玩家在底部消灭从上方降落的敌舰，敌人会反击。 */
export class ShooterScene extends Phaser.Scene {
  public backgroundUrl: string | null = null;
  public projectId: string | null = null;
  public uiLocale: AppLocale = "zh-Hans";

  private readonly spec: GameSpec;
  private readonly onEnd: (r: EndPayload) => void;
  private readonly soundscape: GameSoundscape | null;

  private player!: Phaser.Types.Physics.Arcade.ImageWithDynamicBody;
  private playerBullets!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private enemyBullets!: Phaser.Physics.Arcade.Group;
  private powerups!: Phaser.Physics.Arcade.Group;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyShift!: Phaser.Input.Keyboard.Key;

  private score = 0;
  private lives = 3;
  private shotsFired = 0;
  private wave = 0;
  private totalKills = 0;
  private waveEnemiesLeft = 0;
  private waveClearing = false;
  private finished = false;
  private invulnUntil = 0;

  private winScore = 50;
  private intensity = 0.55;
  private actIndex = 0;
  private lastActUpdate = 0;
  private scoreMult = 1;
  private burstUntil = 0;
  private burstCoolUntil = 0;
  private eventIndex = 0;
  private eventUntil = 0;
  private eventType: string | null = null;
  private eventStrength = 0;

  private playerSpeed = 280;
  private bulletSpeed = 520;
  private enemySpeed = 110;
  private enemyShotIntervalMs = 1800;

  private hud!: HudFrame;
  private cohesive!: CohesivePresentation;
  private assets!: ShooterAssetSet;

  // ─── ShooterBlueprint runtime（spec.shooter 数据接通运行时） ─────────
  private blueprint!: ShooterBlueprint;
  /** 当前波索引（指向 blueprint.waves） */
  private bpWaveIndex = -1;
  /** 当前波的弹幕图样 */
  private currentEnemyBullet: ShooterBulletPattern = "single";
  /** 玩家当前武器（从 weaponTree[0] 起步，拾取道具升级） */
  private currentWeapon: ShooterBulletPattern = "single";
  private bossController: BossController | null = null;
  private bossSprite: Phaser.Physics.Arcade.Image | null = null;

  private fireTimer!: Phaser.Time.TimerEvent;
  private enemyFireTimer!: Phaser.Time.TimerEvent;
  private currentFireDelay = 220;
  private currentEnemyFireDelay = 1800;
  private skillReadyAt = 0;
  private shieldUntil = 0;
  private slowUntil = 0;
  private magnetUntil = 0;
  private coinRainUntil = 0;
  private supportWingUntil = 0;
  private readonly runtimePayloads: RuntimeReferencePayload[];
  private playerTextureKey: string | null = null;
  private enemyTextureKey: string | null = null;
  private enemySpriteKey = "texEnemy";
  private bootstrapDone = false;
  private sceneDisposed = false;

  private bossHpBar!: Phaser.GameObjects.Graphics;
  private bossHpBarVisible = false;

  /** 支援翼视觉：两侧翼光 Graphics，supportWingUntil 期间绘制 */
  private wingGfx!: Phaser.GameObjects.Graphics;

  /** 飞船移动拖尾 */
  private shipTrail: Array<{ x: number; y: number; t: number }> = [];
  private shipTrailGfx!: Phaser.GameObjects.Graphics;

  private orbitMode = false;

  private orbitAngle = -Math.PI / 2;

  private orbitSpeed = 0.0018;

  private planetCx = 0;

  private planetCy = 0;

  private planetRx = 0;

  private planetRy = 0;
  private runtimeRng!: () => number;

  constructor(
    spec: GameSpec,
    onEnd: (r: EndPayload) => void,
    runtimePayloads: RuntimeReferencePayload[] = [],
    soundscape?: GameSoundscape,
  ) {
    super("ShooterScene");
    this.spec = spec;
    this.onEnd = onEnd;
    this.runtimePayloads = runtimePayloads;
    this.soundscape = soundscape ?? null;
  }

  preload() {
    if (this.backgroundUrl) {
      this.load.image("bgTex", this.backgroundUrl);
    }
    if (this.projectId) {
      preloadSpriteSet(this, this.projectId);
    }
  }

  create() {
    this.sceneDisposed = false;
    this.sys.events.once("shutdown", () => {
      this.sceneDisposed = true;
    });

    void this.ensureRuntimeTexturesFromPayloads()
      .then(() => {
        if (this.sceneDisposed) return;
        this.time.delayedCall(0, () => this.runBootstrapResume());
      })
      .catch((err) => {
        console.error("ShooterScene: texture preload failed", err);
        if (!this.sceneDisposed) {
          this.time.delayedCall(0, () => this.runBootstrapResume());
        }
      });
  }

  private runBootstrapResume(): void {
    if (this.sceneDisposed || this.bootstrapDone || !this.add) return;
    try {
      this.bootstrapPlay();
    } catch (e) {
      console.error("ShooterScene: bootstrap failed", e);
    }
  }

  private async ensureRuntimeTexturesFromPayloads(): Promise<void> {
    const classified = classifyReferencePayloads(this.runtimePayloads);
    const jobs: Promise<void>[] = [];

    const loadOne = (key: string, dataUrl: string) =>
      new Promise<void>((resolve) => {
        if (!dataUrl.startsWith("data:")) {
          resolve();
          return;
        }
        const img = new Image();
        img.onload = () => {
          try {
            if (this.textures.exists(key)) this.textures.remove(key);
            this.textures.addImage(key, img);
          } catch {
            /* ignore */
          }
          resolve();
        };
        img.onerror = () => resolve();
        img.src = dataUrl;
      });

    if (classified.protagonistOrdinal != null) {
      const p = this.runtimePayloads.find((x) => x.ordinal === classified.protagonistOrdinal);
      if (p?.dataUrl) {
        this.playerTextureKey = "refPlayer";
        jobs.push(loadOne("refPlayer", p.dataUrl));
      }
    }
    const monsterOrd = classified.monsterOrdinals[0];
    if (monsterOrd != null) {
      const p = this.runtimePayloads.find((x) => x.ordinal === monsterOrd);
      if (p?.dataUrl) {
        this.enemyTextureKey = "refEnemy";
        jobs.push(loadOne("refEnemy", p.dataUrl));
      }
    }
    await Promise.all(jobs);
  }

  private bootstrapPlay() {
    if (this.bootstrapDone) return;
    this.bootstrapDone = true;
    this.runtimeRng = seededRandom(runtimeSeedFromSpec(this.spec));
    const { width, height } = this.scale;

    this.playerSpeed = this.spec.gameplay.playerSpeed ?? 280;
    this.bulletSpeed = this.spec.gameplay.jumpStrength ?? 520;
    this.enemySpeed = this.spec.gameplay.hazardSpeed ?? 110;
    this.enemyShotIntervalMs = Math.max(600, this.spec.gameplay.spawnIntervalMs ?? 1800);
    this.winScore = this.spec.gameplay.winScore ?? 50;
    this.lives = this.spec.gameplay.lives ?? 3;
    this.intensity = this.spec.director?.intensity ?? 0.55;

    // 接通 ShooterBlueprint：LLM 输出（含 finalizeSpec 兜底）或回退最简模板
    this.blueprint = this.spec.shooter ?? fallbackShooterBlueprint();
    this.currentWeapon = this.blueprint.startingWeapon;
    this.currentEnemyBullet = this.blueprint.waves[0]?.bullet ?? "single";

    const ui = buildSceneCohesion(this.spec);
    this.cohesive = ui;

    // 高保真程序化资产（按 assetStyle 自动挑皮肤）
    const style = resolveAssetStyle(this.spec);
    const palette = {
      player: this.spec.theme.playerColor,
      hazard: this.spec.theme.hazardColor,
      collectible: this.spec.theme.collectibleColor ?? this.spec.theme.playerColor,
      particle: this.spec.theme.particleTint ?? this.spec.theme.collectibleColor ?? "#a3a3a3",
      background: this.spec.theme.backgroundColor,
    };
    this.assets = buildShooterAssetSet(this, palette, style);
    // 文字 key 别名（向后兼容旧字段名 texPlayer/texEnemy/texElite/texBoss）
    this.enemySpriteKey = this.assets.enemyBasic;

    // 多层星空背景（替代 addStarfield 的 120 个矩形点）
    const sfKey = buildShooterStarfieldTexture(this, palette, width, height);
    this.add.image(width / 2, height / 2, sfKey).setDepth(-12);
    // 保留滚动星点制造视差感
    this.addScrollingStars();
    // 主题化氛围叠加层
    this.addThemedShooterOverlay(width, height);

    // 文生图背景（若存在则叠在程序化星空之上）
    if (this.backgroundUrl && this.textures.exists("bgTex")) {
      this.add
        .image(width / 2, height / 2, "bgTex")
        .setDepth(-10)
        .setAlpha(assetBackgroundAlpha(this.projectId, ui.qualityTier));
    }

    // 若用户上传了角色参考图，仍优先用（覆盖程序化皮肤）
    if (this.playerTextureKey && this.textures.exists(this.playerTextureKey)) {
      this.assets.player = this.playerTextureKey;
    }
    if (this.enemyTextureKey && this.textures.exists(this.enemyTextureKey)) {
      this.assets.enemyBasic = this.enemyTextureKey;
      this.enemySpriteKey = this.enemyTextureKey;
    }
    // SVG (text LLM) > PNG (image gen) > procedural — 优先 SVG 覆盖程序化精灵
    const loadedPlayerKey = firstExistingTexture(this, ["texPlayer_svg", "texPlayer_png", "texPlayer"]);
    if (loadedPlayerKey) this.assets.player = loadedPlayerKey;
    const loadedEnemyKey = firstExistingTexture(this, ["texHazard_svg", "texHazard_png", "texHazard"]);
    if (loadedEnemyKey) {
      this.assets.enemyBasic = loadedEnemyKey;
      this.enemySpriteKey = loadedEnemyKey;
    }

    const guidance = buildSceneGoalGuidance(this.spec, this.uiLocale);

    // 统一 HUD 框架
    this.hud = new HudFrame(this, { title: this.spec.title }, guidance, ui);

    // Boss HP bar — hidden until a boss wave starts
    this.bossHpBar = this.add.graphics();
    this.bossHpBar.setScrollFactor(0);
    this.bossHpBar.setDepth(210);
    this.bossHpBar.setAlpha(0);

    // Wing glow — drawn every frame while supportWingUntil > now
    this.wingGfx = this.add.graphics();
    this.wingGfx.setScrollFactor(0);
    this.wingGfx.setDepth(9);

    this.shipTrailGfx = this.add.graphics().setScrollFactor(0).setDepth(6);

    const shooterPf = this.spec.samplePlayProfile?.shooter;
    if (shooterPf?.sniperScope) {
      paintSniperScopeOverlay(this, width, height);
    }
    if (shooterPf?.orbitChopper) {
      this.orbitMode = true;
      this.hud.setBottomHint(
        this.uiLocale === "zh-Hans" ? "环绕星球 · 左右调速 · 自动斩击" : "Orbit planet · Steer · Auto chop",
      );
    }

    if (this.orbitMode) {
      this.setupOrbitPlanet(width, height);
    }

    // Player ship
    this.player = this.physics.add.image(
      this.orbitMode ? this.planetCx : width / 2,
      this.orbitMode ? this.planetCy - this.planetRy - 36 : height - 64,
      this.assets.player,
    );
    this.player.setCollideWorldBounds(!this.orbitMode);
    this.player.body.setSize(this.orbitMode ? 32 : 38, this.orbitMode ? 32 : 42);
    this.player.setDepth(8);
    fitSpriteDisplay(this.player, this.orbitMode ? 52 : 64);
    if (this.orbitMode) {
      this.syncOrbitPlayerPosition();
    }

    // Bullet groups
    this.playerBullets = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 40,
      runChildUpdate: true,
    });
    this.enemies = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image });
    this.enemyBullets = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 60,
    });
    this.powerups = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 12,
    });

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyA = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyW = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyS = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyShift = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).on("down", () => {
      if (this.finished) return;
      bumpQaTouch();
      this.firePlayerBullet();
    });
    this.input.on("pointerdown", () => {
      if (this.finished || !this.bootstrapDone) return;
      bumpQaTouch();
      this.firePlayerBullet();
    });

    // Collisions
    this.physics.add.overlap(this.playerBullets, this.enemies, (b, e) => {
      this.onBulletHitEnemy(
        b as Phaser.Physics.Arcade.Image,
        e as Phaser.Physics.Arcade.Image,
      );
    });

    this.physics.add.overlap(this.player, this.enemyBullets, (_p, b) => {
      if (this.finished || this.time.now < this.invulnUntil) return;
      (b as Phaser.Physics.Arcade.Image).destroy();
      this.onPlayerHit();
    });

    this.physics.add.overlap(this.player, this.enemies, (_p, e) => {
      if (this.finished || this.time.now < this.invulnUntil) return;
      (e as Phaser.Physics.Arcade.Image).destroy();
      this.waveEnemiesLeft = Math.max(0, this.waveEnemiesLeft - 1);
      this.onPlayerHit();
    });

    // 道具拾取：碰到即触发武器升级
    this.physics.add.overlap(this.player, this.powerups, (_p, pu) => {
      const item = pu as Phaser.Physics.Arcade.Image;
      if (!item.active) return;
      item.destroy();
      juicePickup(this, {
        x: this.player.x,
        y: this.player.y,
        colorHex: this.cohesive.hud.accent2,
        text: this.uiLocale === "zh-Hans" ? "武器+" : "Weapon+",
        textColorCss: this.cohesive.hud.accent,
        rng: this.runtimeRng,
      });
      const next = advanceWeaponTree(this.currentWeapon, this.blueprint.weaponTree);
      if (next !== this.currentWeapon) {
        this.currentWeapon = next;
        this.hud.flashBanner({
          title: this.uiLocale === "zh-Hans" ? "武器升级" : "Weapon up",
          message: next,
          ms: 1200,
        });
        playBleep("levelUp");
      } else {
        playBleep("pickup");
      }
    });

    // Auto-fire timer (recursive so delay can change)
    this.currentFireDelay = Math.max(120, Math.floor(260 - this.intensity * 60));
    if (this.orbitMode) {
      this.currentEnemyFireDelay = 60_000;
    }
    this.schedulePlayerFire();

    // Enemy fire timer (recursive)
    this.currentEnemyFireDelay = Math.max(500, this.enemyShotIntervalMs);
    this.scheduleEnemyFire();

    this.refreshHud();
    this.time.delayedCall(400, () => this.startWave());

    setPhaserQaState({
      qaTouches: 0,
      orbitChopper: this.orbitMode,
      shooterBg: this.spec.theme.backgroundColor,
    });
    schedulePhaserPlayReady(this, 500, {});

    showControlsHint(this, shooterControlLines(this.uiLocale));
  }

  // ─── Recursive fire schedulers ─────────────────────────────────────────────

  private schedulePlayerFire() {
    this.fireTimer = this.time.delayedCall(this.currentFireDelay, () => {
      if (!this.finished) {
        this.firePlayerBullet();
        this.schedulePlayerFire();
      }
    });
  }

  private scheduleEnemyFire() {
    this.enemyFireTimer = this.time.delayedCall(this.currentEnemyFireDelay, () => {
      if (!this.finished) {
        this.fireEnemyBullet();
        this.scheduleEnemyFire();
      }
    });
  }

  // ─── Themed overlay (mood-specific atmosphere above starfield) ──────────────

  private addThemedShooterOverlay(width: number, height: number) {
    const mood = inferThemeMood(this.spec);
    const raw = this.spec.theme.particleTint?.replace("#", "") ?? "69746c";
    const parsed = parseInt(raw, 16);
    const tint = Number.isFinite(parsed) ? parsed : 0x8888aa;

    if (mood === "cyber") {
      // 霓虹网格线叠加（深度 -10，覆盖星空）
      const lineG = this.add.graphics().setDepth(-10);
      lineG.lineStyle(0.5, tint, 0.09);
      for (let y = 0; y < height; y += 20) lineG.lineBetween(0, y, width, y);
      lineG.lineStyle(0.4, tint, 0.06);
      for (let x = 0; x < width; x += 24) lineG.lineBetween(x, 0, x, height);
      // 霓虹节点
      for (let i = 0; i < 40; i += 1) {
        const nx = seededIntBetween(this.runtimeRng, 4, width - 4);
        const ny = seededIntBetween(this.runtimeRng, 4, height - 4);
        const nr = seededFloatBetween(this.runtimeRng, 0.8, 2.2);
        const na = seededFloatBetween(this.runtimeRng, 0.15, 0.55);
        this.add.circle(nx, ny, nr, tint, na).setDepth(-9);
      }
    } else if (mood === "space") {
      // 星云斑块（大面积渐隐）
      for (let i = 0; i < 4; i += 1) {
        const nbx = seededIntBetween(this.runtimeRng, 0, width);
        const nby = seededIntBetween(this.runtimeRng, 0, height);
        const nbr = seededFloatBetween(this.runtimeRng, 50, 120);
        const nba = seededFloatBetween(this.runtimeRng, 0.03, 0.08);
        this.add.circle(nbx, nby, nbr, tint, nba).setDepth(-10);
      }
    } else if (mood === "ocean") {
      // 水波纹横线
      const waveG = this.add.graphics().setDepth(-10);
      waveG.lineStyle(0.6, 0x40e0f4, 0.06);
      for (let y = 0; y < height; y += 28) waveG.lineBetween(0, y, width, y);
      // 气泡散点
      for (let i = 0; i < 20; i += 1) {
        const bx = seededIntBetween(this.runtimeRng, 4, width - 4);
        const by = seededIntBetween(this.runtimeRng, 4, height - 4);
        const br = seededFloatBetween(this.runtimeRng, 1.0, 3.2);
        const ba = seededFloatBetween(this.runtimeRng, 0.07, 0.22);
        this.add.circle(bx, by, br, 0xaae8f8, ba).setDepth(-9);
      }
    } else if (mood === "forest") {
      // 萤火虫光点
      for (let i = 0; i < 36; i += 1) {
        const fx = seededIntBetween(this.runtimeRng, 4, width - 4);
        const fy = seededIntBetween(this.runtimeRng, 4, height - 4);
        const fa = seededFloatBetween(this.runtimeRng, 0.07, 0.28);
        this.add
          .circle(fx, fy, seededFloatBetween(this.runtimeRng, 0.8, 2.2), 0xd4f77e, fa)
          .setDepth(-9);
      }
    }
    // generic / default：仅依赖 buildShooterStarfieldTexture 基础色，无需额外叠加
  }

  // ─── Scrolling stars ──────────────────────────────────────────────────────

  private addScrollingStars() {
    const { width, height } = this.scale;
    const raw = this.spec.theme.particleTint?.replace("#", "") ?? "69746c";
    const parsed = parseInt(raw, 16);
    const tint = Number.isFinite(parsed) ? parsed : 0x8888aa;
    for (let i = 0; i < 30; i += 1) {
      const star = this.add
        .rectangle(
          Phaser.Math.Between(4, width - 4),
          Phaser.Math.Between(4, height - 4),
          1.5,
          Phaser.Math.FloatBetween(4, 10),
          tint,
          0.18,
        )
        .setDepth(-11);
      this.tweens.add({
        targets: star,
        y: height + 20,
        duration: Phaser.Math.Between(1800, 4000),
        repeat: -1,
        onRepeat: () => {
          star.x = Phaser.Math.Between(4, width - 4);
          star.y = -20;
        },
      });
    }
  }

  // ─── Wave system ───────────────────────────────────────────────────────────

  private setupOrbitPlanet(w: number, h: number) {
    this.planetCx = w / 2;
    this.planetCy = h * 0.48;
    this.planetRx = Math.min(w, h) * 0.28;
    this.planetRy = this.planetRx * 0.62;
    const g = this.add.graphics().setDepth(1);
    paintOrbitPlanetRich(g, this.planetCx, this.planetCy, this.planetRx, this.planetRy, this.runtimeRng);
  }

  private syncOrbitPlayerPosition() {
    const radiusX = this.planetRx + 34;
    const radiusY = this.planetRy + 26;
    const x = this.planetCx + Math.cos(this.orbitAngle) * radiusX;
    const y = this.planetCy + Math.sin(this.orbitAngle) * radiusY;
    this.player.setPosition(x, y);
    this.player.setRotation(this.orbitAngle + Math.PI / 2);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setAllowGravity(false);
  }

  private startWave() {
    if (this.finished) return;
    this.wave += 1;
    this.waveClearing = false;

    // 优先读 LLM 设计的 blueprint 波次；超出范围则循环最后一波（保持难度）
    const totalWaves = this.blueprint.waves.length;
    this.bpWaveIndex = Math.min(this.wave - 1, totalWaves - 1);
    const bpWave = this.blueprint.waves[this.bpWaveIndex]!;
    const isBossWave = bpWave.pattern === "boss-arena";
    const isEliteWave = Boolean(bpWave.elite);
    this.currentEnemyBullet = bpWave.bullet;

    // 弹幕图样越复杂越频繁开火
    const fireMul = bpWave.bullet === "ring" || bpWave.bullet === "spiral" ? 1.4 : 1;
    this.currentEnemyFireDelay = Math.max(
      300,
      (this.enemyShotIntervalMs / Math.max(0.6, bpWave.speedMul)) / fireMul,
    );

    const acts = this.spec.director?.acts ?? [];
    const t = this.winScore > 0 ? Phaser.Math.Clamp(this.totalKills / this.winScore, 0, 1) : 0;
    let idx = 0;
    for (let i = 0; i < acts.length; i += 1) {
      if (acts[i] && t >= acts[i]!.at) idx = i;
    }

    const label = acts[idx]?.label;
    const bannerTitle = bpWave.banner ?? label ?? this.blueprint.boss.label;
    if (label && idx !== this.actIndex) {
      this.actIndex = idx;
      this.hud.flashBanner({ title: label, message: hudShooterWave(this.uiLocale, this.wave), ms: 1600 });
      const sections = ["intro", "build", "drop", "climax"] as const;
      this.soundscape?.setSection(sections[idx] ?? "intro");
    } else {
      const waveBanner = shooterWaveBanner(
        this.uiLocale,
        this.wave,
        isBossWave ? "boss" : isEliteWave ? "elite" : "normal",
      );
      this.hud.flashBanner({
        title: bpWave.banner ?? waveBanner.title,
        message: waveBanner.message,
        ms: 1400,
      });
    }
    this.soundscape?.triggerWaveStart(Math.max(0, this.wave - 1), Math.max(4, totalWaves));

    if (isBossWave) {
      this.spawnBoss();
    } else {
      this.spawnFormationFromBlueprint(bpWave);
    }

    this.refreshHud();
  }

  /**
   * 按 ShooterWave 的 pattern 调用 shooter-runtime.spawnFormationFromPattern，
   * 然后把抽象的 SpawnEnemyParams 翻译成 Phaser arcade image。
   */
  private spawnFormationFromBlueprint(wave: ShooterWave) {
    if (this.orbitMode) {
      // Orbit 模式保留旧逻辑（环绕星球，不适配编队脚本）
      this.spawnFormationOrbit(Math.max(4, wave.count));
      return;
    }
    const params = spawnFormationFromPattern(wave.pattern, wave, {
      width: this.scale.width,
      progress: this.winScore > 0 ? this.totalKills / this.winScore : 0,
      rng: this.runtimeRng,
    });
    if (!params.length) {
      this.waveEnemiesLeft = 0;
      return;
    }
    const enemySize = wave.elite ? 56 : 44;
    let count = 0;
    for (const p of params) {
      const key = wave.elite ? this.assets.enemyElite : this.assets.enemyBasic;
      const e = this.enemies.create(p.x, p.y, key) as Phaser.Physics.Arcade.Image;
      e.setDepth(5);
      fitSpriteDisplay(e, enemySize);
      e.setData("hp", p.hp);
      e.setData("maxHp", p.hp);
      e.setData("bpMotion", p.motion);
      e.setData("bpMotionPhase", p.motionPhase);
      e.setData("bpSpeedMul", wave.speedMul);
      e.setData("entryY", 80 + count * 6);
      count += 1;
    }
    this.waveEnemiesLeft = count;
  }

  /** Orbit 模式简化版（保持向后兼容） */
  private spawnFormationOrbit(count: number) {
    for (let i = 0; i < count; i += 1) {
      const angle = seededFloatBetween(this.runtimeRng, 0, Math.PI * 2);
      const dist = seededFloatBetween(this.runtimeRng, 0.35, 0.88);
      const x = this.planetCx + Math.cos(angle) * this.planetRx * dist;
      const y = this.planetCy + Math.sin(angle) * this.planetRy * dist;
      const e = this.enemies.create(x, y, this.assets.enemyBasic) as Phaser.Physics.Arcade.Image;
      e.setDepth(5);
      fitSpriteDisplay(e, 40);
      e.setData("hp", 1);
      e.setData("maxHp", 1);
      e.setData("orbitObstacle", true);
      e.setData("orbitAngle", angle);
      e.setData("orbitDist", dist);
    }
    this.waveEnemiesLeft = count;
  }

  /** @deprecated 老接口，保留给老路径调用（实际已不再被引用） */
  private spawnFormation(cols: number, rows: number, elite: boolean) {
    if (this.orbitMode) {
      const count = cols * rows;
      for (let i = 0; i < count; i += 1) {
        const angle = seededFloatBetween(this.runtimeRng, 0, Math.PI * 2);
        const dist = seededFloatBetween(this.runtimeRng, 0.35, 0.88);
        const x = this.planetCx + Math.cos(angle) * this.planetRx * dist;
        const y = this.planetCy + Math.sin(angle) * this.planetRy * dist;
        const key = elite ? this.assets.enemyElite : this.assets.enemyBasic;
        const hp = elite ? 2 : 1;
        const e = this.enemies.create(x, y, key) as Phaser.Physics.Arcade.Image;
        e.setDepth(5);
        fitSpriteDisplay(e, elite ? 48 : 40);
        e.setData("hp", hp);
        e.setData("maxHp", hp);
        e.setData("orbitObstacle", true);
        e.setData("orbitAngle", angle);
        e.setData("orbitDist", dist);
      }
      this.waveEnemiesLeft = count;
      return;
    }

    const { width } = this.scale;
    const enemyW = elite ? 48 : 40;
    const totalW = cols * (enemyW + 18) - 18;
    const startX = (width - totalW) / 2 + enemyW / 2;
    let count = 0;

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const x = startX + col * (enemyW + 18);
        const y = -40 - row * 54;
        const key = elite ? this.assets.enemyElite : this.assets.enemyBasic;
        const hp = elite ? 2 : 1;
        const e = this.enemies.create(x, y, key) as Phaser.Physics.Arcade.Image;
        e.setDepth(5);
        fitSpriteDisplay(e, enemyW);
        e.setData("hp", hp);
        e.setData("maxHp", hp);
        e.setData("driftPhase", Phaser.Math.FloatBetween(0, Math.PI * 2));
        e.setData("driftAmp", Phaser.Math.FloatBetween(18, 42));
        e.setData("baseX", x + Phaser.Math.Between(-30, 30));
        e.setData("entryY", 80 + row * 48);
        count += 1;
      }
    }
    this.waveEnemiesLeft = count;
  }

  private spawnBoss() {
    const { width } = this.scale;
    const x = width / 2;
    const boss = this.enemies.create(x, -120, this.assets.boss) as Phaser.Physics.Arcade.Image;
    boss.setDepth(5);
    fitSpriteDisplay(boss, 160);
    // 接入 BossController：HP / 多阶段切换 / motion / bullet 都由 controller 决策
    this.bossController = new BossController(this.blueprint.boss, this.wave);
    const hp = this.bossController.getMaxHp();
    boss.setData("hp", hp);
    boss.setData("maxHp", hp);
    boss.setData("isBoss", true);
    boss.setData("bpMotion", "boss-arena");
    boss.setData("bpMotionPhase", 0);
    boss.setData("bpSpeedMul", 1);
    boss.setData("entryY", 160);
    this.bossSprite = boss;
    this.waveEnemiesLeft = 1;
    this.soundscape?.triggerEvent("boss");
    this.hud.flashBanner({
      title: this.blueprint.boss.label,
      message: this.bossController.getPhase().label,
      ms: 1600,
    });
    // Reveal boss HP bar
    this.bossHpBarVisible = true;
    this.tweens.add({ targets: this.bossHpBar, alpha: 1, duration: 220, ease: "Quad.Out" });
  }

  // ─── Combat ────────────────────────────────────────────────────────────────

  private firePlayerBullet() {
    if (this.finished) return;
    if (this.shotsFired % 4 === 0) playBleep("fire");
    this.shotsFired += 1;
    setPhaserQaState({ qaTouches: this.shotsFired });
    const isBurst = this.currentFireDelay <= 140;
    if (isBurst) {
      juiceShake(this, { durationMs: 36, intensity: 0.0018 });
    }

    if (this.orbitMode) {
      // Orbit 模式仍走原来的单/三连散射
      const spread = this.time.now < this.supportWingUntil ? [-18, 0, 18] : isBurst ? [-12, 0, 12] : [0];
      for (const offset of spread) {
        const speed = isBurst ? this.bulletSpeed * 1.4 : this.bulletSpeed;
        const aim = this.orbitAngle + Math.PI / 2 + offset * 0.004;
        const dx = Math.cos(aim);
        const dy = Math.sin(aim);
        const b = this.playerBullets.get(
          this.player.x + dx * 10,
          this.player.y + dy * 10,
          this.assets.playerBullet,
        ) as Phaser.Physics.Arcade.Image | null;
        if (!b) continue;
        b.setActive(true);
        b.setVisible(true);
        b.setDepth(7);
        b.setRotation(aim + Math.PI / 2);
        (b.body as Phaser.Physics.Arcade.Body).setVelocity(dx * speed, dy * speed);
      }
      return;
    }

    // 按武器树类型生成子弹（带方向）。supportWingUntil 拉宽散弹幅度，dash burst 抬速度
    let weapon: ShooterBulletPattern = this.currentWeapon;
    if (this.time.now < this.supportWingUntil && weapon === "single") weapon = "spread-3";
    const speedScale = isBurst ? 1.4 : 1;
    const params = emitPlayerBulletsByWeapon(
      weapon,
      { x: this.player.x, y: this.player.y },
      this.bulletSpeed * speedScale,
    );
    const bulletTint = this.weaponBulletTint(weapon);
    for (const p of params) {
      const b = this.playerBullets.get(p.x, p.y, this.assets.playerBullet) as Phaser.Physics.Arcade.Image | null;
      if (!b) continue;
      b.setActive(true);
      b.setVisible(true);
      b.setDepth(7);
      b.setRotation(p.rotation);
      b.setTint(bulletTint);
      b.setScale(weapon === "laser-beam" ? 1.6 : weapon === "spread-5" || weapon === "spread-3" ? 0.9 : 1);
      (b.body as Phaser.Physics.Arcade.Body).setVelocity(p.vx, p.vy);
    }
  }

  private weaponBulletTint(weapon: ShooterBulletPattern): number {
    switch (weapon) {
      case "spread-3":
      case "spread-5": return 0xfb923c;      // orange
      case "fan-7": return 0xf97316;          // deep orange
      case "laser-beam": return 0x22d3ee;     // cyan
      case "shotgun": return 0xfbbf24;        // amber
      case "aimed-volley": return 0xa3e635;   // lime
      case "spiral": return 0xf472b6;         // pink
      case "ring": return 0xc084fc;           // purple
      default: return 0xffffff;
    }
  }

  private fireEnemyBullet() {
    if (this.finished) return;
    const list = this.enemies.getChildren();
    if (!list.length) return;
    // 找一个活跃且在场内的敌人作为弹源
    let source: Phaser.Physics.Arcade.Image | null = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const cand = list[Phaser.Math.Between(0, list.length - 1)] as Phaser.Physics.Arcade.Image;
      if (cand?.active && cand.y >= 0) {
        source = cand;
        break;
      }
    }
    if (!source) return;

    // Boss 用自己阶段的 bullet pattern；普通敌人用当前 wave 的 pattern
    const isBossSource = Boolean(source.getData("isBoss"));
    const pattern: ShooterBulletPattern =
      isBossSource && this.bossController
        ? this.bossController.getCurrentBullet()
        : this.currentEnemyBullet;
    const baseSpeed = this.enemySpeed * 1.8 * (1 + this.intensity * 0.3);
    const target = { x: this.player.x, y: this.player.y };
    const bullets = emitEnemyBulletsByPattern(
      pattern,
      { x: source.x, y: source.y },
      target,
      baseSpeed,
      this.runtimeRng,
    );
    for (const p of bullets) {
      const b = this.enemyBullets.get(p.x, p.y, this.assets.enemyBullet) as Phaser.Physics.Arcade.Image | null;
      if (!b) continue;
      b.setActive(true);
      b.setVisible(true);
      b.setDepth(6);
      (b.body as Phaser.Physics.Arcade.Body).setVelocity(p.vx, p.vy);
    }
  }

  /** Boss 独立开火（不走普通敌人 fire timer，确保多阶段强度生效） */
  private fireBossBullet(boss: Phaser.Physics.Arcade.Image) {
    if (this.finished || !this.bossController) return;
    const pattern = this.bossController.getCurrentBullet();
    const baseSpeed = this.enemySpeed * 1.8 * (1 + this.intensity * 0.3);
    const params = emitEnemyBulletsByPattern(
      pattern,
      { x: boss.x, y: boss.y + 30 },
      { x: this.player.x, y: this.player.y },
      baseSpeed,
      this.runtimeRng,
    );
    for (const p of params) {
      const b = this.enemyBullets.get(p.x, p.y, this.assets.enemyBullet) as Phaser.Physics.Arcade.Image | null;
      if (!b) continue;
      b.setActive(true);
      b.setVisible(true);
      b.setDepth(6);
      (b.body as Phaser.Physics.Arcade.Body).setVelocity(p.vx, p.vy);
    }
  }

  private onBulletHitEnemy(bullet: Phaser.Physics.Arcade.Image, enemy: Phaser.Physics.Arcade.Image) {
    if (this.finished) return;
    if (!bullet.active || !enemy.active) return;

    bullet.destroy();
    const isBoss = Boolean(enemy.getData("isBoss"));
    juiceHit(this, {
      x: enemy.x,
      y: enemy.y,
      colorHex: themeParticleHex(this.spec),
      rng: this.runtimeRng,
      large: isBoss,
    });

    // Boss 走 controller 多阶段
    if (isBoss && this.bossController) {
      const { phaseChanged, killed } = this.bossController.takeDamage(1);
      enemy.setData("hp", this.bossController.getHp());
      if (phaseChanged) {
        const ph = this.bossController.getPhase();
        this.hud.flashBanner({
          title: this.blueprint.boss.label,
          message: ph.label,
          ms: 1600,
        });
        juiceBoss(this, {
          x: enemy.x,
          y: enemy.y,
          colorHex: themeParticleHex(this.spec),
          text: ph.label,
          textColorCss: this.cohesive.hud.danger,
          rng: this.runtimeRng,
        });
        this.soundscape?.triggerEvent("boss");
      }
      if (killed) {
        // Multi-blast death sequence
        const bx = enemy.x;
        const by = enemy.y;
        this.fxExplosion(bx, by, true);
        for (let i = 1; i <= 4; i++) {
          this.time.delayedCall(i * 120, () => {
            const ox = bx + (Math.random() - 0.5) * 80;
            const oy = by + (Math.random() - 0.5) * 60;
            this.fxExplosion(ox, oy, false);
          });
        }
        enemy.destroy();
        this.bossSprite = null;
        this.bossController = null;
        // Hide boss HP bar
        this.bossHpBarVisible = false;
        this.tweens.add({ targets: this.bossHpBar, alpha: 0, duration: 280, ease: "Quad.In" });
        this.waveEnemiesLeft = Math.max(0, this.waveEnemiesLeft - 1);
        this.totalKills += 1;
        this.score += 20 * this.scoreMult;
        playBleep("win");
        this.soundscape?.triggerKillStinger();
        this.refreshHud();
        if (this.totalKills >= this.winScore) {
          this.finish({ score: this.score, won: true });
          return;
        }
        if (this.waveEnemiesLeft <= 0 && !this.waveClearing) {
          this.waveClearing = true;
          this.time.delayedCall(1200, () => this.startWave());
        }
      } else {
        const maxHp = this.bossController?.getMaxHp() ?? 1;
        enemy.setAlpha(0.55 + 0.45 * (this.bossController!.getHpRatio()));
        this.time.delayedCall(100, () => {
          if (enemy.active) enemy.setAlpha(1);
        });
      }
      return;
    }

    const hp = (enemy.getData("hp") as number) - 1;
    if (hp <= 0) {
      this.fxExplosion(enemy.x, enemy.y, isBoss);
      const dropX = enemy.x;
      const dropY = enemy.y;
      enemy.destroy();
      this.waveEnemiesLeft = Math.max(0, this.waveEnemiesLeft - 1);
      this.totalKills += 1;
      this.score += (isBoss ? 10 : 1) * this.scoreMult;
      playBleep(isBoss ? "win" : "explode");
      this.soundscape?.triggerKillStinger();
      this.refreshHud();
      // 道具掉落：约 25% 普通敌人，boss 100%
      if (isBoss || this.runtimeRng() < 0.25) {
        this.spawnWeaponPickup(dropX, dropY);
      }
      if (this.totalKills >= this.winScore) {
        this.finish({ score: this.score, won: true });
        return;
      }
      if (this.waveEnemiesLeft <= 0 && !this.waveClearing) {
        this.waveClearing = true;
        this.time.delayedCall(1200, () => this.startWave());
      }
    } else {
      enemy.setData("hp", hp);
      // Flash hit
      const maxHp = (enemy.getData("maxHp") as number) || 1;
      enemy.setAlpha(0.5 + 0.5 * (hp / maxHp));
      this.time.delayedCall(100, () => { if (enemy.active) enemy.setAlpha(1); });
    }
  }

  private onPlayerHit() {
    if (this.time.now < this.shieldUntil) {
      juicePickup(this, {
        x: this.player.x,
        y: this.player.y,
        colorHex: this.cohesive.hud.accent2,
        text: this.uiLocale === "zh-Hans" ? "护盾" : "Shield",
        textColorCss: this.cohesive.hud.accent,
        rng: this.runtimeRng,
      });
      playBleep("pickup");
      return;
    }
    this.lives -= 1;
    this.invulnUntil = this.time.now + 1200;
    juiceHit(this, {
      x: this.player.x,
      y: this.player.y,
      colorHex: this.spec.theme.hazardColor,
      rng: this.runtimeRng,
      large: this.lives <= 1,
    });
    playBleep("hit");
    this.cameras.main.shake(this.lives <= 0 ? 280 : 160, this.lives <= 0 ? 0.012 : 0.005);
    spawnDamageNumber(this, this.player.x, this.player.y, 1, {
      color: this.lives <= 0 ? "#ff1111" : "#ff6644",
      large: this.lives <= 0,
    });
    this.player.setAlpha(0.3);
    this.time.delayedCall(300, () => {
      if (!this.finished) this.player.setAlpha(1);
    });
    if (this.lives === 1) {
      this.soundscape?.triggerEvent("danger");
      this.startDangerVignette();
    }
    this.refreshHud();
    if (this.lives <= 0) {
      this.finish({ score: this.score, won: false });
    }
  }

  // ─── Effects ───────────────────────────────────────────────────────────────

  private spawnWeaponPickup(x: number, y: number) {
    if (this.finished || this.orbitMode) return;
    const key = firstExistingTexture(this, ["texPower", "texGem"]) ?? this.assets.powerSpread;
    const pu = this.powerups.get(x, y, key) as Phaser.Physics.Arcade.Image | null;
    if (!pu) return;
    pu.setActive(true);
    pu.setVisible(true);
    pu.setDepth(6);
    fitSpriteDisplay(pu, 28);
    (pu.body as Phaser.Physics.Arcade.Body).setVelocity(
      Phaser.Math.Between(-30, 30),
      60,
    );
  }

  private fxExplosion(x: number, y: number, large = false) {
    const common = {
      x,
      y,
      colorHex: large ? "#ff6600" : themeParticleHex(this.spec),
      rng: this.runtimeRng,
      large,
    };
    if (large) juiceBoss(this, common);
    else juiceHit(this, common);
  }

  // ─── Director events ───────────────────────────────────────────────────────

  private tickDirectorEvents() {
    const now = this.time.now;

    if (this.eventType && now >= this.eventUntil) {
      // 事件结束：回滚所有 director translator 修饰符
      this.scoreMult = 1;
      this.enemySpeed = this.spec.gameplay.hazardSpeed ?? 110;
      this.currentFireDelay = Math.max(120, Math.floor(260 - this.intensity * 60));
      this.currentEnemyFireDelay = Math.max(500, this.enemyShotIntervalMs);
      this.hud.flashBanner({
        title: tMessage(this.uiLocale, "gameEvents.shooter.eventEnd"),
        ms: 1100,
      });
      this.eventType = null;
      this.eventUntil = 0;
    }

    const events = this.spec.director?.events ?? [];
    if (!events.length) return;
    const t = this.winScore > 0 ? Phaser.Math.Clamp(this.totalKills / this.winScore, 0, 1) : 0;
    while (this.eventIndex < events.length) {
      const ev = events[this.eventIndex];
      if (!ev || t < ev.at) break;
      this.eventIndex += 1;
      this.startEvent(ev);
    }
  }

  private startEvent(ev: DirectorEvent) {
    const now = this.time.now;
    const durationMs = ev.durationMs ?? 4000;
    const title =
      ev.type === "coinRain"
        ? tMessage(this.uiLocale, "gameEvents.shooter.doubleScore")
        : ev.type === "miniBoss"
          ? tMessage(this.uiLocale, "gameEvents.shooter.bossReinforce")
          : gameEventTitle(this.uiLocale, ev.type, this.spec.templateId);

    this.eventType = ev.type;
    this.eventUntil = now + durationMs;
    this.hud.flashBanner({ title, message: ev.message ?? "", ms: Math.min(1800, durationMs - 200) });
    applyRuntimeEventImpact(this, ev.type, {
      x: this.player?.x ?? this.scale.width / 2,
      y: this.player?.y ?? this.scale.height * 0.58,
      title,
      spec: this.spec,
      cohesive: this.cohesive,
      strength: ev.strength ?? 0.6,
      rng: this.runtimeRng,
    });

    /**
     * Director Translator：把 LLM 语义事件翻译成真正的运行时修饰符。
     * runtimeEventImpact 只负责粒子横幅；这里负责"机制层"——刷怪密度 / 子弹速度 /
     * 护盾 / 武器扩散 / 得分倍率 / boss 召唤 全部真正改变。
     */
    const mods = translateDirectorEvent(ev.type, ev.strength ?? 0.6, this.spec);
    // 得分倍率（持续 durationMs，已有 eventUntil 兜底回滚 coinRain）
    if (mods.scoreMul > 1) {
      this.scoreMult = Math.max(this.scoreMult, mods.scoreMul);
    }
    // 玩家自动开火速率
    if (mods.playerFireRateMul < 1) {
      this.currentFireDelay = Math.max(80, Math.floor(this.currentFireDelay * mods.playerFireRateMul));
    }
    // 敌人开火间隔
    if (mods.spawnRateMul !== 1) {
      this.currentEnemyFireDelay = Math.max(
        260,
        Math.floor(this.currentEnemyFireDelay * mods.spawnRateMul),
      );
    }
    // 敌人速度
    if (mods.enemySpeedMul !== 1) {
      this.enemySpeed = this.enemySpeed * mods.enemySpeedMul;
      // 自动随 eventUntil 回滚到下方
    }
    // 护盾
    if (mods.shieldGrantMs > 0) {
      this.shieldUntil = Math.max(this.shieldUntil, now + mods.shieldGrantMs);
    }
    // 火力扩散僚机
    if (mods.grantSupportWingMs > 0) {
      this.supportWingUntil = Math.max(this.supportWingUntil, now + mods.grantSupportWingMs);
      this.burstUntil = Math.max(this.burstUntil, now + Math.min(mods.grantSupportWingMs, 2400));
    }
    // 召唤 miniBoss
    if (mods.spawnMiniBoss && !this.bossController) {
      this.spawnBoss();
    }
    // 摄像机额外震动
    if (mods.cameraShakeBoost > 0) {
      juiceShake(this, { durationMs: 240, intensity: 0.004 * mods.cameraShakeBoost });
    }

    // 旧路径残留兼容：保留 coinRain 倍率 / goalShift 火力扩散副作用
    if (ev.type === "coinRain") {
      this.coinRainUntil = now + durationMs;
    }
  }

  private tryCastSkill() {
    const skill = this.spec.systems?.skill;
    if (!skill) return;
    if (this.time.now < this.skillReadyAt) return;
    this.skillReadyAt = this.time.now + skill.cooldownMs;
    const dur = Math.max(1200, skill.durationMs ?? 0);
    applySystemImpact(this, "skill", {
      effect: skill.effect,
      label: skill.name,
      x: this.player?.x ?? this.scale.width / 2,
      y: this.player?.y ?? this.scale.height * 0.72,
      spec: this.spec,
      cohesive: this.cohesive,
      rng: this.runtimeRng,
    });

    if (skill.effect === "shield") {
      this.shieldUntil = this.time.now + dur;
      juicePickup(this, {
        x: this.player.x,
        y: this.player.y,
        colorHex: this.cohesive.hud.accent2,
        text: skill.name,
        textColorCss: this.cohesive.hud.accent,
        rng: this.runtimeRng,
      });
      playBleep("pickup");
      this.refreshHud();
      return;
    }
    if (skill.effect === "timeSlow") {
      this.slowUntil = this.time.now + dur;
      playBleep("pickup");
      this.refreshHud();
      return;
    }
    if (skill.effect === "dash") {
      this.burstUntil = this.time.now + Math.max(1600, dur);
      this.supportWingUntil = this.time.now + Math.max(1600, dur);
      this.currentFireDelay = 110;
      // 副效果：dash 也算"拾取道具"推进武器升级树一格
      const next = advanceWeaponTree(this.currentWeapon, this.blueprint.weaponTree);
      if (next !== this.currentWeapon) {
        this.currentWeapon = next;
        this.hud.flashBanner({
          title: this.uiLocale === "zh-Hans" ? "武器升级" : "Weapon up",
          message: next,
          ms: 1200,
        });
        playBleep("levelUp");
      } else {
        playBleep("pickup");
      }
      this.refreshHud();
      return;
    }
    if (skill.effect === "bomb") {
      const enemies = this.enemies.getChildren();
      for (const obj of enemies) {
        const enemy = obj as Phaser.Physics.Arcade.Image;
        if (!enemy.active) continue;
        enemy.setData("hp", 0);
        this.fxExplosion(enemy.x, enemy.y, Boolean(enemy.getData("isBoss")));
        enemy.destroy();
        this.waveEnemiesLeft = Math.max(0, this.waveEnemiesLeft - 1);
        this.totalKills += 1;
        this.score += 2 * this.scoreMult;
      }
      juiceBoss(this, {
        x: this.player.x,
        y: this.player.y - 40,
        colorHex: themeParticleHex(this.spec),
        text: skill.name,
        textColorCss: this.cohesive.hud.accent,
        rng: this.runtimeRng,
      });
      playBleep("hit");
      this.refreshHud();
      return;
    }
  }

  // ─── HUD ───────────────────────────────────────────────────────────────────

  private refreshHud() {
    if (!this.hud) return;
    const prog = Math.min(this.totalKills, this.winScore);
    const skillName = this.spec.systems?.skill?.name ?? hudDefaultSkill(this.uiLocale);
    const cdLeft = Math.max(0, this.skillReadyAt - this.time.now);
    const status: "shield" | "slow" | "wing" | "standby" =
      this.time.now < this.shieldUntil
        ? "shield"
        : this.time.now < this.slowUntil
          ? "slow"
          : this.time.now < this.supportWingUntil
            ? "wing"
            : "standby";
    const acts = this.spec.director?.acts ?? null;
    const label = acts?.[this.actIndex]?.label;
    const right = `${hudShooterWave(this.uiLocale, this.wave)} · ${hudShooterKills(this.uiLocale, prog, this.winScore)}`;
    const skillCd =
      cdLeft <= 0 ? shooterShiftReady(this.uiLocale) : shooterShiftCooldown(this.uiLocale, (cdLeft / 1000).toFixed(1));

    // 武器升级树 UI
    const tree = this.blueprint.weaponTree;
    const tier = Math.max(0, tree.indexOf(this.currentWeapon));
    const weaponInfo = {
      name: WEAPON_LABEL[this.currentWeapon] ?? this.currentWeapon,
      tier,
      total: tree.length,
    };

    this.hud.update({
      score: this.score,
      lives: this.lives,
      right,
      actLabel: label ?? "",
      skill: `${shooterSkillStatus(this.uiLocale, skillName, status)} · ${skillCd}`,
      weaponInfo,
    });
  }

  private startDangerVignette() {
    this.hud?.update({ dangerLevel: 1 });
  }

  // ─── Finish ────────────────────────────────────────────────────────────────

  private finish(payload: EndPayload) {
    if (this.finished) return;
    this.hud?.update({ dangerLevel: 0 });
    this.finished = true;
    // Cancel pending timers
    if (this.fireTimer) this.fireTimer.destroy();
    if (this.enemyFireTimer) this.enemyFireTimer.destroy();
    this.physics.pause();
    this.hud?.setBottomHint(shooterFinishText(this.uiLocale, payload.won));
    this.hud?.flashBanner({
      title: payload.won
        ? this.uiLocale === "zh-Hans"
          ? "胜利"
          : "Victory"
        : this.uiLocale === "zh-Hans"
          ? "失败"
          : "Defeat",
      message: shooterFinishText(this.uiLocale, payload.won),
      ms: 2400,
    });
    if (payload.won) {
      this.cameras.main.shake(340, 0.01);
      juiceWin(this, {
        x: this.player.x,
        y: this.player.y,
        colorHex: themeParticleHex(this.spec),
        text: this.uiLocale === "zh-Hans" ? "胜利" : "Win",
        textColorCss: this.cohesive.hud.accent,
        rng: this.runtimeRng,
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
        rng: this.runtimeRng,
      });
    }
    this.onEnd(payload);
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  update(time: number) {
    if (this.finished || !this.bootstrapDone) return;
    setPhaserQaState({ qaTouches: this.shotsFired });

    if (this.keyShift && Phaser.Input.Keyboard.JustDown(this.keyShift)) {
      this.tryCastSkill();
    }

    if (time >= this.burstUntil) {
      this.currentFireDelay = Math.max(120, Math.floor(260 - this.intensity * 60));
    } else {
      this.currentFireDelay = 110;
    }

    // Player movement
    const { height } = this.scale;
    if (this.orbitMode) {
      const keys = {
        cursors: this.cursors,
        w: this.keyW,
        a: this.keyA,
        s: this.keyS,
        d: this.keyD,
        space: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
        shift: this.keyShift,
      };
      const axis = readMoveAxis(keys, { allowVertical: false });
      const ptr = pointerSteerX(this, this.player.x);
      const steer = axis.x !== 0 ? axis.x : ptr;
      this.orbitSpeed += steer * 0.00006;
      this.orbitSpeed = Phaser.Math.Clamp(this.orbitSpeed, 0.0009, 0.0034);
      this.orbitAngle += this.orbitSpeed * (this.game.loop.delta / 16.67);
      this.syncOrbitPlayerPosition();
    } else {
      const keys = {
        cursors: this.cursors,
        w: this.keyW,
        a: this.keyA,
        s: this.keyS,
        d: this.keyD,
        space: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
        shift: this.keyShift,
      };
      const axis = readMoveAxis(keys, { allowVertical: false });
      const ptr = pointerSteerX(this, this.player.x);
      const vx = (axis.x !== 0 ? axis.x : ptr) * this.playerSpeed;
      this.player.setVelocityX(vx);
      this.player.setVelocityY(0);
      this.player.y = height - 56;
    }

    // Invulnerable flash
    if (this.time.now < this.invulnUntil) {
      this.player.setAlpha(Math.sin(time * 0.015) > 0 ? 0.4 : 0.9);
    } else {
      this.player.setAlpha(1);
    }

    // Ship movement trail
    const shipVx = this.orbitMode ? 1 : Math.abs((this.player.body as Phaser.Physics.Arcade.Body).velocity.x);
    if (this.player.active && shipVx > 60) {
      this.shipTrail.push({ x: this.player.x, y: this.player.y, t: time });
      if (this.shipTrail.length > 6) this.shipTrail.shift();
    } else if (this.shipTrail.length > 0) {
      this.shipTrail.shift();
    }
    const sg = this.shipTrailGfx;
    sg.clear();
    for (let i = 0; i < this.shipTrail.length - 1; i++) {
      const pt = this.shipTrail[i]!;
      const age = (time - pt.t) / 180;
      const alpha = Math.max(0, (1 - age) * 0.18 * (i / this.shipTrail.length));
      if (alpha <= 0) continue;
      sg.fillStyle(0x7dd3fc, alpha);
      sg.fillCircle(pt.x, pt.y, 10 + i * 1.5);
    }

    // Enemy movement: blueprint motion 优先；老 driftPhase 兜底
    const enemies = this.enemies.getChildren();
    const slowMul = time < this.slowUntil ? 0.72 : 1;
    for (let i = 0; i < enemies.length; i += 1) {
      const e = enemies[i] as Phaser.Physics.Arcade.Image;
      if (!e.active) continue;

      if (e.getData("orbitObstacle")) {
        const baseAngle = (e.getData("orbitAngle") as number) ?? 0;
        const dist = (e.getData("orbitDist") as number) ?? 0.6;
        const wobble = Math.sin(time * 0.0012 + baseAngle * 3) * 0.04;
        const ang = baseAngle + time * 0.00015 + wobble;
        e.setPosition(
          this.planetCx + Math.cos(ang) * this.planetRx * dist,
          this.planetCy + Math.sin(ang) * this.planetRy * dist,
        );
        (e.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
        continue;
      }

      // Boss 走 BossController 决策位移
      if (e.getData("isBoss") && this.bossController) {
        const pos = this.bossController.computeMotion(time, this.scale.width / 2);
        const body = e.body as Phaser.Physics.Arcade.Body;
        const vx = (pos.x - e.x) * 4 * slowMul;
        const vy = (pos.y - e.y) * 4 * slowMul;
        body.setVelocity(vx, vy);
        // Boss 按自己节奏开火（独立于 enemy fire timer，让弹幕节奏正确）
        if (this.bossController.shouldFire(time)) {
          this.fireBossBullet(e);
        }
        continue;
      }

      const bpMotion = (e.getData("bpMotion") as SpawnEnemyParams["motion"] | undefined) ?? "descend";
      const bpPhase = (e.getData("bpMotionPhase") as number) ?? 0;
      const speedMul = (e.getData("bpSpeedMul") as number) ?? 1;
      const baseSpeed = this.enemySpeed * speedMul * slowMul;

      const entryY = (e.getData("entryY") as number) ?? 80;
      if (e.y < entryY) {
        (e.body as Phaser.Physics.Arcade.Body).setVelocity(0, baseSpeed * 2.4);
      } else {
        applyEnemyMotion(
          e.body as Phaser.Physics.Arcade.Body,
          bpMotion,
          bpPhase,
          time,
          baseSpeed * 0.6,
          this.scale.width,
        );
      }

      // 出界处理
      if (e.y > height + 30) {
        e.destroy();
        this.waveEnemiesLeft = Math.max(0, this.waveEnemiesLeft - 1);
        if (!this.finished) this.onPlayerHit();
      } else if (e.x < -40 || e.x > this.scale.width + 40) {
        e.destroy();
        this.waveEnemiesLeft = Math.max(0, this.waveEnemiesLeft - 1);
      }
    }

    // Cleanup out-of-bounds powerups
    const pups = this.powerups.getChildren();
    for (let i = pups.length - 1; i >= 0; i -= 1) {
      const p = pups[i] as Phaser.Physics.Arcade.Image;
      if (p.active && p.y > height + 20) p.destroy();
    }

    // Cleanup out-of-bounds bullets
    const pBullets = this.playerBullets.getChildren();
    for (let i = pBullets.length - 1; i >= 0; i -= 1) {
      const b = pBullets[i] as Phaser.Physics.Arcade.Image;
      if (b.active && b.y < -20) b.destroy();
    }
    const eBullets = this.enemyBullets.getChildren();
    for (let i = eBullets.length - 1; i >= 0; i -= 1) {
      const b = eBullets[i] as Phaser.Physics.Arcade.Image;
      if (b.active && b.y > height + 20) b.destroy();
    }

    this.tickDirectorEvents();
    this.refreshHud();
    this.drawBossHpBar();
    this.drawWingGlow();
    const estTotalWaves = Math.max(4, Math.ceil(this.winScore / 12));
    this.soundscape?.triggerWaveStart(Math.max(0, this.wave - 1), estTotalWaves);
  }

  private drawWingGlow() {
    const g = this.wingGfx;
    g.clear();
    const now = this.time.now;
    const wingActive = now < this.supportWingUntil;
    if (!wingActive || !this.player?.active) return;
    const px = this.player.x;
    const py = this.player.y;
    const pulse = 0.55 + Math.sin(now * 0.012) * 0.35;
    const accentHex = parseInt((this.cohesive.hud.accent2 ?? "#7dd3fc").replace("#", ""), 16);
    // Left wing
    g.lineStyle(2.5, accentHex, pulse * 0.9);
    g.fillStyle(accentHex, pulse * 0.28);
    g.beginPath();
    g.moveTo(px - 14, py);
    g.lineTo(px - 38, py + 14);
    g.lineTo(px - 28, py - 8);
    g.closePath();
    g.fillPath();
    g.strokePath();
    // Right wing
    g.beginPath();
    g.moveTo(px + 14, py);
    g.lineTo(px + 38, py + 14);
    g.lineTo(px + 28, py - 8);
    g.closePath();
    g.fillPath();
    g.strokePath();
    // Small engine glow dots
    g.fillStyle(accentHex, pulse * 0.7);
    g.fillCircle(px - 24, py + 10, 3.5);
    g.fillCircle(px + 24, py + 10, 3.5);
  }

  private drawBossHpBar() {
    if (!this.bossHpBarVisible || !this.bossController) return;
    const g = this.bossHpBar;
    g.clear();

    const w = this.scale.width;
    const barW = Math.min(w - 48, 420);
    const barH = 12;
    const x = (w - barW) / 2;
    const y = this.scale.height - 36;

    const ratio = Phaser.Math.Clamp(this.bossController.getHpRatio(), 0, 1);
    const phase = this.bossController.getPhase();

    // Track + border
    g.fillStyle(0x0f172a, 0.88);
    g.fillRoundedRect(x - 2, y - 14, barW + 4, barH + 20, 6);
    g.lineStyle(1, 0xff4444, 0.6);
    g.strokeRoundedRect(x - 2, y - 14, barW + 4, barH + 20, 6);

    // Background (empty bar)
    g.fillStyle(0x1e293b, 0.9);
    g.fillRoundedRect(x, y, barW, barH, 4);

    // HP fill — color shifts red → yellow → green as HP drops → rises
    let fillCol: number;
    if (ratio > 0.5) {
      const t = (ratio - 0.5) * 2; // 1=full, 0=half
      const r = Math.round(Phaser.Math.Linear(251, 74, t));
      const gr = Math.round(Phaser.Math.Linear(191, 222, t));
      const b = Math.round(Phaser.Math.Linear(36, 128, t));
      fillCol = Phaser.Display.Color.GetColor(r, gr, b);
    } else {
      const t = ratio * 2; // 1=half, 0=dead
      const r = Math.round(Phaser.Math.Linear(234, 251, t));
      const gr = Math.round(Phaser.Math.Linear(56, 191, t));
      const b = Math.round(Phaser.Math.Linear(76, 36, t));
      fillCol = Phaser.Display.Color.GetColor(r, gr, b);
    }
    g.fillStyle(fillCol, 1);
    g.fillRoundedRect(x, y, Math.max(4, barW * ratio), barH, 4);

    // Shine on filled portion
    g.fillStyle(0xffffff, 0.18);
    g.fillRoundedRect(x, y, Math.max(4, barW * ratio), Math.ceil(barH / 2), 4);

    // Boss name + phase label (drawn via Text — only update when changed)
    // We use the graphics object as the visual background only; text is handled via the
    // bossHpBar's custom data since Graphics.fillText doesn't exist in Phaser 3.
    // Instead, draw a small text indicator via the Phaser bitmap-like renderTexture trick:
    // Use cached text objects attached to the scene.
    if (!this._bossNameText) {
      this._bossNameText = this.add.text(w / 2, y - 4, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "11px",
        color: "#f8fafc",
      });
      this._bossNameText.setOrigin(0.5, 1);
      this._bossNameText.setScrollFactor(0);
      this._bossNameText.setDepth(211);
    }
    const label = `${this.blueprint.boss.label} — ${phase.label}`;
    if (this._bossNameText.text !== label) this._bossNameText.setText(label);
    this._bossNameText.setAlpha(this.bossHpBar.alpha);
    this._bossNameText.setVisible(this.bossHpBarVisible);

    // Enrage tint: boss sprite pulses red-orange below 30% HP
    if (this.bossSprite && this.bossController) {
      if (this.bossController.isEnraged()) {
        const pulse = 0.5 + Math.sin(this.time.now * 0.008) * 0.5;
        const r = 255;
        const gr = Math.round(80 + pulse * 60);
        this.bossSprite.setTint(Phaser.Display.Color.GetColor(r, gr, 60));
      } else {
        this.bossSprite.clearTint();
      }
    }
  }

  private _bossNameText: Phaser.GameObjects.Text | null = null;
}
