import Phaser from "phaser";
import { playBleep } from "@/game/audio/webBleeps";
import { pointerSteerX, readMoveAxis } from "@/game/engine/phaser-input";
import { HudBanner } from "@/game/engine/HudBanner";
import { HudGoalPanel } from "@/game/engine/HudGoalPanel";
import type { GameSpec } from "@/lib/game-spec";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { AppLocale } from "@/i18n/routing";
import { gameEventTitle, shooterWaveBanner } from "@/lib/i18n/game-event-labels";
import {
  hudActChapter,
  hudLives,
  hudScore,
  hudShooterKills,
  hudShooterWave,
  hudControlsShooter,
  hudDefaultSkill,
  shooterFinishText,
  shooterSkillStatus,
  shooterShiftReady,
  shooterShiftCooldown,
} from "@/lib/i18n/game-hud-labels";
import { tMessage } from "@/lib/i18n/messages";
import type { RuntimeReferencePayload } from "@/game/engine/runtime-reference-payload";
import { classifyReferencePayloads } from "@/lib/reference-classify";
import { type CohesivePresentation } from "@/lib/cohesive-presentation";
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
import { styleHudText } from "@/game/engine/hudTextStyle";
import { bumpQaTouch, setPhaserQaState } from "@/game/engine/phaser-qa-state";
import {
  assetBackgroundAlpha,
  fitSpriteDisplay,
  firstExistingTexture,
} from "@/game/engine/phaser-loaded-sprites";
import { schedulePhaserPlayReady } from "@/game/engine/phaser-play-ready";
import { runtimeSeedFromSpec, seededFloatBetween, seededRandom } from "@/lib/runtime-seed";
import { buildSceneGoalGuidance } from "@/lib/scene-goal-guidance";
import { applyRuntimeEventImpact } from "@/game/engine/runtimeEventImpact";
import { applySystemImpact } from "@/game/engine/systemImpact";

