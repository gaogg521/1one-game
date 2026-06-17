import Phaser from "phaser";
import { playBleep } from "@/game/audio/webBleeps";
import { HudBanner } from "@/game/engine/HudBanner";
import { HudGoalPanel } from "@/game/engine/HudGoalPanel";
import { juiceBurst, juiceFlash, juiceFloater, juiceShake } from "@/game/engine/gameJuice";
import { styleHudText } from "@/game/engine/hudTextStyle";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { AppLocale } from "@/i18n/routing";
import {
  buildCoasterBlueprint,
  coasterPathLength,
  sampleCoasterPath,
  type CoasterPathPoint,
} from "@/lib/coaster-blueprint";
import { type CohesivePresentation } from "@/lib/cohesive-presentation";
import { buildSceneCohesion } from "@/lib/scene-experience";
import { buildSceneGoalGuidance } from "@/lib/scene-goal-guidance";
import { paintCoasterSkyBackdrop } from "@/game/engine/template-theme-visual";
import {
  drawCoasterCartRich,
  drawEndlessRoadObstacle,
  paintCoasterSkyGradient,
} from "@/game/engine/action-visual";
import type { GameSpec } from "@/lib/game-spec";
import {
  bannerCoasterFinishLose,
  bannerCoasterFinishWin,
  hudCoasterSpeed,
  hudEndlessRoadDistance,
  hudScore,
} from "@/lib/i18n/game-hud-labels";
import { runtimeSeedFromSpec, seededFloatBetween, seededIntBetween, seededRandom } from "@/lib/runtime-seed";
import { schedulePhaserPlayReady } from "@/game/engine/phaser-play-ready";
import {
  drawTempleFireflies,
  drawTempleLaneDashes,
  drawTempleChasers,
  drawTempleChaserMeter,
  drawTempleComboBadge,
  drawTempleVinesParallax,
  drawTempleCoinGfx,
  drawTempleCoinHud,
  drawTempleDustPuffs,
  drawTempleObstacleGfx,
  drawTempleObstacleTelegraph,
  drawTempleRailings,
  drawTempleRoad,
  drawTempleRunnerShadow,
  drawTempleScorePanel,
  drawTempleSideRuins,
  drawTempleSkyAndArch,
  drawTempleSpeedLines,
  drawTempleSunVignette,
  drawTempleTurnPrompt,
  drawTempleDeathDim,
  registerTempleRunnerAtlasLoader,
  ensureTempleRunnerFrames,
  RUNNER_FRAME_COUNT,
  spawnTempleDustPuff,
  spawnTempleSpeedLine,
  templeLaneX,
  templePathSample,
  templeRunnerTextureKey,
  updateTempleDustPuffs,
  updateTempleSpeedLines,
  type TempleDustPuff,
  type TempleRunnerPose,
  type TempleSpeedLine,
} from "@/game/engine/temple-run-visual";
import {
  createTempleRoadShader,
  destroyTempleRoadShader,
  updateTempleRoadShader,
  type TempleRoadShaderHandle,
} from "@/game/engine/temple-run-road-shader";
import { templeWaveAt, type TempleObstacleKind } from "@/game/engine/temple-run-patterns";
import { crashyWaveAt, type CrashyObstacleStyle } from "@/game/engine/crashy-road-patterns";
import {
  drawCrashyDodgeCombo,
  drawCrashyLaneMarkings,
  drawCrashyLaneWarning,
  drawCrashyLivesHud,
  drawCrashyObstacleGfx,
  drawCrashyRoadBackdrop,
} from "@/game/engine/crashy-road-visual";
import { bindLaneRunnerInput, createWasdKeys, type WasdKeys } from "@/game/engine/phaser-input";
import {
  drawRunnerLeaderboardPanel,
  formatLeaderboardRow,
} from "@/game/engine/runner-leaderboard-visual";
import {
  drawRunnerDeathRecapPanel,
  runnerDeathRecapLines,
  runnerDeathRecapTitle,
} from "@/game/engine/runner-death-recap-visual";
import {
  buildRunnerRunRecap,
  isRunnerLeaderboardVariant,
  loadRunnerLeaderboard,
  recordRunnerLeaderboardEntry,
  type RunnerDeathCause,
  type RunnerLeaderboardEntry,
  type RunnerLeaderboardSnapshot,
  type RunnerRunRecap,
} from "@/lib/runner-leaderboard";
import { setPhaserQaState } from "@/game/engine/phaser-qa-state";

type EndPayload = {
  score: number;
  won: boolean;
  runnerLeaderboard?: RunnerLeaderboardSnapshot;
  runnerRecap?: RunnerRunRecap;
};
type RoadObstacleKind = TempleObstacleKind;
type RoadObstacle = {
  lane: number;
  z: number;
  w: number;
  h: number;
  kind: RoadObstacleKind;
  crashyStyle?: CrashyObstacleStyle;
};
type RoadPickup = { lane: number; z: number };

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
}

/** 伪 3D 空中轨道竞速：第三人称跟车、Boost/Brake、计时完赛 */
export class CoasterScene extends Phaser.Scene {
  public backgroundUrl: string | null = null;
  public projectId: string | null = null;
  public uiLocale: AppLocale = "zh-Hans";

  private readonly spec: GameSpec;
  private readonly onEnd: (r: EndPayload) => void;
  private readonly soundscape: GameSoundscape | null;

  private path: CoasterPathPoint[] = [];
  private trackProgress = 0;
  private speed = 0;
  private baseSpeed = 42;
  private maxSpeed = 118;
  private minSpeed = 8;
  private boostPower = 0;
  private brakePower = 0;
  private elapsed = 0;
  private finished = false;
  private thirdPerson = true;

  private scoreText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private speedText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private templeHintBase = "";
  private banner!: HudBanner;
  private goalPanel!: HudGoalPanel;
  private cohesive!: CohesivePresentation;
  private trackGfx!: Phaser.GameObjects.Graphics;
  private decorGfx!: Phaser.GameObjects.Graphics;
  private cartGfx!: Phaser.GameObjects.Graphics;
  private clouds: Array<{ x: number; y: number; r: number; sp: number }> = [];

  private keyBoost!: Phaser.Input.Keyboard.Key;
  private keyBrake!: Phaser.Input.Keyboard.Key;
  private keyV!: Phaser.Input.Keyboard.Key;
  private keyLaneLeft!: Phaser.Input.Keyboard.Key;
  private keyLaneRight!: Phaser.Input.Keyboard.Key;

  private endlessMode = false;
  private distanceGoal = 600;
  private distanceM = 0;
  private lane = 0;
  private targetLane = 0;
  private roadObstacles: RoadObstacle[] = [];
  private roadPickups: RoadPickup[] = [];
  private obstacleSpawnCd = 0;
  private roadLives = 3;
  private pointerDownX = 0;
  private pointerDownY = 0;
  private coins = 0;
  private runnerJump = 0;
  private runnerSlide = 0;
  private runnerSlideT = 0;
  private roadCurvePhase = 0;
  private runAnimPhase = 0;
  private keyJump!: Phaser.Input.Keyboard.Key;
  private keySlide!: Phaser.Input.Keyboard.Key;
  private runnerSprite: Phaser.GameObjects.Sprite | null = null;
  private coinHudGfx: Phaser.GameObjects.Graphics | null = null;
  private coinHudText: Phaser.GameObjects.Text | null = null;
  private templeComboText: Phaser.GameObjects.Text | null = null;
  private templeRoadShader: TempleRoadShaderHandle | null = null;
  private coinPopT = 0;
  private scorePopT = 0;
  private camPulseT = 0;
  private lastTempleScore = 0;
  private coinStreak = 0;
  private coinStreakT = 0;
  private comboPopT = 0;
  private templeCoinBonus = 0;
  private templeDead = false;
  private templeRunFinalized = false;
  private templeDeathFinalizeEvent: Phaser.Time.TimerEvent | null = null;
  private templeInvulnT = 0;
  private templePatternIdx = 0;
  private templeScrollPhase = 0;
  private templeRunScore = 0;
  private chaserPressure = 0;
  private templeTurnCd = 16;
  private activeTurn: { dir: -1 | 1; ttl: number; maxTtl: number; resolved: boolean } | null = null;
  private wasdKeys: WasdKeys | null = null;
  private runnerFrameKeys: readonly string[] = [];
  private speedLines: TempleSpeedLine[] = [];
  private speedLineGfx: Phaser.GameObjects.Graphics | null = null;
  private dustPuffs: TempleDustPuff[] = [];
  private dustGfx: Phaser.GameObjects.Graphics | null = null;
  private vignetteGfx: Phaser.GameObjects.Graphics | null = null;
  private chaserGfx: Phaser.GameObjects.Graphics | null = null;
  private templeCurveBias = 0;
  private templeHintedKinds = new Set<RoadObstacleKind>();

  private lastMilestone = 0;

  private nearMissCd = 0;