type EndPayload = { score: number; won: boolean };
type DirectorEvent = NonNullable<NonNullable<GameSpec["director"]>["events"]>[number];

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

  private scoreText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private actText!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
  private skillText!: Phaser.GameObjects.Text;
  private skillCdText!: Phaser.GameObjects.Text;
  private banner!: HudBanner;
  private goalPanel!: HudGoalPanel;
  private cohesive!: CohesivePresentation;
  private dangerVignette: Phaser.GameObjects.Graphics | null = null;

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
      const base = `/game-sprites/${this.projectId}`;
      this.load.image("texPlayer", `${base}/player.png`);
      this.load.image("texHazard", `${base}/hazard.png`);
      this.load.image("texGem", `${base}/gem.png`);
      this.load.image("texPower", `${base}/power.png`);
      this.load.image("texBoss", `${base}/boss.png`);
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

    const ui = buildSceneCohesion(this.spec);
    this.cohesive = ui;

    this.addStarfield();

    // 文生图背景
    if (this.backgroundUrl && this.textures.exists("bgTex")) {
      this.add
        .image(width / 2, height / 2, "bgTex")
        .setDepth(-10)
        .setAlpha(assetBackgroundAlpha(this.projectId, ui.qualityTier));
    }

    // Title + subtitle（章节标签单独一行，避免与标题 y 重叠发糊）
    styleHudText(
      this.add
        .text(width / 2, 22, this.spec.title, {
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          fontSize: "19px",
          color: ui.hud.title,
        })
        .setOrigin(0.5)
        .setDepth(20),
    );

    if (this.spec.labels.subtitle) {
      styleHudText(
        this.add
          .text(width / 2, 48, this.spec.labels.subtitle, {
            fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
            fontSize: "11px",
            color: ui.hud.subtitle,
          })
          .setOrigin(0.5)
          .setDepth(20),
      );
    }

    this.scoreText = styleHudText(
      this.add
        .text(18, 14, "", { fontFamily: "system-ui, sans-serif", fontSize: "16px", color: ui.hud.body })
        .setDepth(25),
    );

    this.livesText = this.add
      .text(18, 38, "", { fontFamily: "system-ui, sans-serif", fontSize: "14px", color: ui.hud.danger })
      .setDepth(25);

    this.waveText = this.add
      .text(width - 18, 14, "", { fontFamily: "system-ui, sans-serif", fontSize: "14px", color: ui.hud.accent })
      .setOrigin(1, 0)
      .setDepth(25);

    this.progressText = this.add
      .text(width - 18, 38, "", { fontFamily: "system-ui, sans-serif", fontSize: "12px", color: ui.hud.accent2 })
      .setOrigin(1, 0)
      .setDepth(25);

    this.skillText = this.add
      .text(18, 60, "", { fontFamily: "system-ui, sans-serif", fontSize: "12px", color: ui.hud.accent2 })
      .setDepth(25);

    this.skillCdText = this.add
      .text(width - 18, 60, "", { fontFamily: "system-ui, sans-serif", fontSize: "11px", color: ui.hud.muted })
      .setOrigin(1, 0)
      .setDepth(25);

    this.actText = styleHudText(
      this.add
        .text(width / 2, 68, "", { fontFamily: "system-ui, sans-serif", fontSize: "11px", color: ui.hud.muted })
        .setOrigin(0.5, 0)
        .setDepth(25),
    );

    const guidance = buildSceneGoalGuidance(this.spec, this.uiLocale);
    this.hintText = this.add
      .text(width / 2, height - 20, guidance.bottomHint, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "11px",
        color: ui.hud.hint,
      })
      .setOrigin(0.5)
      .setDepth(25);

    const shooterPf = this.spec.samplePlayProfile?.shooter;
    if (shooterPf?.sniperScope) {
      paintSniperScopeOverlay(this, width, height);
    }
    if (shooterPf?.orbitChopper) {
      this.orbitMode = true;
      this.hintText.setText(
        this.uiLocale === "zh-Hans" ? "环绕星球 · 左右调速 · 自动斩击" : "Orbit planet · Steer · Auto chop",
      );
    }

    this.banner = new HudBanner(this, ui.banner);
    this.banner.show(guidance.banner);
    this.goalPanel = new HudGoalPanel(this, guidance, ui);

    // 射击模板：优先使用 preload 的 texPlayer/texHazard，其次参考图 ref*，最后程序化星舰
    const loadedPlayerKey = firstExistingTexture(this, ["texPlayer"]);
    const playerTex =
      loadedPlayerKey ??
      (this.playerTextureKey && this.textures.exists(this.playerTextureKey)
        ? this.playerTextureKey
        : (this.makeStarshipTexture("texPlayer", 48, 52, this.spec.theme.playerColor), "texPlayer"));

    const loadedEnemyKey = firstExistingTexture(this, ["texHazard"]);
    const enemyTex =
      loadedEnemyKey ??
      (this.enemyTextureKey && this.textures.exists(this.enemyTextureKey)
        ? this.enemyTextureKey
        : (this.makeInterceptorTexture("texEnemy", 36, 32, this.spec.theme.hazardColor, false), "texEnemy"));
    this.enemySpriteKey = enemyTex;
    if (!this.textures.exists("texElite")) {
      this.makeInterceptorTexture("texElite", 42, 36, this.spec.theme.hazardColor, true);
    }
    if (!this.textures.exists("texBoss")) {
      this.makeBossTexture("texBoss", 64, 52, this.spec.theme.hazardColor);
    }
    this.makeRectTexture("texPlayerBullet", 5, 14, this.spec.theme.collectibleColor ?? this.spec.theme.playerColor);
    this.makeRectTexture("texEnemyBullet", 5, 12, this.spec.theme.hazardColor);

    if (this.orbitMode) {
      this.setupOrbitPlanet(width, height);
    }

    // Player ship
    this.player = this.physics.add.image(
      this.orbitMode ? this.planetCx : width / 2,
      this.orbitMode ? this.planetCy - this.planetRy - 36 : height - 56,
      playerTex,
    );
    this.player.setCollideWorldBounds(!this.orbitMode);
    this.player.body.setSize(28, 32);
    this.player.setDepth(8);
    if (loadedPlayerKey) fitSpriteDisplay(this.player, this.orbitMode ? 44 : 52);
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

    // Danger vignette overlay (hidden until low HP)
    this.dangerVignette = this.add.graphics();
    this.dangerVignette.setDepth(24);
    this.dangerVignette.setAlpha(0);
    this.dangerVignette.fillStyle(0xff2233, 1);
    this.dangerVignette.fillRect(0, 0, width, height);
    setPhaserQaState({
      qaTouches: 0,
      orbitChopper: this.orbitMode,
      shooterBg: this.spec.theme.backgroundColor,
    });
    schedulePhaserPlayReady(this, 500, {});
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

  // ─── Texture builders ──────────────────────────────────────────────────────

  private makeStarshipTexture(key: string, w: number, h: number, color: string): void {
    if (this.textures.exists(key)) return;
    const g = this.make.graphics({ x: 0, y: 0 });
    const c = parseInt(color.replace("#", ""), 16);
    const dark = Phaser.Display.Color.ValueToColor(c).darken(28).color;
    const light = Phaser.Display.Color.ValueToColor(c).lighten(22).color;
    // 机身
    g.fillStyle(c, 1);
    g.fillRoundedRect(w * 0.34, h * 0.18, w * 0.32, h * 0.52, 6);
    // 主翼
    g.fillStyle(dark, 1);
    g.fillTriangle(w * 0.12, h * 0.62, w * 0.34, h * 0.42, w * 0.34, h * 0.72);
    g.fillTriangle(w * 0.88, h * 0.62, w * 0.66, h * 0.42, w * 0.66, h * 0.72);
    // 机头
    g.fillStyle(light, 1);
    g.fillTriangle(w * 0.5, h * 0.06, w * 0.38, h * 0.22, w * 0.62, h * 0.22);
    g.fillStyle(0xb8e8ff, 0.95);
    g.fillCircle(w * 0.5, h * 0.28, 6);
    // 引擎焰
    g.fillStyle(0x55ccff, 0.85);
    g.fillEllipse(w * 0.42, h * 0.86, 5, 10);
    g.fillEllipse(w * 0.58, h * 0.86, 5, 10);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  private makeInterceptorTexture(key: string, w: number, h: number, color: string, elite: boolean): void {
    if (this.textures.exists(key)) return;
    const g = this.make.graphics({ x: 0, y: 0 });
    const c = parseInt(color.replace("#", ""), 16);
    g.fillStyle(c, 1);
    g.fillRoundedRect(w * 0.22, h * 0.2, w * 0.56, h * 0.48, 4);
    g.fillTriangle(w * 0.5, h * 0.92, w * 0.18, h * 0.35, w * 0.82, h * 0.35);
    g.fillStyle(Phaser.Display.Color.ValueToColor(c).darken(20).color, 1);
    g.fillRect(w * 0.3, h * 0.38, w * 0.4, 4);
    if (elite) {
      g.fillStyle(0xff8844, 0.9);
      g.fillRect(w * 0.15, h * 0.48, w * 0.7, 6);
      g.lineStyle(2, 0xffcc66, 0.7);
      g.strokeCircle(w / 2, h / 2, w * 0.42);
    }
    g.generateTexture(key, w, h);
    g.destroy();
  }

  private makeShipTexture(key: string, w: number, h: number, color: string) {
    if (this.textures.exists(key)) return;
    const g = this.make.graphics({ x: 0, y: 0 });
    const c = parseInt(color.replace("#", ""), 16);
    g.fillStyle(c, 1);
    // Triangle pointing upward
    g.fillTriangle(w / 2, 0, w, h, 0, h);
    g.fillStyle(c, 0.5);
    g.fillRect(w / 2 - 4, h - 12, 8, 12);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  private makeEnemyTexture(key: string, w: number, h: number, color: string) {
    if (this.textures.exists(key)) return;
    const g = this.make.graphics({ x: 0, y: 0 });
    const c = parseInt(color.replace("#", ""), 16);
    g.fillStyle(c, 1);
    // Triangle pointing downward
    g.fillTriangle(w / 2, h, w, 0, 0, 0);
    g.fillStyle(c, 0.4);
    g.fillRect(w / 2 - 4, 0, 8, 10);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  private makeBossTexture(key: string, w: number, h: number, color: string) {
    if (this.textures.exists(key)) return;
    const g = this.make.graphics({ x: 0, y: 0 });
    const c = parseInt(color.replace("#", ""), 16);
    g.fillStyle(c, 1);
    g.fillRect(8, 0, w - 16, h - 10);
    g.fillRect(0, 6, w, h - 20);
    g.fillTriangle(w / 2, h, w - 8, h - 10, 8, h - 10);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  private makeRectTexture(key: string, w: number, h: number, color: string) {
    if (this.textures.exists(key)) return;
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(parseInt(color.replace("#", ""), 16), 1);
    g.fillRect(0, 0, w, h);
    g.generateTexture(key, w, h);
    g.destroy();
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

    const acts = this.spec.director?.acts ?? [];
    const t = this.winScore > 0 ? Phaser.Math.Clamp(this.totalKills / this.winScore, 0, 1) : 0;
    let idx = 0;
    for (let i = 0; i < acts.length; i += 1) {
      if (acts[i] && t >= acts[i]!.at) idx = i;
    }
    const mods = acts[idx]?.modifiers ?? [];

    const isBossWave = mods.includes("bossWave") || (this.wave > 0 && this.wave % 5 === 0);
    const isEliteWave = mods.includes("eliteWave") || (this.wave > 0 && this.wave % 3 === 0 && !isBossWave);
    const isDensePack = mods.includes("densePack");
    const isRapidFire = mods.includes("rapidFire");

    if (isRapidFire) {
      this.currentEnemyFireDelay = Math.max(300, this.enemyShotIntervalMs * 0.5);
    } else {
      this.currentEnemyFireDelay = Math.max(500, this.enemyShotIntervalMs);
    }

    const label = acts[idx]?.label;
    if (label && idx !== this.actIndex) {
      this.actIndex = idx;
      this.banner.show({ title: label, message: hudShooterWave(this.uiLocale, this.wave), ms: 2000 });
      const sections = ["intro", "build", "drop", "climax"] as const;
      this.soundscape?.setSection(sections[idx] ?? "intro");
    } else {
      const waveBanner = shooterWaveBanner(
        this.uiLocale,
        this.wave,
        isBossWave ? "boss" : isEliteWave ? "elite" : "normal",
      );
      this.banner.show({ title: waveBanner.title, message: waveBanner.message, ms: 1600 });
    }
    this.soundscape?.triggerWaveStart(Math.max(0, this.wave - 1), Math.max(4, Math.ceil(this.winScore / 10)));

    if (isBossWave) {
      this.spawnBoss();
    } else {
      const cols = isDensePack ? 7 : 5;
      const rows = isDensePack ? 3 : Math.min(2 + Math.floor(this.wave * 0.4), 4);
      this.spawnFormation(cols, rows, isEliteWave);
    }

    this.refreshHud();
  }

  private spawnFormation(cols: number, rows: number, elite: boolean) {
    if (this.orbitMode) {
      const count = cols * rows;
      for (let i = 0; i < count; i += 1) {
        const angle = seededFloatBetween(this.runtimeRng, 0, Math.PI * 2);
        const dist = seededFloatBetween(this.runtimeRng, 0.35, 0.88);
        const x = this.planetCx + Math.cos(angle) * this.planetRx * dist;
        const y = this.planetCy + Math.sin(angle) * this.planetRy * dist;
        const key = elite ? "texElite" : this.enemySpriteKey;
        const hp = elite ? 2 : 1;
        const e = this.enemies.create(x, y, key) as Phaser.Physics.Arcade.Image;
        e.setDepth(5);
        if (key === "texHazard") fitSpriteDisplay(e, elite ? 36 : 30);
        e.setScale(0.85);
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
    const enemyW = elite ? 36 : 30;
    const totalW = cols * (enemyW + 18) - 18;
    const startX = (width - totalW) / 2 + enemyW / 2;
    let count = 0;

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const x = startX + col * (enemyW + 18);
        const y = -40 - row * 48;
        const key = elite ? "texElite" : this.enemySpriteKey;
        const hp = elite ? 2 : 1;
        const e = this.enemies.create(x, y, key) as Phaser.Physics.Arcade.Image;
        e.setDepth(5);
        if (key === "texHazard") fitSpriteDisplay(e, elite ? 36 : 30);
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
    const boss = this.enemies.create(x, -80, "texBoss") as Phaser.Physics.Arcade.Image;
    boss.setDepth(5);
    if (boss.width > 80) fitSpriteDisplay(boss, 68);
    boss.setScale(1.2);
    const hp = 10 + Math.floor(this.wave * 1.5);
    boss.setData("hp", hp);
    boss.setData("maxHp", hp);
    boss.setData("isBoss", true);
    boss.setData("entryY", 120);
    boss.setData("driftPhase", 0);
    boss.setData("driftAmp", 80);
    boss.setData("baseX", width / 2);
    this.waveEnemiesLeft = 1;
    this.soundscape?.triggerEvent("boss");
  }

  // ─── Combat ────────────────────────────────────────────────────────────────

  private firePlayerBullet() {
    if (this.finished) return;
    if (this.shotsFired % 4 === 0) playBleep("fire");
    this.shotsFired += 1;
    setPhaserQaState({ qaTouches: this.shotsFired });
    const isBurst = this.currentFireDelay <= 140;
    const spread = this.time.now < this.supportWingUntil ? [-18, 0, 18] : isBurst ? [-12, 0, 12] : [0];
    if (isBurst) {
      juiceShake(this, { durationMs: 36, intensity: 0.0018 });
    }
    for (const offset of spread) {
      const speed = isBurst ? this.bulletSpeed * 1.4 : this.bulletSpeed;
      if (this.orbitMode) {
        const aim = this.orbitAngle + Math.PI / 2 + offset * 0.004;
        const dx = Math.cos(aim);
        const dy = Math.sin(aim);
        const b = this.playerBullets.get(
          this.player.x + dx * 10,
          this.player.y + dy * 10,
          "texPlayerBullet",
        ) as Phaser.Physics.Arcade.Image | null;
        if (!b) continue;
        b.setActive(true);
        b.setVisible(true);
        b.setDepth(7);
        b.setRotation(aim + Math.PI / 2);
        (b.body as Phaser.Physics.Arcade.Body).setVelocity(dx * speed, dy * speed);
        continue;
      }
      const b = this.playerBullets.get(
        this.player.x + offset,
        this.player.y - 20,
        "texPlayerBullet",
      ) as Phaser.Physics.Arcade.Image | null;
      if (!b) continue;
      b.setActive(true);
      b.setVisible(true);
      b.setDepth(7);
      (b.body as Phaser.Physics.Arcade.Body).setVelocityY(-speed);
      (b.body as Phaser.Physics.Arcade.Body).setVelocityX(offset * 1.5);
    }
  }

  private fireEnemyBullet() {
    if (this.finished) return;
    const list = this.enemies.getChildren();
    if (!list.length) return;
    const e = list[Phaser.Math.Between(0, list.length - 1)] as Phaser.Physics.Arcade.Image;
    if (!e?.active) return;
    if (e.y < 0) return;

    const b = this.enemyBullets.get(e.x, e.y + 16, "texEnemyBullet") as Phaser.Physics.Arcade.Image | null;
    if (!b) return;
    b.setActive(true);
    b.setVisible(true);
    b.setDepth(6);
    const speed = this.enemySpeed * 1.6 * (1 + this.intensity * 0.3);
    (b.body as Phaser.Physics.Arcade.Body).setVelocityY(speed);
    (b.body as Phaser.Physics.Arcade.Body).setVelocityX(Phaser.Math.Between(-40, 40));
  }

  private onBulletHitEnemy(bullet: Phaser.Physics.Arcade.Image, enemy: Phaser.Physics.Arcade.Image) {
    if (this.finished) return;
    if (!bullet.active || !enemy.active) return;

    bullet.destroy();
    const hp = (enemy.getData("hp") as number) - 1;
    juiceHit(this, {
      x: enemy.x,
      y: enemy.y,
      colorHex: themeParticleHex(this.spec),
      rng: this.runtimeRng,
      large: Boolean(enemy.getData("isBoss")),
    });

    if (hp <= 0) {
      const isBoss = Boolean(enemy.getData("isBoss"));
      this.fxExplosion(enemy.x, enemy.y, isBoss);
      enemy.destroy();
      this.waveEnemiesLeft = Math.max(0, this.waveEnemiesLeft - 1);
      this.totalKills += 1;
      this.score += (isBoss ? 10 : 1) * this.scoreMult;
      playBleep(isBoss ? "win" : "explode");
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

  private addStarfield() {
    const { width, height } = this.scale;
    const raw = this.spec.theme.particleTint?.replace("#", "") ?? "69746c";
    const parsed = parseInt(raw, 16);
    const tint = Number.isFinite(parsed) ? parsed : 0x8888aa;
    for (let i = 0; i < 120; i += 1) {
      const x = Phaser.Math.Between(4, width - 4);
      const y = Phaser.Math.Between(4, height - 4);
      const s = Phaser.Math.FloatBetween(0.8, 2.2);
      const a = Phaser.Math.FloatBetween(0.04, 0.28);
      this.add.rectangle(x, y, s, s, tint, a).setDepth(-12);
    }
    // Scrolling stars
    for (let i = 0; i < 30; i += 1) {
      const star = this.add.rectangle(
        Phaser.Math.Between(4, width - 4),
        Phaser.Math.Between(4, height - 4),
        1.5, Phaser.Math.FloatBetween(4, 10),
        tint, 0.18,
      ).setDepth(-11);
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

  // ─── Director events ───────────────────────────────────────────────────────

  private tickDirectorEvents() {
    const now = this.time.now;
    this.banner.tick();

    if (this.eventType && now >= this.eventUntil) {
      if (this.eventType === "coinRain") this.scoreMult = 1;
      this.banner.show({
        title: tMessage(this.uiLocale, "gameEvents.shooter.eventEnd"),
        ms: 1200,
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
    this.banner.show({ title, message: ev.message ?? "", ms: Math.min(2400, durationMs - 200) });
    applyRuntimeEventImpact(this, ev.type, {
      x: this.player?.x ?? this.scale.width / 2,
      y: this.player?.y ?? this.scale.height * 0.58,
      title,
      spec: this.spec,
      cohesive: this.cohesive,
      strength: ev.strength ?? 0.6,
      rng: this.runtimeRng,
    });

    if (ev.type === "coinRain") {
      this.scoreMult = 2;
      this.coinRainUntil = now + durationMs;
    }
    if (ev.type === "miniBoss") {
      this.spawnBoss();
    }
    if (ev.type === "goalShift") {
      this.burstUntil = now + durationMs;
      this.supportWingUntil = now + durationMs;
      return;
    }

    // 未知类型：仅横幅计时，勿改动 scoreMult / burst 等状态
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
      playBleep("pickup");
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
    this.scoreText.setText(hudScore(this.uiLocale, this.score));
    this.livesText.setText(hudLives(this.uiLocale, this.lives));
    this.waveText.setText(hudShooterWave(this.uiLocale, this.wave));
    const prog = Math.min(this.totalKills, this.winScore);
    this.progressText.setText(hudShooterKills(this.uiLocale, prog, this.winScore));
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
    this.skillText.setText(shooterSkillStatus(this.uiLocale, skillName, status));
    this.skillCdText.setText(
      cdLeft <= 0 ? shooterShiftReady(this.uiLocale) : shooterShiftCooldown(this.uiLocale, (cdLeft / 1000).toFixed(1)),
    );

    const acts = this.spec.director?.acts ?? null;
    const label = acts?.[this.actIndex]?.label;
    this.actText.setText(label ? hudActChapter(this.uiLocale, label) : "");
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

  // ─── Finish ────────────────────────────────────────────────────────────────

  private finish(payload: EndPayload) {
    if (this.finished) return;
    if (this.dangerVignette) {
      this.tweens.killTweensOf(this.dangerVignette);
      this.dangerVignette.setAlpha(0);
    }
    this.finished = true;
    // Cancel pending timers
    if (this.fireTimer) this.fireTimer.destroy();
    if (this.enemyFireTimer) this.enemyFireTimer.destroy();
    this.physics.pause();
    this.hintText.setText(shooterFinishText(this.uiLocale, payload.won));
    if (payload.won) {
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
    this.goalPanel?.update();
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

    // Enemy movement: descend + drift
    const enemies = this.enemies.getChildren();
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

      const entryY = (e.getData("entryY") as number) ?? 100;
      const baseX = (e.getData("baseX") as number) ?? e.x;
      const phase = (e.getData("driftPhase") as number) ?? 0;
      const amp = (e.getData("driftAmp") as number) ?? 30;

      if (e.y < entryY) {
        // Still entering: move down
        const slowMul = time < this.slowUntil ? 0.72 : 1;
        (e.body as Phaser.Physics.Arcade.Body).setVelocityY(this.enemySpeed * 2.5 * slowMul);
        (e.body as Phaser.Physics.Arcade.Body).setVelocityX(0);
      } else {
        // In formation: drift sideways + slow descent
        const drift = Math.sin(time * 0.0008 + phase) * amp;
        const newX = Phaser.Math.Clamp(baseX + drift, 30, this.scale.width - 30);
        e.setX(newX);
        const slowMul = time < this.slowUntil ? 0.72 : 1;
        (e.body as Phaser.Physics.Arcade.Body).setVelocityY(this.enemySpeed * 0.15 * (1 + this.intensity * 0.5) * slowMul);
        (e.body as Phaser.Physics.Arcade.Body).setVelocityX(0);
      }

      // Enemy reaches bottom = player loses a life
      if (e.y > height + 20) {
        e.destroy();
        this.waveEnemiesLeft = Math.max(0, this.waveEnemiesLeft - 1);
        if (!this.finished) this.onPlayerHit();
      }
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
    const estTotalWaves = Math.max(4, Math.ceil(this.winScore / 12));
    this.soundscape?.triggerWaveStart(Math.max(0, this.wave - 1), estTotalWaves);
  }
}