  private bankIntensity = 1;
  private richVisuals = false;
  private templeRunMode = false;
  private crashyRoadMode = false;
  private crashyPatternIdx = 0;
  private crashyScrollPhase = 0;
  private crashyNearStreak = 0;
  private crashyNearStreakT = 0;
  private crashyDodgeBonus = 0;
  private crashyHudGfx: Phaser.GameObjects.Graphics | null = null;
  private crashyInvulnT = 0;
  private maxCoinStreakRun = 0;
  private maxCrashyNearStreakRun = 0;
  private leaderboardEntries: RunnerLeaderboardEntry[] = [];
  private leaderboardGfx: Phaser.GameObjects.Graphics | null = null;
  private leaderboardTitleText: Phaser.GameObjects.Text | null = null;
  private leaderboardRowTexts: Phaser.GameObjects.Text[] = [];
  private deathRecapGfx: Phaser.GameObjects.Graphics | null = null;
  private deathRecapTitleText: Phaser.GameObjects.Text | null = null;
  private deathRecapLineTexts: Phaser.GameObjects.Text[] = [];
  private templeDeathDimGfx: Phaser.GameObjects.Graphics | null = null;
  private runnerDeathCause: RunnerDeathCause | null = null;
  private runtimeRng!: () => number;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape: GameSoundscape | null) {
    super({ key: "CoasterScene" });
    this.spec = spec;
    this.onEnd = onEnd;
    this.soundscape = soundscape;
  }

  preload() {
    if (this.spec.samplePlayProfile?.variantId === "temple-relic-runner") {
      registerTempleRunnerAtlasLoader(this);
    }
  }

  create() {
    this.cohesive = buildSceneCohesion(this.spec);
    this.runtimeRng = seededRandom(runtimeSeedFromSpec(this.spec));

    const bp = this.spec.coaster ?? buildCoasterBlueprint({ spec: this.spec });
    this.path = bp.path;
    this.endlessMode = bp.mode === "endlessRoad";
    this.distanceGoal = bp.distanceGoal ?? 600;
    const coasterPf = this.spec.samplePlayProfile?.coaster;
    const speedBoost = coasterPf?.speedBoost ?? 1;
    this.bankIntensity = coasterPf?.bankIntensity ?? 1;
    const variantId = this.spec.samplePlayProfile?.variantId;
    this.templeRunMode = variantId === "temple-relic-runner";
    this.crashyRoadMode = variantId === "crashy-roads";
    this.richVisuals = this.crashyRoadMode || this.templeRunMode;
    if (this.templeRunMode) {
      this.roadLives = 1;
      this.obstacleSpawnCd = 2.8;
      this.distanceGoal = 999_999;
    } else if (this.crashyRoadMode) {
      this.roadLives = 3;
      this.obstacleSpawnCd = 2.2;
      this.distanceGoal = 999_999;
    }
    this.baseSpeed = (38 + (this.spec.director?.intensity ?? 0.55) * 22) * speedBoost;
    this.maxSpeed = this.endlessMode ? 95 : 95 + (this.spec.gameplay.playerSpeed - 300) * 0.15;
    this.speed = this.baseSpeed * 0.6;

    const w = this.scale.width;
    const h = this.scale.height;

    paintCoasterSkyBackdrop(this, this.spec, w, h, this.endlessMode);

    this.trackGfx = this.add.graphics().setDepth(2);
    this.decorGfx = this.add.graphics().setDepth(1);
    this.cartGfx = this.add.graphics().setDepth(5);

    for (let i = 0; i < 14; i += 1) {
      this.clouds.push({
        x: seededIntBetween(this.runtimeRng, 0, w),
        y: seededIntBetween(this.runtimeRng, 20, Math.floor(h * 0.42)),
        r: seededIntBetween(this.runtimeRng, 18, 42),
        sp: seededFloatBetween(this.runtimeRng, 0.08, 0.22),
      });
    }

    this.banner = new HudBanner(this, this.cohesive.banner);
    const guidance = buildSceneGoalGuidance(this.spec, this.uiLocale);
    this.goalPanel = new HudGoalPanel(this, guidance, this.cohesive, {
      y: this.templeRunMode ? 102 : 112,
      hidden: this.templeRunMode,
    });
    this.hintText = styleHudText(
      this.add
        .text(w / 2, h - 28, guidance.bottomHint, { fontSize: "11px" })
        .setOrigin(0.5),
    );
    if (this.templeRunMode) this.templeHintBase = guidance.bottomHint;

    const kb = this.input.keyboard;
    if (kb) {
      this.keyBoost = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E);
      this.keyBrake = kb.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
      this.keyV = kb.addKey(Phaser.Input.Keyboard.KeyCodes.V);
      if (this.endlessMode) {
        this.keyLaneLeft = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        this.keyLaneRight = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
        if (this.templeRunMode) {
          this.keyJump = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
          this.keySlide = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);
        }
      }
      kb.addCapture([
        Phaser.Input.Keyboard.KeyCodes.SPACE,
        Phaser.Input.Keyboard.KeyCodes.E,
        Phaser.Input.Keyboard.KeyCodes.Q,
        Phaser.Input.Keyboard.KeyCodes.V,
        Phaser.Input.Keyboard.KeyCodes.UP,
        Phaser.Input.Keyboard.KeyCodes.DOWN,
      ]);
    }

    this.banner.show({
      ...guidance.banner,
      ms: this.templeRunMode ? 1600 : this.crashyRoadMode ? 1800 : guidance.banner.ms,
    });
    this.scoreText = styleHudText(this.add.text(16, 12, this.spec.title, { fontSize: "20px" }));
    this.timerText = styleHudText(
      this.add.text(w / 2, 14, formatTime(0), { fontSize: "22px" }).setOrigin(0.5, 0),
    );
    this.speedText = styleHudText(
      this.add.text(16, 44, hudCoasterSpeed(this.uiLocale, 0), { fontSize: "14px" }),
    );
    setPhaserQaState({ coasterDistance: 0, coasterLives: this.roadLives, coasterCoins: 0 });
    schedulePhaserPlayReady(this, 500, { coasterDistance: 0, coasterLives: this.roadLives, coasterCoins: 0 });

    if (this.templeRunMode) {
      this.wasdKeys = createWasdKeys(this);
      this.runnerFrameKeys = ensureTempleRunnerFrames(this);
      this.runnerSprite = this.add.sprite(w / 2, h - 100, this.runnerFrameKeys[0]!);
      this.runnerSprite.setDepth(6);

      this.speedLineGfx = this.add.graphics().setDepth(1.5);
      this.chaserGfx = this.add.graphics().setDepth(4.5);
      this.dustGfx = this.add.graphics().setDepth(5.2);
      this.vignetteGfx = this.add.graphics().setDepth(22).setScrollFactor(0);
      for (let i = 0; i < 8; i += 1) {
        this.speedLines.push(spawnTempleSpeedLine(w, h, this.runtimeRng));
      }

      bindLaneRunnerInput(this, this.wasdKeys, {
        onLaneLeft: () => this.shiftLane(-1),
        onLaneRight: () => this.shiftLane(1),
        onJump: () => this.triggerTempleJump(),
        onSlide: () => this.triggerTempleSlide(),
        onRestart: () => this.tryRestartTempleRun(),
        canAct: () => !this.templeDead && !this.finished,
      });

      this.coinHudGfx = this.add.graphics().setDepth(20).setScrollFactor(0);
      this.templeRoadShader = createTempleRoadShader(this, w, h);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        destroyTempleRoadShader(this.templeRoadShader);
        this.templeRoadShader = null;
      });
      this.coinHudText = styleHudText(
        this.add
          .text(w - 22, 30, "0", { fontSize: "18px", color: "#fcd34d", fontStyle: "bold" })
          .setOrigin(1, 0.5)
          .setDepth(21)
          .setScrollFactor(0),
      );
      this.templeComboText = styleHudText(
        this.add
          .text(w / 2, 56, "", { fontSize: "12px", color: "#fcd34d" })
          .setOrigin(0.5, 0)
          .setDepth(21)
          .setScrollFactor(0)
          .setVisible(false),
      );
      this.templeInvulnT = 2.4;
      this.chaserPressure = 0;
      this.templeTurnCd = 16;
      this.activeTurn = null;
      this.scoreText
        .setPosition(w / 2, 34)
        .setOrigin(0.5, 0.5)
        .setFontSize(22)
        .setColor("#fef3c7")
        .setText("0");
      this.timerText.setVisible(false);
      this.speedText.setVisible(false);
    }

    if (this.crashyRoadMode) {
      this.wasdKeys = createWasdKeys(this);
      bindLaneRunnerInput(this, this.wasdKeys, {
        onLaneLeft: () => this.shiftLane(-1),
        onLaneRight: () => this.shiftLane(1),
        onJump: () => undefined,
        onSlide: () => undefined,
        canAct: () => !this.finished,
      });
      this.crashyHudGfx = this.add.graphics().setDepth(20).setScrollFactor(0);
      this.scoreText.setPosition(w - 16, 12).setOrigin(1, 0).setFontSize(18);
      this.speedText.setPosition(16, 40).setVisible(true).setFontSize(13);
    }

    if (this.templeRunMode || this.crashyRoadMode) {
      const variantId = this.spec.samplePlayProfile?.variantId;
      if (variantId && isRunnerLeaderboardVariant(variantId)) {
        this.leaderboardEntries = loadRunnerLeaderboard(variantId);
        this.leaderboardGfx = this.add.graphics().setDepth(21).setScrollFactor(0);
        const lbTitle = this.uiLocale === "zh-Hans" ? "本地榜" : "Best";
        this.leaderboardTitleText = styleHudText(
          this.add
            .text(w - 14, 68, lbTitle, { fontSize: "10px", color: "#fbbf24" })
            .setOrigin(1, 0)
            .setDepth(22)
            .setScrollFactor(0),
        );
        for (let i = 0; i < 3; i += 1) {
          this.leaderboardRowTexts.push(
            styleHudText(
              this.add
                .text(w - 14, 82 + i * 13, "—", { fontSize: "9px", color: "#d6d3d1" })
                .setOrigin(1, 0)
                .setDepth(22)
                .setScrollFactor(0),
            ),
          );
        }
        this.refreshLeaderboardHud();
        this.deathRecapGfx = this.add.graphics().setDepth(23).setScrollFactor(0);
        this.templeDeathDimGfx = this.add.graphics().setDepth(19).setScrollFactor(0);
        this.deathRecapTitleText = styleHudText(
          this.add
            .text(w / 2, h * 0.52, "", { fontSize: "13px", color: "#fef3c7", fontStyle: "bold" })
            .setOrigin(0.5, 0.5)
            .setDepth(24)
            .setScrollFactor(0)
            .setVisible(false),
        );
        for (let i = 0; i < 6; i += 1) {
          this.deathRecapLineTexts.push(
            styleHudText(
              this.add
                .text(w / 2, h * 0.52, "", { fontSize: "11px", color: "#e2e8f0" })
                .setOrigin(0, 0.5)
                .setDepth(24)
                .setScrollFactor(0)
                .setVisible(false),
            ),
          );
        }
      }
    }

    if (this.endlessMode && !this.templeRunMode && !this.crashyRoadMode) {
      this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
        this.pointerDownX = p.x;
        this.pointerDownY = p.y;
      });
      this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
        if (this.finished) return;
        const ww = this.scale.width;
        const dx = p.x - this.pointerDownX;
        if (Math.abs(dx) > 36) {
          this.shiftLane(dx > 0 ? 1 : -1);
        } else if (p.x < ww * 0.42) {
          this.shiftLane(-1);
        } else if (p.x > ww * 0.58) {
          this.shiftLane(1);
        }
      });
    }
  }

  private triggerTempleJump() {
    if (this.runnerJump <= 0.05 && this.runnerSlideT <= 0) {
      this.runnerJump = 1;
      playBleep("pickup");
      juiceShake(this, { intensity: 0.006, durationMs: 70 });
      if (this.runnerSprite) {
        this.dustPuffs.push(spawnTempleDustPuff(this.runnerSprite.x, this.runnerSprite.y + 20, this.runtimeRng));
        this.dustPuffs.push(spawnTempleDustPuff(this.runnerSprite.x - 8, this.runnerSprite.y + 22, this.runtimeRng));
      }
    }
  }

  private triggerTempleSlide() {
    if (this.runnerJump <= 0.05 && this.runnerSlideT <= 0) {
      this.runnerSlideT = 0.62;
      this.runnerSlide = 1;
      playBleep("pickup");
      juiceShake(this, { intensity: 0.004, durationMs: 55 });
    }
  }

  private templeCurvePhase(): number {
    return this.roadCurvePhase + this.templeCurveBias;
  }

  private wavePaceScale(): number {
    return 1 + Math.min(0.45, this.distanceM / 900);
  }

  private buildRunnerEndPayload(score: number, won: boolean): EndPayload {
    const variantId = this.spec.samplePlayProfile?.variantId;
    if (!variantId || !isRunnerLeaderboardVariant(variantId)) {
      return { score, won };
    }
    const combo = this.templeRunMode ? this.maxCoinStreakRun : this.maxCrashyNearStreakRun;
    const prevBestScore = loadRunnerLeaderboard(variantId)[0]?.score ?? 0;
    const cause: RunnerDeathCause =
      this.runnerDeathCause ?? (won ? "crash" : this.crashyRoadMode ? "lives" : "crash");
    const recap = buildRunnerRunRecap({
      variantId,
      score,
      distance: Math.round(this.distanceM),
      coins: this.templeRunMode ? this.coins : undefined,
      maxCombo: combo,
      cause,
      survivalSec: Math.round(this.elapsed * 10) / 10,
      prevBestScore,
    });
    const snapshot = recordRunnerLeaderboardEntry(variantId, {
      score,
      combo,
      distance: Math.round(this.distanceM),
      coins: this.templeRunMode ? this.coins : undefined,
    });
    this.leaderboardEntries = snapshot.entries;
    this.refreshLeaderboardHud();
    setPhaserQaState({
      runnerLeaderboardRank: snapshot.rank,
      runnerLeaderboardBest: snapshot.isNewBest,
      runnerRecapScore: recap.score,
      runnerRecapDistance: recap.distance,
    });
    return { score, won, runnerLeaderboard: snapshot, runnerRecap: recap };
  }

  private buildLiveRunnerRecap(score: number): RunnerRunRecap | null {
    const variantId = this.spec.samplePlayProfile?.variantId;
    if (!variantId || !isRunnerLeaderboardVariant(variantId) || !this.runnerDeathCause) return null;
    const combo = this.templeRunMode ? this.maxCoinStreakRun : this.maxCrashyNearStreakRun;
    const prevBestScore = loadRunnerLeaderboard(variantId)[0]?.score ?? 0;
    return buildRunnerRunRecap({
      variantId,
      score,
      distance: Math.round(this.distanceM),
      coins: this.templeRunMode ? this.coins : undefined,
      maxCombo: combo,
      cause: this.runnerDeathCause,
      survivalSec: Math.round(this.elapsed * 10) / 10,
      prevBestScore,
    });
  }

  private setTempleLiveHudVisible(visible: boolean) {
    if (!this.templeRunMode) return;
    this.scoreText.setVisible(visible);
    this.coinHudText?.setVisible(visible);
    this.templeComboText?.setVisible(visible && this.coinStreak >= 2);
    this.hintText.setVisible(visible);
    this.goalPanel?.setVisible(visible);
    this.leaderboardGfx?.setVisible(visible);
    this.leaderboardTitleText?.setVisible(visible);
    for (const row of this.leaderboardRowTexts) row.setVisible(visible);
  }

  private refreshDeathRecapHud(score: number) {
    const recap = this.buildLiveRunnerRecap(score);
    const w = this.scale.width;
    const h = this.scale.height;
    const zh = this.uiLocale === "zh-Hans";
    this.deathRecapGfx?.clear();
    for (const line of this.deathRecapLineTexts) line.setVisible(false);
    this.deathRecapTitleText?.setVisible(false);
    if (!recap || !this.deathRecapGfx) return;

    const panel = drawRunnerDeathRecapPanel(this.deathRecapGfx, w, h, recap, zh);
    this.deathRecapTitleText?.setText(runnerDeathRecapTitle(recap, zh)).setVisible(true);
    this.deathRecapTitleText?.setPosition(panel.x + panel.panelW / 2, panel.y + 16);

    const lines = runnerDeathRecapLines(recap, zh);
    for (let i = 0; i < this.deathRecapLineTexts.length; i += 1) {
      const row = this.deathRecapLineTexts[i];
      const text = lines[i];
      if (!row) continue;
      if (text) {
        row.setText(text).setVisible(true);
        row.setPosition(panel.x + 14, panel.y + 38 + i * 14);
        row.setColor(
          i === lines.length - 1 && recap.beatPrevBest
            ? "#fcd34d"
            : i === lines.length - 1
              ? "#94a3b8"
              : "#e2e8f0",
        );
      } else {
        row.setVisible(false);
      }
    }
  }

  private refreshLeaderboardHud() {
    const w = this.scale.width;
    const zh = this.uiLocale === "zh-Hans";
    this.leaderboardGfx?.clear();
    if (this.leaderboardGfx) {
      drawRunnerLeaderboardPanel(this.leaderboardGfx, w - 8, 64, 118, this.leaderboardEntries, zh);
    }
    for (let i = 0; i < this.leaderboardRowTexts.length; i += 1) {
      const entry = this.leaderboardEntries[i];
      const row = this.leaderboardRowTexts[i];
      if (!row) continue;
      if (entry) {
        row.setText(formatLeaderboardRow(entry, i + 1, zh)).setColor(i === 0 ? "#fcd34d" : "#d6d3d1");
      } else {
        row.setText("—").setColor("#57534e");
      }
    }
  }

  private tryRestartTempleRun() {
    if (!this.templeDead || this.templeRunFinalized) return;
    this.restartTempleRun();
  }

  private scheduleTempleDeathFinalize() {
    this.templeDeathFinalizeEvent?.remove();
    this.templeDeathFinalizeEvent = this.time.delayedCall(3000, () => this.finalizeTempleRunSession());
  }

  private cancelTempleDeathFinalize() {
    this.templeDeathFinalizeEvent?.remove();
    this.templeDeathFinalizeEvent = null;
  }

  private finalizeTempleRunSession() {
    if (!this.templeDead || this.templeRunFinalized) return;
    this.templeRunFinalized = true;
    const score = this.templeRunScore + this.coins * 50;
    this.onEnd(this.buildRunnerEndPayload(score, false));
  }

  private restartTempleRun() {
    this.cancelTempleDeathFinalize();
    this.templeDead = false;
    this.templeInvulnT = 1.35;
    this.finished = false;
    setPhaserQaState({ templeDead: false });
    this.roadObstacles = [];
    this.roadPickups = [];
    this.lane = 0;
    this.targetLane = 0;
    this.distanceM = 0;
    this.elapsed = 0;
    this.coins = 0;
    this.templeRunScore = 0;
    this.lastTempleScore = 0;
    this.scorePopT = 0;
    this.camPulseT = 0;
    this.cameras.main.setZoom(1);
    this.coinStreak = 0;
    this.coinStreakT = 0;
    this.comboPopT = 0;
    this.templeCoinBonus = 0;
    this.speed = this.baseSpeed * 0.5;
    this.runnerJump = 0;
    this.runnerSlide = 0;
    this.runnerSlideT = 0;
    this.templePatternIdx = 0;
    this.templeCurveBias = 0;
    this.maxCoinStreakRun = 0;
    this.templeComboText?.setVisible(false);
    this.templeHintedKinds.clear();
    this.runnerDeathCause = null;
    this.deathRecapGfx?.clear();
    for (const line of this.deathRecapLineTexts) line.setVisible(false);
    this.deathRecapTitleText?.setVisible(false);
    this.setTempleLiveHudVisible(true);
    this.obstacleSpawnCd = 2.4;
    this.chaserPressure = 0;
    this.templeTurnCd = 14;
    this.activeTurn = null;
    this.runnerSprite?.anims.stop();
    this.banner.show({
      title: this.spec.title,
      message: this.uiLocale === "zh-Hans" ? "再跑一局！" : "Run again!",
      ms: 900,
    });
  }

  private templeCrash() {
    if (this.templeDead) return;
    this.templeDead = true;
    this.runnerDeathCause = "crash";
    this.coinStreak = 0;
    this.coinStreakT = 0;
    this.comboPopT = 0;
    this.templeCoinBonus = 0;
    this.activeTurn = null;
    this.runnerSprite?.anims.stop();
    juiceShake(this, { intensity: 0.028, durationMs: 280 });
    juiceFlash(this, { r: 239, g: 68, b: 68 }, { durationMs: 180 });
    playBleep("hit");
    setPhaserQaState({
      templeRunScore: this.templeRunScore,
      templeDead: true,
      coasterDistance: Math.round(this.distanceM),
    });
    this.scheduleTempleDeathFinalize();
    this.setTempleLiveHudVisible(false);
    const liveScore = this.templeRunScore + this.coins * 50;
    this.refreshDeathRecapHud(liveScore);
    this.banner.show({
      title: this.uiLocale === "zh-Hans" ? "撞到了!" : "Crashed!",
      message:
        this.uiLocale === "zh-Hans"
          ? `得分 ${this.templeRunScore} · 空格重开`
          : `Score ${this.templeRunScore} · Space to restart`,
      ms: 2800,
      anchor: "bottom",
    });
  }

  private templeCaught() {
    if (this.templeDead) return;
    this.templeDead = true;
    this.runnerDeathCause = "caught";
    this.coinStreak = 0;
    this.coinStreakT = 0;
    this.activeTurn = null;
    this.runnerSprite?.anims.stop();
    juiceShake(this, { intensity: 0.035, durationMs: 320 });
    juiceFlash(this, { r: 185, g: 28, b: 28 }, { durationMs: 220 });
    playBleep("hit");
    setPhaserQaState({
      templeRunScore: this.templeRunScore,
      templeDead: true,
      coasterDistance: Math.round(this.distanceM),
    });
    this.scheduleTempleDeathFinalize();
    this.setTempleLiveHudVisible(false);
    const liveScore = this.templeRunScore + this.coins * 50;
    this.refreshDeathRecapHud(liveScore);
    this.banner.show({
      title: this.uiLocale === "zh-Hans" ? "被追上了!" : "Caught!",
      message:
        this.uiLocale === "zh-Hans"
          ? `得分 ${this.templeRunScore} · 空格重开`
          : `Score ${this.templeRunScore} · Space to restart`,
      ms: 2800,
      anchor: "bottom",
    });
  }

  private resolveTempleTurn(delta: -1 | 1) {
    const turn = this.activeTurn;
    if (!turn || turn.resolved || this.templeDead) return;
    if (delta !== turn.dir) return;
    turn.resolved = true;
    this.chaserPressure = Math.max(0, this.chaserPressure - 0.22);
    this.templeCoinBonus += 45;
    juiceFloater(
      this,
      this.scale.width / 2,
      this.scale.height * 0.38,
      this.uiLocale === "zh-Hans" ? "漂移 +45" : "Drift +45",
      "#38bdf8",
    );
    playBleep("pickup");
  }

  private updateTempleChaserAndTurn(dt: number) {
    if (this.templeDead || this.templeInvulnT > 0) return;

    this.chaserPressure = Math.min(1, this.chaserPressure + dt * 0.0075);
    if (this.chaserPressure >= 1) {
      this.templeCaught();
      return;
    }

    if (this.elapsed < 12) return;

    const turn = this.activeTurn;
    if (turn) {
      turn.ttl -= dt;
      if (turn.resolved) {
        this.activeTurn = null;
        this.templeTurnCd = 11 + this.runtimeRng() * 7;
        return;
      }
      if (turn.ttl <= 0) {
        this.activeTurn = null;
        this.chaserPressure = Math.min(1, this.chaserPressure + 0.14);
        this.templeTurnCd = 10 + this.runtimeRng() * 6;
        juiceFloater(
          this,
          this.scale.width / 2,
          this.scale.height * 0.34,
          this.uiLocale === "zh-Hans" ? "弯道失误!" : "Missed turn!",
          "#f97316",
        );
        juiceShake(this, { intensity: 0.012, durationMs: 120 });
      }
      return;
    }

    this.templeTurnCd -= dt;
    if (this.templeTurnCd <= 0) {
      const dir = (Math.sin(this.templeCurvePhase()) >= 0 ? 1 : -1) as -1 | 1;
      const maxTtl = 2.05;
      this.activeTurn = { dir, ttl: maxTtl, maxTtl, resolved: false };
    }
  }

  private shiftLane(delta: -1 | 1) {
    if (
      this.templeRunMode &&
      this.activeTurn &&
      !this.activeTurn.resolved &&
      delta === this.activeTurn.dir
    ) {
      this.resolveTempleTurn(delta);
    }
    const next = Phaser.Math.Clamp(this.targetLane + delta, -1, 1);
    if (next === this.targetLane) return;
    this.targetLane = next;
    playBleep("pickup");
    juiceShake(this, { intensity: 0.004, durationMs: 50 });
  }

  update(_time: number, deltaMs: number) {
    if (this.finished) return;
    this.banner.tick();
    this.goalPanel?.update();
    if (this.endlessMode) {
      this.updateEndlessRoad(deltaMs);
      return;
    }
    const dt = deltaMs / 1000;
    this.elapsed += dt;

    const cursors = this.input.keyboard?.createCursorKeys();
    const boostOn =
      this.keyBoost?.isDown ||
      cursors?.right?.isDown ||
      cursors?.shift?.isDown ||
      this.input.activePointer.isDown;
    const brakeOn = this.keyBrake?.isDown || cursors?.left?.isDown;

    if (Phaser.Input.Keyboard.JustDown(this.keyV)) {
      this.thirdPerson = !this.thirdPerson;
      playBleep("pickup");
    }

    this.boostPower = Phaser.Math.Linear(this.boostPower, boostOn ? 1 : 0, dt * 4);
    this.brakePower = Phaser.Math.Linear(this.brakePower, brakeOn ? 1 : 0, dt * 5);

    const sample = sampleCoasterPath(this.path, this.trackProgress);
    const hill = -sample.tangent.y;
    const gravity = 18 * hill;
    const target = this.baseSpeed + this.boostPower * 48 - this.brakePower * 36 + gravity;
    this.speed = Phaser.Math.Linear(this.speed, Phaser.Math.Clamp(target, this.minSpeed, this.maxSpeed), dt * 2.2);

    const totalLen = coasterPathLength(this.path) || 1;
    this.trackProgress += (this.speed * dt) / totalLen;

    if (this.boostPower > 0.6 && this.runtimeRng() < 0.12) {
      juiceShake(this, { intensity: 0.004, durationMs: 80 });
    }

    this.drawWorld();
    this.timerText.setText(formatTime(this.elapsed));
    this.speedText.setText(hudCoasterSpeed(this.uiLocale, Math.round(this.speed * 3.2)));
    this.scoreText.setText(hudScore(this.uiLocale, Math.round(this.trackProgress * 100)));

    setPhaserQaState({
      coasterDistance: Math.max(0, Math.round(this.trackProgress * 10_000 + this.elapsed * 10)),
      coasterLives: this.roadLives,
    });

    if (this.trackProgress >= 1) {
      this.finish(true);
    }
  }

  private drawWorld() {
    const w = this.scale.width;
    const h = this.scale.height;
    const horizon = h * 0.34;
    const cam = sampleCoasterPath(this.path, this.trackProgress);

    this.decorGfx.clear();
    if (this.richVisuals) {
      paintCoasterSkyGradient(this.decorGfx, this.spec, w, h, false);
    } else {
      this.decorGfx.fillGradientStyle(0x38bdf8, 0x38bdf8, 0x7dd3fc, 0xbae6fd, 1);
      this.decorGfx.fillRect(0, 0, w, h);
    }

    for (const c of this.clouds) {
      c.x += c.sp;
      if (c.x > w + 60) c.x = -60;
      this.decorGfx.fillStyle(0xffffff, 0.55);
      this.decorGfx.fillCircle(c.x, c.y, c.r);
      this.decorGfx.fillCircle(c.x + c.r * 0.6, c.y + 4, c.r * 0.72);
    }

    this.trackGfx.clear();
    const railW = parseInt(this.spec.theme.hazardColor.slice(1, 3), 16);
    const railG = parseInt(this.spec.theme.hazardColor.slice(3, 5), 16);
    const railB = parseInt(this.spec.theme.hazardColor.slice(5, 7), 16);
    const tieCol = Phaser.Display.Color.GetColor(
      Math.min(255, railW + 40),
      Math.min(255, railG + 20),
      Math.min(255, railB),
    );

    const segments = 28;
    for (let i = segments; i >= 0; i -= 1) {
      const t = this.trackProgress + i * 0.012;
      if (t > 1.02) continue;
      const s = sampleCoasterPath(this.path, Math.min(1, t));
      const rel = i / segments;
      const depth = 1 - rel * 0.92;
      const scale = 0.15 + depth * 1.35;
      const screenY = horizon + (1 - depth) * (h - horizon - 90);
      const offsetX = (s.pos.x - cam.pos.x) * scale * 6;
      const cx = w / 2 + offsetX;
      const half = (18 + depth * 42) * (1 + Math.abs(s.bank) * 0.4);
      const lift = (s.pos.y - cam.pos.y) * scale * 3;

      this.trackGfx.fillStyle(tieCol, 0.55 + depth * 0.35);
      this.trackGfx.fillRect(cx - half - 6, screenY + lift - 3, half * 2 + 12, 5);
      this.trackGfx.lineStyle(3 + depth * 2, 0xc0c0c0, 0.5 + depth * 0.45);
      this.trackGfx.lineBetween(cx - half, screenY + lift, cx + half, screenY + lift);
      this.trackGfx.lineStyle(2, 0x888888, 0.35 + depth * 0.4);
      this.trackGfx.lineBetween(cx - half, screenY + lift + 5, cx + half, screenY + lift + 5);

      if (i % 4 === 0 && depth > 0.35) {
        const starCol = this.richVisuals ? 0xfde047 : 0xfde047;
        this.trackGfx.fillStyle(starCol, 0.35 + depth * 0.4);
        const starX = cx + Math.sin(i * 1.7) * half * 1.4;
        this.trackGfx.fillCircle(starX, screenY + lift - 30 * depth, 4 + depth * 5);
      }
      if (this.richVisuals && i % 2 === 0 && depth > 0.5) {
        this.trackGfx.lineStyle(1, 0xffffff, 0.15 * depth);
        this.trackGfx.lineBetween(cx, screenY + lift + 8, cx, screenY + lift + 28 * depth);
      }
    }

    this.cartGfx.clear();
    const cartY = h - 118 + (this.thirdPerson ? 0 : -40);
    const cartX = w / 2;
    const bank = cam.bank * (this.thirdPerson ? 0.6 : 0.2);
    const pc = Phaser.Display.Color.HexStringToColor(this.spec.theme.playerColor);
    const cartW = this.thirdPerson ? 54 : 72;
    const cartH = this.thirdPerson ? 28 : 36;

    if (this.richVisuals) {
      drawCoasterCartRich(this.cartGfx, cartX, cartY, cartW, cartH, pc.color, this.thirdPerson);
    } else {
      this.cartGfx.fillStyle(pc.color, 1);
      this.cartGfx.fillRoundedRect(cartX - cartW / 2, cartY - cartH, cartW, cartH, 6);
      this.cartGfx.fillStyle(0x1f2937, 1);
      this.cartGfx.fillCircle(cartX - cartW * 0.32, cartY + 4, 7);
      this.cartGfx.fillCircle(cartX + cartW * 0.32, cartY + 4, 7);
      if (this.thirdPerson) {
        this.cartGfx.fillStyle(0xfbbf24, 1);
        this.cartGfx.fillRect(cartX - 8, cartY - cartH - 14, 16, 14);
      }
      this.cartGfx.lineStyle(2, 0xffffff, 0.25);
      this.cartGfx.strokeRoundedRect(cartX - cartW / 2, cartY - cartH, cartW, cartH, 6);
    }

    if (Math.abs(bank) > 0.05) {
      this.cameras.main.setRotation(bank * 0.08 * this.bankIntensity);
    } else {
      this.cameras.main.setRotation(0);
    }
  }

  private updateEndlessRoad(deltaMs: number) {
    const dt = deltaMs / 1000;

    if (this.templeRunMode && this.templeDead) {
      this.drawEndlessRoad();
      return;
    }

    this.elapsed += dt;
    if (!this.templeRunMode) {
      const cursors = this.input.keyboard?.createCursorKeys();
      if (cursors?.left && Phaser.Input.Keyboard.JustDown(cursors.left)) this.shiftLane(-1);
      if (cursors?.right && Phaser.Input.Keyboard.JustDown(cursors.right)) this.shiftLane(1);
      if (this.keyLaneLeft && Phaser.Input.Keyboard.JustDown(this.keyLaneLeft)) this.shiftLane(-1);
      if (this.keyLaneRight && Phaser.Input.Keyboard.JustDown(this.keyLaneRight)) this.shiftLane(1);
    }

    if (this.templeRunMode) this.updateTempleRunner(dt);
    if (this.crashyRoadMode) {
      this.roadCurvePhase += dt * 0.62;
      this.crashyScrollPhase += dt * (0.7 + this.speed * 0.008);
    }
    if (this.templeInvulnT > 0) this.templeInvulnT -= dt;
    if (this.crashyInvulnT > 0) this.crashyInvulnT -= dt;
    if (this.templeRunMode) this.updateTempleChaserAndTurn(dt);
    if (this.templeRunMode && this.templeDead) {
      this.drawEndlessRoad();
      return;
    }

    this.lane = Phaser.Math.Linear(this.lane, this.targetLane, dt * (this.crashyRoadMode ? 20 : 18));
    const ramp = this.templeRunMode
      ? this.baseSpeed * 0.5 + this.elapsed * 7.5 + this.distanceM * 0.024
      : this.baseSpeed + 16 + this.distanceM * 0.055 + this.elapsed * 0.35;
    const targetSpeed = this.templeRunMode
      ? Math.min(this.maxSpeed * 0.78, ramp)
      : Math.min(this.maxSpeed + 28, ramp);
    this.speed = Phaser.Math.Linear(this.speed, targetSpeed, dt * 1.1);
    this.distanceM += this.speed * dt * (this.templeRunMode ? 0.32 : 0.38);
    this.trackProgress = Math.min(1, this.distanceM / this.distanceGoal);
    if (this.templeRunMode) {
      this.templeRunScore = Math.floor(this.distanceM * 8) + this.templeCoinBonus;
      if (this.templeRunScore > this.lastTempleScore) {
        this.scorePopT = 0.32;
        this.lastTempleScore = this.templeRunScore;
      }
      this.templeScrollPhase += dt * (0.8 + this.speed * 0.01);
    }

    const pace = this.templeRunMode || this.crashyRoadMode ? this.wavePaceScale() : 1;
    const scroll = dt * (this.templeRunMode ? 0.48 + this.speed * 0.009 : this.crashyRoadMode ? 0.55 + this.speed * 0.011 : 0.62 + this.speed * 0.014) * pace;
    this.obstacleSpawnCd -= dt;
    if (this.obstacleSpawnCd <= 0) {
      if (this.templeRunMode) {
        this.spawnTemplePatternWave();
      } else if (this.crashyRoadMode) {
        this.spawnCrashyPatternWave();
      } else {
        const density = 1.35 - this.trackProgress * 0.45;
        this.obstacleSpawnCd = Math.max(0.42, density);
        this.roadObstacles.push({
          lane: Phaser.Math.Between(-1, 1),
          z: 1.12,
          w: 36 + Phaser.Math.Between(0, 22),
          h: 28 + Phaser.Math.Between(0, 18),
          kind: "rock",
        });
      }
    }
    for (const o of this.roadObstacles) o.z -= scroll;
    this.roadObstacles = this.roadObstacles.filter((o) => o.z > -0.05);
    for (const c of this.roadPickups) c.z -= scroll;
    this.roadPickups = this.roadPickups.filter((c) => c.z > -0.05);

    this.nearMissCd = Math.max(0, this.nearMissCd - dt);
    for (const o of this.roadObstacles) {
      const hit = this.templeRunMode ? this.templeObstacleHits(o) : this.crashyObstacleHits(o);
      if (hit) {
        if (this.templeRunMode) {
          if (this.templeInvulnT > 0) continue;
          this.templeCrash();
          this.drawEndlessRoad();
          return;
        }
        if (this.crashyInvulnT > 0) continue;
        this.roadLives -= 1;
        this.crashyNearStreak = 0;
        this.crashyNearStreakT = 0;
        this.crashyInvulnT = 1.25;
        o.z = -1;
        juiceShake(this, { intensity: 0.022, durationMs: 220 });
        juiceFlash(this, { r: 239, g: 68, b: 68 }, { durationMs: 120 });
        playBleep("hit");
        this.banner.show({
          title: this.uiLocale === "zh-Hans" ? "撞到了!" : "Crashed!",
          message:
            this.uiLocale === "zh-Hans"
              ? `剩余生命 ${this.roadLives} · 短暂无敌`
              : `Lives ${this.roadLives} · brief invuln`,
          ms: 900,
        });
        if (this.roadLives <= 0) {
          this.runnerDeathCause = "lives";
          this.finish(false);
          return;
        }
      } else if (
        this.crashyRoadMode &&
        !this.templeDead &&
        o.z < 0.1 &&
        o.z > 0.032 &&
        this.nearMissCd <= 0 &&
        Math.abs(o.lane - this.lane) >= 0.58 &&
        Math.abs(o.lane - this.lane) < 0.95
      ) {
        this.nearMissCd = 0.75;
        this.crashyNearStreak += 1;
        this.crashyNearStreakT = 1.5;
        this.maxCrashyNearStreakRun = Math.max(this.maxCrashyNearStreakRun, this.crashyNearStreak);
        this.comboPopT = 0.38;
        const bonus = this.crashyNearStreak >= 4 ? 18 : 10;
        this.crashyDodgeBonus += bonus;
        juiceFloater(
          this,
          this.scale.width / 2,
          this.scale.height * 0.42,
          this.uiLocale === "zh-Hans"
            ? `擦边 x${this.crashyNearStreak} +${bonus}`
            : `Near x${this.crashyNearStreak} +${bonus}`,
          "#38bdf8",
        );
        juiceShake(this, { intensity: 0.008, durationMs: 80 });
        playBleep("pickup");
      } else if (
        this.templeRunMode &&
        !this.templeDead &&
        this.templeInvulnT <= 0 &&
        o.z < 0.09 &&
        o.z > 0.035 &&
        this.nearMissCd <= 0 &&
        Math.abs(o.lane - this.lane) >= 0.62 &&
        Math.abs(o.lane - this.lane) < 0.98
      ) {
        this.nearMissCd = 0.85;
        this.chaserPressure = Math.min(1, this.chaserPressure + 0.1);
        juiceFloater(
          this,
          this.scale.width / 2,
          this.scale.height * 0.4,
          this.uiLocale === "zh-Hans" ? "擦边!" : "Near!",
          "#fde047",
        );
        juiceShake(this, { intensity: 0.006, durationMs: 90 });
        playBleep("pickup");
      } else if (
        !this.templeRunMode &&
        !this.crashyRoadMode &&
        o.z < 0.05 &&
        o.z > 0.03 &&
        this.nearMissCd <= 0 &&
        Math.abs(o.lane - this.lane) >= 0.55 &&
        Math.abs(o.lane - this.lane) < 0.9
      ) {
        this.nearMissCd = 0.8;
        juiceFloater(this, this.scale.width / 2, this.scale.height * 0.42, this.uiLocale === "zh-Hans" ? "擦边!" : "Near!", "#fde047");
        juiceShake(this, { intensity: 0.003, durationMs: 60 });
      }
    }

    if (this.templeRunMode) {
      for (const c of this.roadPickups) {
        if (c.z < 0.14 && c.z > 0.02 && Math.abs(c.lane - this.lane) < 0.62) {
          this.coins += 1;
          c.z = -1;
          this.coinPopT = 0.38;
          this.camPulseT = 0.2;
          this.coinStreak += 1;
          this.coinStreakT = 1.35;
          this.maxCoinStreakRun = Math.max(this.maxCoinStreakRun, this.coinStreak);
          this.comboPopT = 0.42;
          const streakBonus = this.coinStreak >= 3 ? (this.coinStreak - 2) * 8 : 0;
          if (streakBonus > 0) this.templeCoinBonus += streakBonus;
          this.chaserPressure = Math.max(0, this.chaserPressure - 0.09);
          if (this.coinStreak === 5 || this.coinStreak === 8) {
            juiceFloater(
              this,
              this.scale.width / 2,
              this.scale.height * 0.32,
              this.uiLocale === "zh-Hans" ? `连击 x${this.coinStreak}!` : `Combo x${this.coinStreak}!`,
              this.coinStreak >= 8 ? "#f97316" : "#fcd34d",
            );
            if (this.coinStreak >= 8) juiceShake(this, { intensity: 0.008, durationMs: 70 });
          }
          const coinLabel =
            this.coinStreak >= 3
              ? this.uiLocale === "zh-Hans"
                ? `+1 x${this.coinStreak}`
                : `+1 x${this.coinStreak}`
              : "+1";
          const footSample = templePathSample(0.93, this.scale.width, this.scale.height, this.templeCurvePhase());
          const floaterX = templeLaneX(footSample, this.lane, this.lane);
          const floaterY = footSample.y - 52 * footSample.scale;
          juiceFloater(this, floaterX, floaterY, coinLabel, "#fcd34d");
          playBleep("pickup");
        }
      }
    }

    if (this.coinStreakT > 0) {
      this.coinStreakT = Math.max(0, this.coinStreakT - dt);
      if (this.coinStreakT <= 0) this.coinStreak = 0;
    }

    if (this.coinPopT > 0) this.coinPopT = Math.max(0, this.coinPopT - dt);
    if (this.comboPopT > 0) this.comboPopT = Math.max(0, this.comboPopT - dt);
    if (this.crashyNearStreakT > 0) {
      this.crashyNearStreakT = Math.max(0, this.crashyNearStreakT - dt);
      if (this.crashyNearStreakT <= 0) this.crashyNearStreak = 0;
    }
    if (this.scorePopT > 0) this.scorePopT = Math.max(0, this.scorePopT - dt);
    if (this.templeRunMode && this.camPulseT > 0) {
      this.camPulseT = Math.max(0, this.camPulseT - dt);
      const t = 1 - this.camPulseT / 0.2;
      this.cameras.main.setZoom(1 + 0.022 * Math.sin(t * Math.PI));
    } else if (this.templeRunMode) {
      this.cameras.main.setZoom(1);
    }

    const milestoneStep = 400;
    const milestone = Math.floor(this.distanceM / milestoneStep);
    if (milestone > this.lastMilestone && milestone % 2 === 0) {
      this.lastMilestone = milestone;
      juiceFloater(
        this,
        this.scale.width / 2,
        this.scale.height * 0.3,
        `${milestone * milestoneStep}m`,
        "#94a3b8",
      );
    } else if (milestone > this.lastMilestone) {
      this.lastMilestone = milestone;
    }

    this.drawEndlessRoad();
    if (this.templeRunMode) {
      if (this.templeDead) {
        this.templeComboText?.setVisible(false);
      } else {
        this.scoreText.setText(String(this.templeRunScore));
        const pop = Math.max(this.coinPopT, this.scorePopT);
        this.scoreText.setScale(1 + pop * 0.12);
        this.coinHudText?.setText(String(this.coins));
        this.coinHudText?.setScale(1 + this.coinPopT * 0.2);
        if (this.coinStreak >= 2) {
          const comboLabel =
            this.uiLocale === "zh-Hans" ? `连击 x${this.coinStreak}` : `Combo x${this.coinStreak}`;
          this.templeComboText?.setText(comboLabel).setVisible(true);
          this.templeComboText?.setScale(1 + this.comboPopT * 0.25);
        } else {
          this.templeComboText?.setVisible(false);
        }
      }
      if (!this.templeDead) {
        if (this.chaserPressure > 0.62) {
          const warn =
            this.uiLocale === "zh-Hans"
              ? `⚠ 追兵 ${Math.round(this.chaserPressure * 100)}% · 吃金币拉开`
              : `⚠ Chasers ${Math.round(this.chaserPressure * 100)}% · grab coins`;
          this.hintText.setText(warn).setColor("#fca5a5");
        } else {
          const upcoming = this.roadObstacles
            .filter((o) => o.z < 0.13 && o.z > 0.035 && Math.abs(o.lane - this.lane) < 0.4)
            .sort((a, b) => a.z - b.z)[0];
          if (upcoming) {
            const actionHint =
              upcoming.kind === "rock"
                ? this.uiLocale === "zh-Hans"
                  ? "↑ 跳跃越过滚石"
                  : "↑ Jump the rock"
                : upcoming.kind === "pillar"
                  ? this.uiLocale === "zh-Hans"
                    ? "↑ 跳跃越过断柱"
                    : "↑ Jump the pillar"
                  : this.uiLocale === "zh-Hans"
                    ? "↓ 滑铲穿过横梁"
                    : "↓ Slide under beam";
            this.hintText.setText(actionHint).setColor("#fde047");
          } else if (this.activeTurn && !this.activeTurn.resolved) {
            const turnHint =
              this.uiLocale === "zh-Hans"
                ? this.activeTurn.dir < 0
                  ? "↖ 弯道！按 A 或 ←"
                  : "↗ 弯道！按 D 或 →"
                : this.activeTurn.dir < 0
                  ? "↖ Turn! A or ←"
                  : "↗ Turn! D or →";
            this.hintText.setText(turnHint).setColor("#7dd3fc");
          } else {
            this.hintText.setText(this.templeHintBase).setColor("#a8a29e");
          }
        }
      }
    } else if (this.crashyRoadMode) {
      const crashyScore = Math.round(this.distanceM * 10) + this.crashyDodgeBonus;
      this.scoreText.setText(String(crashyScore));
      this.speedText.setText(
        `${this.uiLocale === "zh-Hans" ? "生命" : "Lives"} ${this.roadLives}  ·  ${Math.round(this.distanceM)} m`,
      );
      if (this.crashyInvulnT > 0) {
        this.hintText
          .setText(this.uiLocale === "zh-Hans" ? "无敌帧 — 抓紧换道恢复" : "Invuln — dodge to recover")
          .setColor("#86efac");
      } else if (this.crashyNearStreak >= 2) {
        const dodgeHint =
          this.uiLocale === "zh-Hans"
            ? `擦边连击 x${this.crashyNearStreak}`
            : `Near streak x${this.crashyNearStreak}`;
        this.hintText.setText(dodgeHint).setColor("#7dd3fc");
      } else {
        this.hintText.setText(this.uiLocale === "zh-Hans" ? "左右换道躲避障碍" : "Switch lanes to dodge").setColor("#a8a29e");
      }
    } else {
      this.timerText.setText(formatTime(this.elapsed));
      this.speedText.setText(
        `${this.uiLocale === "zh-Hans" ? "生命" : "Lives"} ${this.roadLives}  ·  ${hudCoasterSpeed(this.uiLocale, Math.round(this.speed * 3.2))}`,
      );
      this.scoreText.setText(hudEndlessRoadDistance(this.uiLocale, Math.round(this.distanceM)));
    }
    setPhaserQaState({
      coasterDistance: Math.round(this.distanceM),
      coasterLives: this.roadLives,
      coasterCoins: this.coins,
    });

    if (!this.templeRunMode && !this.crashyRoadMode && this.distanceM >= this.distanceGoal) this.finish(true);
  }

  private spawnTemplePatternWave() {
    if (this.elapsed < 3.5) {
      this.obstacleSpawnCd = 0.45;
      return;
    }
    const difficulty = Math.min(1, this.elapsed / 55);
    const pace = this.wavePaceScale();
    const maxActive = (difficulty > 0.55 ? 3 : 2) + (this.distanceM > 480 ? 1 : 0);
    const active = this.roadObstacles.filter((o) => o.z > 0.04 && o.z < 0.88);
    const wave = templeWaveAt(this.templePatternIdx);
    if (wave.steps.length > 0 && active.length + wave.steps.length > maxActive) {
      this.obstacleSpawnCd = 0.35;
      return;
    }
    this.templePatternIdx += 1;
    const zBoost = Math.min(0.09, this.distanceM / 2000);

    for (const step of wave.steps) {
      const lane = this.resolvePatternLane(step.lane);
      const dims = this.templeObstacleDims(step.kind);
      this.roadObstacles.push({
        lane,
        z: (step.z ?? 1.16) - zBoost,
        w: dims.w,
        h: dims.h,
        kind: step.kind,
      });
      if (!this.templeHintedKinds.has(step.kind)) {
        this.templeHintedKinds.add(step.kind);
        const hint =
          step.kind === "rock"
            ? this.uiLocale === "zh-Hans"
              ? "滚石 — 跳跃 W/上滑"
              : "Rock — jump W/swipe up"
            : step.kind === "pillar"
              ? this.uiLocale === "zh-Hans"
                ? "断柱 — 跳跃越过"
                : "Pillar — jump over"
              : this.uiLocale === "zh-Hans"
                ? "横梁 — 滑铲 S/下滑"
                : "Beam — slide S/swipe down";
        this.banner.show({ title: hint, ms: 1400 });
      }
    }

    for (const coin of wave.coins ?? []) {
      const lane = this.resolvePatternLane(coin.lane);
      const baseZ = coin.z ?? 1.06;
      for (let k = 0; k < coin.count; k += 1) {
        this.roadPickups.push({ lane, z: baseZ + k * 0.06 });
      }
    }

    this.obstacleSpawnCd = Math.max(0.68, wave.cooldown / pace - difficulty * 0.2);
  }

  private spawnCrashyPatternWave() {
    if (this.elapsed < 2.4) {
      this.obstacleSpawnCd = 0.4;
      return;
    }
    const difficulty = Math.min(1, this.elapsed / 45);
    const pace = this.wavePaceScale();
    const maxActive = (difficulty > 0.5 ? 3 : 2) + (this.distanceM > 420 ? 1 : 0);
    const active = this.roadObstacles.filter((o) => o.z > 0.04 && o.z < 0.9);
    const wave = crashyWaveAt(this.crashyPatternIdx);
    if (wave.steps.length > 0 && active.length + wave.steps.length > maxActive) {
      this.obstacleSpawnCd = 0.3;
      return;
    }
    this.crashyPatternIdx += 1;
    const zBoost = Math.min(0.1, this.distanceM / 1800);

    for (const step of wave.steps) {
      const lane = this.resolvePatternLane(step.lane);
      const dims = this.crashyObstacleDims(step.style);
      this.roadObstacles.push({
        lane,
        z: (step.z ?? 1.14) - zBoost,
        w: dims.w,
        h: dims.h,
        kind: "rock",
        crashyStyle: step.style,
      });
    }

    this.obstacleSpawnCd = Math.max(0.62, wave.cooldown / pace - difficulty * 0.16);
  }

  private templeObstacleDims(kind: RoadObstacleKind): { w: number; h: number } {
    if (kind === "beam") return { w: 44, h: 11 };
    if (kind === "pillar") return { w: 38, h: 14 };
    return { w: 36, h: 28 };
  }

  private crashyObstacleDims(style: CrashyObstacleStyle): { w: number; h: number } {
    if (style === "wreck") return { w: 42, h: 30 };
    if (style === "cone") return { w: 32, h: 26 };
    return { w: 40, h: 28 };
  }

  private resolvePatternLane(preferred: -1 | 0 | 1): -1 | 0 | 1 {
    const blocked = new Set<number>();
    for (const o of this.roadObstacles) {
      if (o.z > 0.68 && o.z < 1.1) blocked.add(o.lane);
    }
    if (!blocked.has(preferred)) return preferred;
    const order: Array<-1 | 0 | 1> = [preferred, 0, -1, 1].filter(
      (lane, idx, arr) => arr.indexOf(lane) === idx,
    ) as Array<-1 | 0 | 1>;
    for (const lane of order) {
      if (!blocked.has(lane)) return lane;
    }
    return preferred;
  }

  private crashyObstacleHits(o: RoadObstacle): boolean {
    return o.z < 0.115 && o.z > 0.018 && Math.abs(o.lane - this.lane) < 0.52;
  }

  private templeObstacleHits(o: RoadObstacle): boolean {
    const laneDelta = Math.abs(o.lane - this.lane);
    if (laneDelta >= 0.55) return false;
    if (o.z >= 0.125 || o.z <= 0.016) return false;
    if (o.kind === "pillar") return this.runnerJump < 0.3;
    if (o.kind === "beam") return this.runnerSlide < 0.2;
    if (o.kind === "rock") return this.runnerJump < 0.32;
    return true;
  }

  private updateTempleRunner(dt: number) {
    this.runAnimPhase += dt * (11 + this.speed * 0.065);
    this.roadCurvePhase += dt * 0.88;
    const turn = this.activeTurn;
    if (turn && !turn.resolved) {
      this.templeCurveBias = Phaser.Math.Linear(this.templeCurveBias, turn.dir * 0.62, dt * 3.6);
    } else {
      this.templeCurveBias = Phaser.Math.Linear(this.templeCurveBias, 0, dt * 2.4);
    }
    updateTempleSpeedLines(this.speedLines, dt, this.scale.height);

    if (!this.templeDead && this.runnerSprite && this.runtimeRng() > 0.9) {
      this.dustPuffs.push(spawnTempleDustPuff(this.runnerSprite.x, this.runnerSprite.y + 24, this.runtimeRng));
    }
    updateTempleDustPuffs(this.dustPuffs, dt);

    if (this.runnerSlideT > 0) {
      this.runnerSlideT -= dt;
      this.runnerSlide = Math.min(1, this.runnerSlideT / 0.58);
    } else {
      this.runnerSlide = Phaser.Math.Linear(this.runnerSlide, 0, dt * 8);
    }
    if (this.runnerJump > 0) {
      this.runnerJump = Math.max(0, this.runnerJump - dt * 1.62);
    }
  }

  private laneCenterX(lane: number, depth: number, w: number, laneW: number): number {
    const base = w / 2 + lane * laneW + this.lane * -laneW * 0.15;
    if (this.templeRunMode) {
      const curve = Math.sin(this.roadCurvePhase + depth * 2.2) * (24 + depth * 36);
      return base + curve;
    }
    if (this.crashyRoadMode) {
      const curve = Math.sin(this.roadCurvePhase + depth * 1.6) * (10 + depth * 18);
      return base + curve;
    }
    return base;
  }

  private drawEndlessRoad() {
    const w = this.scale.width;
    const h = this.scale.height;
    if (this.templeRunMode) {
      this.drawTempleRunFrame(w, h);
      return;
    }
    if (this.crashyRoadMode) {
      this.drawCrashyRoadFrame(w, h);
      return;
    }

    const horizon = h * 0.3;
    this.decorGfx.clear();
    if (this.richVisuals) {
      paintCoasterSkyGradient(this.decorGfx, this.spec, w, h, true);
    } else {
      this.decorGfx.fillGradientStyle(0x7dd3fc, 0x7dd3fc, 0xbae6fd, 0xe0f2fe, 1);
      this.decorGfx.fillRect(0, 0, w, h);
    }

    this.trackGfx.clear();
    const laneW = 110;
    const roadCol = Phaser.Display.Color.HexStringToColor(this.spec.theme.backgroundColor).color;
    for (let lane = -1; lane <= 1; lane += 1) {
      const cx = this.laneCenterX(lane, 0.72, w, laneW);
      this.trackGfx.fillStyle(roadCol, this.richVisuals ? 0.92 : 0.85);
      this.trackGfx.fillRect(cx - laneW * 0.42, horizon, laneW * 0.84, h - horizon - 40);
      this.trackGfx.lineStyle(2, 0xfde047, this.richVisuals ? 0.45 : 0.35);
      this.trackGfx.lineBetween(cx - laneW * 0.42, horizon, cx - laneW * 0.42, h - 40);
      this.trackGfx.lineBetween(cx + laneW * 0.42, horizon, cx + laneW * 0.42, h - 40);
      if (this.richVisuals) {
        for (let dash = horizon + 20; dash < h - 50; dash += 48) {
          this.trackGfx.fillStyle(0xffffff, 0.25);
          this.trackGfx.fillRect(cx - 3, dash, 6, 18);
        }
      }
    }

    for (const o of this.roadObstacles) {
      const depth = 1 - o.z;
      if (depth <= 0 || depth > 1) continue;
      const cx = this.laneCenterX(o.lane, depth, w, laneW);
      const y = horizon + (1 - depth) * (h - horizon - 120);
      const scale = 0.25 + depth * 0.85;
      const ow = o.w * scale;
      const oh = o.h * scale;
      if (this.richVisuals) {
        drawEndlessRoadObstacle(this.trackGfx, cx, y, ow, oh);
      } else {
        this.trackGfx.fillStyle(0xef4444, 0.55 + depth * 0.4);
        this.trackGfx.fillRoundedRect(cx - ow / 2, y, ow, oh, 6);
      }
    }

    this.cartGfx.clear();
    const cartX = this.laneCenterX(this.lane, 0.92, w, laneW);
    const cartY = h - 108;
    const pc = Phaser.Display.Color.HexStringToColor(this.spec.theme.playerColor);
    if (this.richVisuals) {
      drawCoasterCartRich(this.cartGfx, cartX, cartY, 56, 28, pc.color, true);
    } else {
      this.cartGfx.fillStyle(pc.color, 1);
      this.cartGfx.fillRoundedRect(cartX - 28, cartY - 22, 56, 28, 6);
      this.cartGfx.fillStyle(0x1f2937, 1);
      this.cartGfx.fillCircle(cartX - 18, cartY + 8, 7);
      this.cartGfx.fillCircle(cartX + 18, cartY + 8, 7);
    }
  }

  private drawCrashyRoadFrame(w: number, h: number) {
    const laneW = 110;
    const horizon = h * 0.3;
    this.decorGfx.clear();
    drawCrashyRoadBackdrop(this.decorGfx, w, h, this.crashyScrollPhase);

    this.trackGfx.clear();
    drawCrashyLaneMarkings(
      this.trackGfx,
      w,
      h,
      laneW,
      (lane, depth, width, lw) => this.laneCenterX(lane, depth, width, lw),
      this.crashyScrollPhase,
    );

    const sorted = [...this.roadObstacles].sort((a, b) => b.z - a.z);
    for (const o of sorted) {
      const depth = 1 - o.z;
      if (depth <= 0 || depth > 1) continue;
      const cx = this.laneCenterX(o.lane, depth, w, laneW);
      const y = horizon + (1 - depth) * (h - horizon - 120);
      const scale = 0.25 + depth * 0.85;
      const ow = o.w * scale;
      const oh = o.h * scale;
      drawCrashyLaneWarning(this.trackGfx, cx, y, ow, depth);
      if (o.crashyStyle) {
        drawCrashyObstacleGfx(this.trackGfx, cx, y, ow, oh, depth, o.crashyStyle);
      } else {
        drawEndlessRoadObstacle(this.trackGfx, cx, y, ow, oh);
      }
    }

    this.cartGfx.clear();
    const cartX = this.laneCenterX(this.lane, 0.92, w, laneW);
    const cartY = h - 108;
    const pc = Phaser.Display.Color.HexStringToColor(this.spec.theme.playerColor);
    drawCoasterCartRich(this.cartGfx, cartX, cartY, 56, 28, pc.color, true);
    this.cartGfx.fillStyle(0x0f172a, 0.25);
    this.cartGfx.fillEllipse(cartX, cartY + 14, 48, 12);
    if (this.crashyInvulnT > 0) {
      const pulse = 0.28 + Math.sin(this.elapsed * 16) * 0.18;
      this.cartGfx.fillStyle(0xffffff, pulse);
      this.cartGfx.fillCircle(cartX, cartY - 8, 30);
    }

    this.crashyHudGfx?.clear();
    if (this.crashyHudGfx) {
      drawCrashyLivesHud(this.crashyHudGfx, 14, 12, this.roadLives, 3);
      drawCrashyDodgeCombo(
        this.crashyHudGfx,
        w / 2,
        52,
        this.crashyNearStreak,
        this.comboPopT,
        this.uiLocale === "zh-Hans",
      );
    }

    if (this.finished && this.runnerDeathCause) {
      const liveScore = Math.round(this.distanceM * 10) + this.crashyDodgeBonus;
      this.refreshDeathRecapHud(liveScore);
    }
  }

  private drawTempleRunFrame(w: number, h: number) {
    const curve = this.templeCurvePhase();
    const horizonSample = templePathSample(0.05, w, h, curve);
    updateTempleRoadShader(this.templeDead ? null : this.templeRoadShader, w, h, {
      elapsed: this.elapsed,
      scrollPhase: this.templeScrollPhase,
      curvePhase: curve,
    });
    this.decorGfx.clear();
    drawTempleSkyAndArch(this.decorGfx, w, h, horizonSample);
    if (!this.templeDead) {
      drawTempleVinesParallax(this.decorGfx, w, h, curve, this.templeScrollPhase);
      drawTempleSideRuins(this.decorGfx, w, h, curve, this.lane);
      drawTempleFireflies(this.decorGfx, w, h, this.elapsed);
    }

    this.speedLineGfx?.clear();
    if (this.speedLineGfx && !this.templeDead) {
      drawTempleSpeedLines(this.speedLineGfx, this.speedLines, horizonSample.vanishX);
    }

    this.trackGfx.clear();
    drawTempleRoad(this.trackGfx, w, h, curve, this.lane, this.templeScrollPhase);
    drawTempleLaneDashes(this.trackGfx, w, h, curve, this.lane, this.templeScrollPhase);
    drawTempleRailings(this.trackGfx, w, h, curve, this.lane);

    const sortedPickups = [...this.roadPickups].sort((a, b) => b.z - a.z);
    for (const c of sortedPickups) {
      const depth = 1 - c.z;
      if (depth <= 0 || depth > 1) continue;
      const sample = templePathSample(depth, w, h, curve);
      const cx = templeLaneX(sample, c.lane, this.lane);
      const scale = sample.scale * 0.9;
      drawTempleCoinGfx(this.trackGfx, cx, sample.y - 8 * scale, scale, this.templeScrollPhase + c.z * 4);
    }

    const sortedObstacles = [...this.roadObstacles].sort((a, b) => b.z - a.z);
    for (const o of sortedObstacles) {
      const depth = 1 - o.z;
      if (depth <= 0 || depth > 1) continue;
      drawTempleObstacleTelegraph(this.trackGfx, w, h, curve, this.lane, o.lane, o.kind, depth);
    }
    for (const o of sortedObstacles) {
      const depth = 1 - o.z;
      if (depth <= 0 || depth > 1) continue;
      const sample = templePathSample(depth, w, h, curve);
      const cx = templeLaneX(sample, o.lane, this.lane);
      const scale = sample.scale;
      drawTempleObstacleGfx(this.trackGfx, cx, sample.y, o.w * scale, o.h * scale, depth, o.kind);
    }

    this.cartGfx.clear();
    const playerSample = templePathSample(0.93, w, h, curve);
    const px = templeLaneX(playerSample, this.lane, this.lane);
    const jumpLift = this.runnerJump * 46 * playerSample.scale;
    const slideDrop = this.runnerSlide * 14 * playerSample.scale;
    const py = playerSample.y - 34 * playerSample.scale - jumpLift + slideDrop;

    if (this.runnerSprite) {
      this.runnerSprite.setVisible(true);
      this.runnerSprite.setPosition(px, py);
      const bodyScale = playerSample.scale * (this.runnerSlide > 0.25 ? 0.82 : 1);
      this.runnerSprite.setScale(bodyScale);
      const frame = Math.floor(this.runAnimPhase) % RUNNER_FRAME_COUNT;
      let pose: TempleRunnerPose = "run";
      if (this.runnerJump > 0.1) pose = "jump";
      else if (this.runnerSlide > 0.25) pose = "slide";
      else if (this.lane < this.targetLane - 0.06) pose = "leanR";
      else if (this.lane > this.targetLane + 0.06) pose = "leanL";
      const tex = templeRunnerTextureKey(frame, pose, this.runnerFrameKeys);
      if (this.runnerSprite.texture.key !== tex) this.runnerSprite.setTexture(tex);
      const curveBank =
        Math.cos(this.roadCurvePhase) * 12 +
        (this.lane < this.targetLane - 0.06 ? -6 : this.lane > this.targetLane + 0.06 ? 6 : 0);
      this.runnerSprite.setAngle(this.templeDead ? 18 : this.runnerJump > 0.12 ? -10 + curveBank * 0.2 : curveBank);
      if (this.templeDead) this.runnerSprite.setTint(0xffaaaa);
      else if (this.templeInvulnT > 0) {
        this.runnerSprite.clearTint();
        this.runnerSprite.setAlpha(0.5 + Math.sin(this.elapsed * 14) * 0.22);
      } else {
        this.runnerSprite.clearTint();
        this.runnerSprite.setAlpha(1);
      }
    }

    this.chaserGfx?.clear();
    if (this.chaserGfx && !this.templeDead) {
      const footY = playerSample.y + 40 * playerSample.scale;
      drawTempleRunnerShadow(this.chaserGfx, px, footY + 4, playerSample.scale, this.runnerJump);
      drawTempleChasers(this.chaserGfx, px, footY, this.runAnimPhase, this.chaserPressure);
    }

    this.dustGfx?.clear();
    if (this.dustGfx) drawTempleDustPuffs(this.dustGfx, this.dustPuffs);

    this.vignetteGfx?.clear();
    if (this.vignetteGfx) drawTempleSunVignette(this.vignetteGfx, w, h, this.chaserPressure);

    this.coinHudGfx?.clear();
    if (this.coinHudGfx && !this.templeDead) {
      const hudY = 14;
      drawTempleChaserMeter(this.coinHudGfx, 14, hudY + 10, 68, this.chaserPressure);
      drawTempleScorePanel(
        this.coinHudGfx,
        w / 2,
        hudY,
        this.templeRunScore,
        Math.max(this.coinPopT, this.scorePopT) * 0.5,
      );
      drawTempleCoinHud(this.coinHudGfx, w - 12, hudY, 1 + this.coinPopT * 0.2);
      drawTempleComboBadge(
        this.coinHudGfx,
        w / 2,
        hudY + 44,
        this.coinStreak,
        this.comboPopT,
        this.uiLocale === "zh-Hans",
      );
      const turn = this.activeTurn;
      if (turn && !turn.resolved) {
        drawTempleTurnPrompt(this.coinHudGfx, w, h, turn.dir, turn.ttl, turn.maxTtl);
      }
    }

    if (this.templeDead) {
      const liveScore = this.templeRunScore + this.coins * 50;
      this.templeDeathDimGfx?.clear();
      if (this.templeDeathDimGfx) drawTempleDeathDim(this.templeDeathDimGfx, w, h);
      this.refreshDeathRecapHud(liveScore);
    } else {
      this.templeDeathDimGfx?.clear();
    }
  }

  private finish(won: boolean) {
    if (this.finished) return;
    this.finished = true;
    const coinBonus = this.templeRunMode ? this.coins * 50 : 0;
    const score = this.endlessMode
      ? this.templeRunMode
        ? this.templeRunScore + coinBonus
        : this.crashyRoadMode
          ? Math.round(this.distanceM * 10) + this.crashyDodgeBonus
          : Math.round(this.distanceM * (won ? 14 : 6) + coinBonus)
      : won
        ? Math.max(1, Math.round(10000 / Math.max(this.elapsed, 1)))
        : 0;
    const coinLine =
      this.templeRunMode && this.coins > 0
        ? this.uiLocale === "zh-Hans"
          ? ` · 金币 ${this.coins}`
          : ` · ${this.coins} coins`
        : "";
    this.banner.show({
      ...(won
        ? this.endlessMode
          ? {
              title: this.templeRunMode
                ? this.uiLocale === "zh-Hans"
                  ? "逃出遗迹!"
                  : "Temple escaped!"
                : this.uiLocale === "zh-Hans"
                  ? "公路征服!"
                  : "Road cleared!",
              message:
                this.uiLocale === "zh-Hans"
                  ? `距离 ${Math.round(this.distanceM)} m${coinLine} · 得分 ${score}`
                  : `${Math.round(this.distanceM)} m${coinLine} · score ${score}`,
            }
          : bannerCoasterFinishWin(this.uiLocale, formatTime(this.elapsed))
        : this.endlessMode
          ? {
              title: this.templeRunMode
                ? this.uiLocale === "zh-Hans"
                  ? "被遗迹困住!"
                  : "Temple run over!"
                : this.uiLocale === "zh-Hans"
                  ? "撞车了!"
                  : "Crashed!",
              message:
                this.uiLocale === "zh-Hans"
                  ? `跑了 ${Math.round(this.distanceM)} m${coinLine} · 得分 ${score}`
                  : `${Math.round(this.distanceM)} m${coinLine} · score ${score}`,
            }
          : bannerCoasterFinishLose(this.uiLocale, this.spec.labels.hazard)),
      ms: 3200,
    });
    playBleep(won ? "win" : "hit");
    juiceShake(this, { intensity: won ? 0.012 : 0.02, durationMs: 220 });
    if (won) {
      juiceFlash(this, { r: 120, g: 210, b: 255 }, { durationMs: 160 });
      juiceFloater(this, this.scale.width / 2, this.scale.height * 0.4, this.uiLocale === "zh-Hans" ? "完赛!" : "Finish!", this.cohesive.hud.accent);
    }
    this.time.delayedCall(900, () => {
      this.onEnd(this.buildRunnerEndPayload(score, won));
    });
  }
}
