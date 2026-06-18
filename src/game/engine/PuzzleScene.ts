import Phaser from "phaser";
import { playBleep } from "@/game/audio/webBleeps";
import { HudBanner } from "@/game/engine/HudBanner";
import { HudGoalPanel } from "@/game/engine/HudGoalPanel";
import {
  juiceBurst,
  juiceCombo,
  juiceFail,
  juiceHit,
  juicePickup,
  juiceWin,
  themeParticleHex,
} from "@/game/engine/gameJuice";
import { styleHudText } from "@/game/engine/hudTextStyle";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { AppLocale } from "@/i18n/routing";
import type { GameSpec } from "@/lib/game-spec";
import { type CohesivePresentation } from "@/lib/cohesive-presentation";
import { buildSceneCohesion } from "@/lib/scene-experience";
import { buildPuzzleBlueprint, type PuzzleMode } from "@/lib/puzzle-blueprint";
import { runtimeSeedFromSpec, seededRandom, seededShuffle } from "@/lib/runtime-seed";
import { schedulePhaserPlayReady, setPhaserQaClickHints } from "@/game/engine/phaser-play-ready";
import { initQaState, setPhaserQaState } from "@/game/engine/phaser-qa-state";
import { assetBackgroundAlpha } from "@/game/engine/phaser-loaded-sprites";
import { buildSceneGoalGuidance, introBannerWhenGoalPanel } from "@/lib/scene-goal-guidance";
import {
  anipopKindFromColorIndex,
  anipopSwapHint,
  drawAnipopBoardFrame,
  drawAnipopCellBg,
  drawAnipopGem,
  drawAnipopTopBar,
  drawAnipopBoosterBar,
  drawAnipopIceOverlay,
  drawAnipopIcedSpecialGlow,
  drawAnipopSpecialMark,
  type AnipopTopBarLayout,
  hitAnipopBooster,
  paintAnipopBackdrop,
  type AnipopBoosterId,
} from "@/game/engine/anipop-visual";
import {
  anipopGemAtlasKey,
  anipopGemFrameIndex,
  hasAnipopGemAtlas,
  registerAnipopGemAtlasLoader,
  ANIPOP_GEM_FRAME_SIZE,
} from "@/game/engine/anipop-gem-atlas";
import {
  drawMatch3Gem,
  kidsJigsawEmoji,
  memoryCardEmoji,
  paintColorBloomBackdrop,
  paintWhimsyPanelScene,
} from "@/game/engine/puzzle-visual";

const ANIPOP_LEVEL_CONFIGS = [
  { scoreTarget: 1200, chickTarget: 14, iceTarget: 10, moveLimit: 22 },
  { scoreTarget: 1600, chickTarget: 18, iceTarget: 14, moveLimit: 20 },
  { scoreTarget: 2000, chickTarget: 22, iceTarget: 18, moveLimit: 18 },
] as const;
import {
  paintPuzzleBoardFrame,
  paintPuzzleThemeBackdrop,
  paintSpotDiffPanels,
} from "@/game/engine/template-theme-visual";
import {
  bannerPuzzleFinish,
  hudPuzzleMatch3Hint,
  hudPuzzleMoves,
  hudPuzzleSpotDiffHint,
  hudScore,
} from "@/lib/i18n/game-hud-labels";

type EndPayload = { score: number; won: boolean };

const COLORS = ["#f472b6", "#a78bfa", "#38bdf8", "#4ade80", "#fbbf24", "#fb7185"];
const ANIPOP_COLORS = ["#4ade80", "#38bdf8", "#f87171", "#a78bfa", "#facc15"];

/** 益智专用运行时：match3 / 找不同 / 记忆翻牌 / 拼图 */
export class PuzzleScene extends Phaser.Scene {
  public backgroundUrl: string | null = null;
  public projectId: string | null = null;
  public uiLocale: AppLocale = "zh-Hans";

  private readonly spec: GameSpec;
  private readonly onEnd: (r: EndPayload) => void;
  private readonly soundscape: GameSoundscape | null;

  private mode: PuzzleMode = "match3";
  private score = 0;
  private moves = 0;
  private moveLimit = 30;
  private target = 100;
  private finished = false;
  private scoreText!: Phaser.GameObjects.Text;
  private moveText!: Phaser.GameObjects.Text;
  private banner!: HudBanner;
  private goalPanel!: HudGoalPanel;
  private cohesive!: CohesivePresentation;

  private grid: number[][] = [];
  private cell = 44;
  private ox = 0;
  private oy = 90;
  private gridGfx!: Phaser.GameObjects.Graphics;

  private diffMarks: boolean[] = [];
  private foundDiff = 0;
  private cards: Array<{ id: number; face: boolean; matched: boolean; x: number; y: number; rect: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; faceText: string }> = [];
  private flipped: typeof this.cards = [];
  private jigsawSlots: Phaser.GameObjects.Rectangle[] = [];
  private jigsawDone = 0;
  private jigsawCols = 3;
  private jigsawRows = 3;
  private memoryTimerSec = 0;
  private memoryTimerLeft = 0;
  private memoryTimerWarned = false;
  private timerText!: Phaser.GameObjects.Text;
  private kidsJigsaw = false;
  private starReward = false;
  private jigsawLargeBlocks = false;
  private richMatch3 = false;
  private anipopMode = false;
  private anipopHudGfx: Phaser.GameObjects.Graphics | null = null;
  private anipopTopBarLayout: AnipopTopBarLayout | null = null;
  private anipopLevelText: Phaser.GameObjects.Text | null = null;
  private anipopMovesLabelText: Phaser.GameObjects.Text | null = null;
  private anipopMovesNumText: Phaser.GameObjects.Text | null = null;
  private anipopObjectiveScoreText: Phaser.GameObjects.Text | null = null;
  private anipopObjectiveChickText: Phaser.GameObjects.Text | null = null;
  private anipopObjectiveIceText: Phaser.GameObjects.Text | null = null;
  private anipopChickTarget = 14;
  private anipopChicksCollected = 0;
  private anipopMatchCols = 9;
  private anipopMatchRows = 9;
  private anipopIce = new Map<string, number>();
  private anipopIceBroken = 0;
  private anipopIceTarget = 10;
  private anipopLevel = 1;
  private anipopMaxLevel: number = ANIPOP_LEVEL_CONFIGS.length;
  private anipopBoosterCounts: Record<AnipopBoosterId, number> = { hammer: 1, shuffle: 1, steps: 1 };
  private anipopBoosterArmed: AnipopBoosterId | null = null;
  private anipopBoosterGfx: Phaser.GameObjects.Graphics | null = null;
  private anipopBoosterSlots: Array<{ id: AnipopBoosterId; x: number; y: number; r: number }> = [];
  private anipopBoosterCountTexts: Phaser.GameObjects.Text[] = [];
  private memoryEmoji = false;
  private runtimeRng!: () => number;
  private selectedMatch3Cell: { r: number; c: number } | null = null;
  private match3Specials = new Map<string, "rowClear" | "colClear" | "bomb" | "rainbow">();
  private anipopGemImages = new Map<string, Phaser.GameObjects.Image>();
  private anipopOverlayGfx: Phaser.GameObjects.Graphics | null = null;
  private specialTilesCreated = 0;
  private merge2048Grid: number[][] = [];
  private merge2048Texts: Phaser.GameObjects.Text[] = [];

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape: GameSoundscape | null) {
    super({ key: "PuzzleScene" });
    this.spec = spec;
    this.onEnd = onEnd;
    this.soundscape = soundscape;
  }

  preload() {
    if (this.backgroundUrl) {
      this.load.image("bgTex", this.backgroundUrl);
    }
    if (this.spec.samplePlayProfile?.variantId === "color-bloom") {
      registerAnipopGemAtlasLoader(this);
    }
  }

  create() {
    const cohesive = buildSceneCohesion(this.spec);
    this.cohesive = cohesive;
    this.runtimeRng = seededRandom(runtimeSeedFromSpec(this.spec));
    const bp = this.spec.puzzle ?? buildPuzzleBlueprint({ spec: this.spec });
    this.mode = bp.mode;
    this.target = bp.targetScore;
    this.moveLimit = bp.moveLimit;
    this.jigsawCols = bp.cols;
    this.jigsawRows = bp.rows;

    const puzzlePf = this.spec.samplePlayProfile?.puzzle;
    if (puzzlePf?.diffCount && this.mode === "spotDifference") {
      this.target = puzzlePf.diffCount;
    }
    if (puzzlePf?.memoryTimerSec && this.mode === "memoryMatch") {
      this.memoryTimerSec = puzzlePf.memoryTimerSec;
      this.memoryTimerLeft = puzzlePf.memoryTimerSec;
    }
    if (puzzlePf?.kidsJigsaw && this.mode === "jigsaw") {
      this.kidsJigsaw = true;
      this.starReward = puzzlePf.starReward ?? true;
      this.jigsawLargeBlocks = puzzlePf.jigsawLargeBlocks ?? true;
    }
    const variantId = this.spec.samplePlayProfile?.variantId;
    this.anipopMode = variantId === "color-bloom";
    this.richMatch3 = this.anipopMode || (puzzlePf?.match3BloomScale ?? 1) > 1.2;
    this.memoryEmoji = variantId === "memory-match-mania";

    const w = this.scale.width;
    const h = this.scale.height;
    if (this.anipopMode && this.mode === "match3") {
      paintAnipopBackdrop(this, w, h);
    } else if (variantId === "color-bloom" && this.mode === "match3") {
      paintColorBloomBackdrop(this, this.spec, w, h);
    } else {
      paintPuzzleThemeBackdrop(this, this.spec, w, h, this.mode);
    }
    if (this.backgroundUrl && this.textures.exists("bgTex")) {
      const bg = this.add
        .image(w / 2, h / 2, "bgTex")
        .setDepth(-7)
        .setAlpha(assetBackgroundAlpha(this.projectId, cohesive.qualityTier));
      bg.setScale(Math.max(w / bg.width, h / bg.height));
    }

    this.scoreText = styleHudText(
      this.add.text(16, 12, hudScore(this.uiLocale, 0), {
        fontSize: "18px",
        color: "#fff",
      }),
    );
    this.moveText = styleHudText(
      this.add.text(16, 38, hudPuzzleMoves(this.uiLocale, this.moves, this.moveLimit), {
        fontSize: "15px",
        color: "#cbd5e1",
      }),
    );
    if (this.anipopMode) {
      this.scoreText.setVisible(false);
      this.moveText.setVisible(false);
      const pinAnipopHudText = (t: Phaser.GameObjects.Text) => styleHudText(t).setDepth(31).setScrollFactor(0);
      this.anipopHudGfx = this.add.graphics().setDepth(30).setScrollFactor(0);
      this.anipopTopBarLayout = drawAnipopTopBar(this.anipopHudGfx, w, this.uiLocale === "zh-Hans");
      const bar = this.anipopTopBarLayout;
      this.anipopLevelText = pinAnipopHudText(
        this.add
          .text(bar.levelCx, bar.levelCy, "", { fontSize: "14px", color: "#78350f", fontStyle: "bold" })
          .setOrigin(0.5),
      );
      this.anipopMovesLabelText = pinAnipopHudText(
        this.add
          .text(bar.movesCx, bar.movesLabelY, this.uiLocale === "zh-Hans" ? "剩余步数" : "Moves", {
            fontSize: "10px",
            color: "#fef3c7",
          })
          .setOrigin(0.5),
      );
      this.anipopMovesNumText = pinAnipopHudText(
        this.add
          .text(bar.movesCx, bar.movesNumY, String(this.moveLimit), {
            fontSize: "20px",
            color: "#78350f",
            fontStyle: "bold",
          })
          .setOrigin(0.5),
      );
      const chickObj = this.spec.puzzle?.objectives?.find((o) => o.id === "collect-chick");
      void chickObj;
      this.anipopMaxLevel = Math.min(
        this.spec.puzzle?.levelCount ?? ANIPOP_LEVEL_CONFIGS.length,
        ANIPOP_LEVEL_CONFIGS.length,
      );
      this.applyAnipopLevelConfig(1);
      this.anipopObjectiveScoreText = pinAnipopHudText(
        this.add
          .text(bar.objectiveCenters.score, bar.objectiveValueY, "0/1200", {
            fontSize: "12px",
            color: "#78350f",
            fontStyle: "bold",
          })
          .setOrigin(0.5, 0.5),
      );
      this.anipopObjectiveChickText = pinAnipopHudText(
        this.add
          .text(bar.objectiveCenters.chick, bar.objectiveValueY, `0/${this.anipopChickTarget}`, {
            fontSize: "12px",
            color: "#78350f",
            fontStyle: "bold",
          })
          .setOrigin(0.5, 0.5),
      );
      this.anipopObjectiveIceText = pinAnipopHudText(
        this.add
          .text(bar.objectiveCenters.ice, bar.objectiveValueY, `0/${this.anipopIceTarget}`, {
            fontSize: "12px",
            color: "#78350f",
            fontStyle: "bold",
          })
          .setOrigin(0.5, 0.5),
      );
      this.anipopBoosterGfx = this.add.graphics().setDepth(32).setScrollFactor(0);
      for (const id of ["hammer", "shuffle", "steps"] as const) {
        this.anipopBoosterCountTexts.push(
          styleHudText(
            this.add.text(0, 0, "1", { fontSize: "11px", color: "#78350f", fontStyle: "bold" }).setOrigin(0.5).setDepth(33),
          ),
        );
        void id;
      }
    }
    if (this.memoryTimerSec > 0) {
      this.timerText = styleHudText(
        this.add.text(w - 16, 12, `${this.memoryTimerLeft}s`, { fontSize: "16px", color: "#fbbf24" }).setOrigin(1, 0),
      );
    }
    const guidance = buildSceneGoalGuidance(this.spec, this.uiLocale);
    this.banner = new HudBanner(this, this.cohesive.banner);
    this.banner.show(introBannerWhenGoalPanel(guidance));
    this.goalPanel = new HudGoalPanel(this, guidance, this.cohesive, { y: 88, hidden: this.anipopMode });
    this.gridGfx = this.add.graphics();
    if (this.anipopMode) {
      this.gridGfx.setDepth(8);
      this.anipopOverlayGfx = this.add.graphics().setDepth(14);
    } else if (this.spec.samplePlayProfile?.variantId === "color-bloom") {
      this.gridGfx.setDepth(10);
    }

    switch (this.mode) {
      case "spotDifference":
        this.buildSpotDifference(w, h);
        break;
      case "memoryMatch":
        this.buildMemoryMatch(bp.cols, bp.rows, w);
        break;
      case "jigsaw":
        this.buildJigsaw(w, h);
        break;
      case "merge2048":
        this.build2048(bp.cols, bp.rows, w, h);
        break;
      default:
        this.buildMatch3(bp.cols, bp.rows, w);
    }
    schedulePhaserPlayReady(this, 400, {
      puzzleScore: 0,
      puzzleMoves: 0,
      foundDiff: 0,
      flippedCards: 0,
      jigsawDone: 0,
    });
    this.publishQaState();
    this.publishQaClickHints(bp.cols, bp.rows, w, h);
  }

  private publishQaClickHints(cols: number, rows: number, w: number, h: number) {
    switch (this.mode) {
      case "match3": {
        const cr = Math.floor(rows / 2);
        const cc = Math.floor(cols / 2);
        setPhaserQaClickHints([
          { x: (this.ox + (cc + 0.5) * this.cell) / w, y: (this.oy + (cr + 0.5) * this.cell) / h },
          { x: (this.ox + (cc + 1.5) * this.cell) / w, y: (this.oy + (cr + 0.5) * this.cell) / h },
        ]);
        break;
      }
      case "spotDifference": {
        break;
      }
      case "memoryMatch": {
        const c = 0;
        const r = 0;
        setPhaserQaClickHints([
          { x: (this.ox + (c + 0.5) * this.cell) / w, y: (this.oy + (r + 0.5) * this.cell) / h },
          { x: (this.ox + (c + 1.5) * this.cell) / w, y: (this.oy + (r + 0.5) * this.cell) / h },
        ]);
        break;
      }
      case "jigsaw": {
        const colsJ = this.jigsawCols;
        const rowsJ = this.jigsawRows;
        const blockScale = this.jigsawLargeBlocks ? 1.18 : 1;
        const size = Math.min(88 * blockScale, Math.min((w - 100) / (colsJ + 1), (h - 220) / (rowsJ + 2)));
        const px = 36 + size / 2;
        const py = h - 150 + size / 2;
        setPhaserQaClickHints([{ x: px / w, y: py / h }, { x: px / w, y: py / h }]);
        break;
      }
      case "merge2048": {
        setPhaserQaClickHints([
          { x: 0.35, y: 0.52 },
          { x: 0.65, y: 0.52 },
        ]);
        break;
      }
      default:
        break;
    }
  }

  update(_time: number, deltaMs: number) {
    this.goalPanel?.update();
    this.banner.tick();
    if (this.anipopMode && this.anipopHudGfx) {
      const w = this.scale.width;
      const movesLeft = Math.max(0, this.moveLimit - this.moves);
      const zh = this.uiLocale === "zh-Hans";
      this.anipopTopBarLayout = drawAnipopTopBar(this.anipopHudGfx, w, zh);
      const bar = this.anipopTopBarLayout;
      this.anipopLevelText?.setText(zh ? `第 ${this.anipopLevel} 关` : `Lv ${this.anipopLevel}`);
      this.anipopMovesNumText?.setText(String(movesLeft));
      this.anipopObjectiveScoreText?.setText(`${this.score}/${this.target}`);
      this.anipopObjectiveIceText?.setText(`${this.anipopIceBroken}/${this.anipopIceTarget}`);
      this.anipopObjectiveChickText?.setText(`${this.anipopChicksCollected}/${this.anipopChickTarget}`);
      this.anipopLevelText?.setPosition(bar.levelCx, bar.levelCy);
      this.anipopMovesLabelText?.setPosition(bar.movesCx, bar.movesLabelY);
      this.anipopMovesNumText?.setPosition(bar.movesCx, bar.movesNumY);
      this.anipopObjectiveScoreText?.setPosition(bar.objectiveCenters.score, bar.objectiveValueY);
      this.anipopObjectiveIceText?.setPosition(bar.objectiveCenters.ice, bar.objectiveValueY);
      this.anipopObjectiveChickText?.setPosition(bar.objectiveCenters.chick, bar.objectiveValueY);
      if (this.anipopBoosterGfx) {
        const h = this.scale.height;
        this.anipopBoosterSlots = drawAnipopBoosterBar(
          this.anipopBoosterGfx,
          w,
          h,
          this.anipopBoosterCounts,
          this.anipopBoosterArmed,
          this.uiLocale === "zh-Hans",
        );
        for (let i = 0; i < this.anipopBoosterSlots.length; i += 1) {
          const slot = this.anipopBoosterSlots[i]!;
          const t = this.anipopBoosterCountTexts[i];
          if (t) {
            t.setText(String(this.anipopBoosterCounts[slot.id]));
            t.setPosition(slot.x + 16, slot.y - 16);
          }
        }
      }
    }
    if (this.finished) return;
    if (this.memoryTimerSec <= 0) return;
    this.memoryTimerLeft -= deltaMs / 1000;
    if (this.timerText) {
      const left = Math.max(0, Math.ceil(this.memoryTimerLeft));
      this.timerText.setText(`${left}s`);
      if (left <= 10) {
        this.timerText.setColor("#fb7185");
        if (!this.memoryTimerWarned) {
          this.memoryTimerWarned = true;
          juiceHit(this, {
            x: this.scale.width / 2,
            y: 86,
            colorHex: this.cohesive.hud.danger,
            text: this.uiLocale === "zh-Hans" ? "快一点" : "Hurry",
            textColorCss: this.cohesive.hud.danger,
          });
        }
      }
    }
    if (this.memoryTimerLeft <= 0) {
      this.finish(false);
    }
  }

  private finish(won: boolean) {
    if (this.finished) return;
    const zh = this.uiLocale === "zh-Hans";
    if (won && this.anipopMode && this.anipopLevel < this.anipopMaxLevel) {
      this.finished = true;
      const stars =
        this.score >= this.target * 1.4 ? 3 : this.score >= this.target * 1.12 ? 2 : 1;
      this.playAnipopStarFlyIn(stars, () => {
        this.banner.show({
          title: zh ? `第 ${this.anipopLevel} 关完成` : `Level ${this.anipopLevel} cleared`,
          message: zh
            ? `获得 ${stars} 星 · 进入第 ${this.anipopLevel + 1} 关`
            : `${stars} star(s) · Level ${this.anipopLevel + 1} next`,
          ms: 1600,
        });
        juiceWin(this, {
          x: this.scale.width / 2,
          y: this.scale.height * 0.44,
          colorHex: themeParticleHex(this.spec),
          text: zh ? "过关" : "Clear",
          textColorCss: this.cohesive.hud.accent,
        });
        this.time.delayedCall(1600, () => {
          this.advanceAnipopLevel();
          this.finished = false;
          this.banner.show({
            title: zh ? `第 ${this.anipopLevel} 关` : `Level ${this.anipopLevel}`,
            message: zh ? "目标已更新，继续消除吧！" : "New goals — keep matching!",
            ms: 1400,
          });
        });
      });
      return;
    }
    this.finished = true;
    const base = bannerPuzzleFinish(this.uiLocale, won);
    if (won && this.anipopMode) {
      const stars =
        this.score >= this.target * 1.4 ? 3 : this.score >= this.target * 1.12 ? 2 : 1;
      const allClear = this.anipopLevel >= this.anipopMaxLevel;
      this.banner.show({
        title: base.title,
        message: zh
          ? allClear
            ? `全部 ${this.anipopMaxLevel} 关通关！${stars} 星`
            : `三星过关！获得 ${stars} 星`
          : allClear
            ? `All ${this.anipopMaxLevel} levels cleared! ${stars} star(s)`
            : `Cleared with ${stars} star(s)!`,
        ms: 2200,
      });
    } else {
      this.banner.show({ ...base, ms: 2200 });
    }
    if (won) {
      juiceWin(this, {
        x: this.scale.width / 2,
        y: this.scale.height * 0.44,
        colorHex: themeParticleHex(this.spec),
        text: this.uiLocale === "zh-Hans" ? "解开了" : "Solved",
        textColorCss: this.cohesive.hud.accent,
      });
    } else {
      juiceFail(this, {
        x: this.scale.width / 2,
        y: this.scale.height * 0.44,
        colorHex: this.cohesive.hud.danger,
        text: this.uiLocale === "zh-Hans" ? "失败" : "Fail",
        textColorCss: this.cohesive.hud.danger,
      });
    }
    this.time.delayedCall(2200, () => this.onEnd({ score: this.score, won }));
  }

  private addMove(cost = 1) {
    this.moves += cost;
    if (this.mode !== "merge2048") {
      this.moveText.setText(hudPuzzleMoves(this.uiLocale, this.moves, this.moveLimit));
      if (this.anipopMode) this.checkAnipopWin();
      else if (this.moves >= this.moveLimit && this.score < this.target) this.finish(false);
    }
    this.publishQaState();
  }

  private publishQaState() {
    const flippedCards = this.cards.filter((c) => c.face && !c.matched).length;
    setPhaserQaState({
      puzzleScore: this.score,
      puzzleMoves: this.moves,
      foundDiff: this.foundDiff,
      flippedCards,
      jigsawDone: this.jigsawDone,
      match3Specials: this.match3Specials.size,
      specialTilesCreated: this.specialTilesCreated,
      merge2048Max: Math.max(0, ...this.merge2048Grid.flat()),
    });
  }

  private build2048(cols: number, rows: number, w: number, h: number) {
    this.cell = Math.min(92, (w - 70) / cols, (h - 210) / rows);
    this.ox = (w - this.cell * cols) / 2;
    this.oy = Math.max(150, (h - this.cell * rows) / 2 + 24);
    this.merge2048Grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
    this.merge2048Grid[0]![0] = 2;
    this.merge2048Grid[0]![1] = 2;
    this.merge2048Grid[1]![0] = 4;
    this.spawn2048Tile();
    this.redraw2048(cols, rows);
    this.add
      .text(w / 2, h - 48, this.uiLocale === "zh-Hans" ? "方向键 / WASD 滑动合成数字" : "Arrow keys / WASD to merge", {
        fontSize: "14px",
        color: "#fff7ed",
      })
      .setOrigin(0.5)
      .setDepth(20);
    const move = (dir: "left" | "right" | "up" | "down") => this.move2048(dir, cols, rows);
    this.input.keyboard?.on("keydown-LEFT", () => move("left"));
    this.input.keyboard?.on("keydown-A", () => move("left"));
    this.input.keyboard?.on("keydown-RIGHT", () => move("right"));
    this.input.keyboard?.on("keydown-D", () => move("right"));
    this.input.keyboard?.on("keydown-UP", () => move("up"));
    this.input.keyboard?.on("keydown-W", () => move("up"));
    this.input.keyboard?.on("keydown-DOWN", () => move("down"));
    this.input.keyboard?.on("keydown-S", () => move("down"));
    let touchDownX = 0;
    let touchDownY = 0;
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      touchDownX = p.x;
      touchDownY = p.y;
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      const dx = p.x - touchDownX;
      const dy = p.y - touchDownY;
      if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
      if (Math.abs(dx) >= Math.abs(dy)) move(dx < 0 ? "left" : "right");
      else move(dy < 0 ? "up" : "down");
    });
  }

  private has2048Moves(cols: number, rows: number): boolean {
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const v = this.merge2048Grid[r]![c]!;
        if (v === 0) return true;
        if (c + 1 < cols && this.merge2048Grid[r]![c + 1] === v) return true;
        if (r + 1 < rows && this.merge2048Grid[r + 1]![c] === v) return true;
      }
    }
    return false;
  }

  private finish2048GameOver() {
    if (this.finished) return;
    this.banner.show({
      title: this.uiLocale === "zh-Hans" ? "无路可走" : "No moves left",
      message: this.uiLocale === "zh-Hans" ? `最高 ${Math.max(...this.merge2048Grid.flat())}` : `Best ${Math.max(...this.merge2048Grid.flat())}`,
      ms: 2200,
    });
    juiceFail(this, {
      x: this.scale.width / 2,
      y: this.oy - 20,
      colorHex: this.cohesive.hud.danger,
      text: this.uiLocale === "zh-Hans" ? "无路可走" : "Stuck",
      textColorCss: this.cohesive.hud.danger,
    });
    this.finish(false);
  }

  private move2048(dir: "left" | "right" | "up" | "down", cols: number, rows: number) {
    if (this.finished) return;
    const before = JSON.stringify(this.merge2048Grid);
    const scoreGain = { value: 0 };
    const compress = (line: number[]) => {
      const values = line.filter((v) => v > 0);
      const out: number[] = [];
      for (let i = 0; i < values.length; i += 1) {
        if (values[i] === values[i + 1]) {
          const merged = values[i]! * 2;
          scoreGain.value += merged;
          out.push(merged);
          i += 1;
        } else {
          out.push(values[i]!);
        }
      }
      while (out.length < line.length) out.push(0);
      return out;
    };
    if (dir === "left" || dir === "right") {
      for (let r = 0; r < rows; r += 1) {
        const line = dir === "left" ? this.merge2048Grid[r]! : [...this.merge2048Grid[r]!].reverse();
        const merged = compress(line);
        this.merge2048Grid[r] = dir === "left" ? merged : merged.reverse();
      }
    } else {
      for (let c = 0; c < cols; c += 1) {
        const line = Array.from({ length: rows }, (_, r) => this.merge2048Grid[r]![c]!);
        const merged = compress(dir === "up" ? line : line.reverse());
        const finalLine = dir === "up" ? merged : merged.reverse();
        for (let r = 0; r < rows; r += 1) this.merge2048Grid[r]![c] = finalLine[r]!;
      }
    }
    if (JSON.stringify(this.merge2048Grid) === before) return;
    this.score += scoreGain.value;
    this.scoreText.setText(hudScore(this.uiLocale, this.score));
    this.spawn2048Tile();
    this.addMove();
    this.redraw2048(cols, rows);
    const maxTile = Math.max(...this.merge2048Grid.flat());
    juiceBurst(this, this.scale.width / 2, this.oy - 20, "#f97316", maxTile >= 128 ? 20 : 12, this.runtimeRng);
    playBleep("pickup");
    this.publishQaState();
    if (maxTile >= this.target) this.finish(true);
    else if (!this.has2048Moves(cols, rows)) this.finish2048GameOver();
  }

  private spawn2048Tile() {
    const empty: Array<{ r: number; c: number }> = [];
    for (let r = 0; r < this.merge2048Grid.length; r += 1) {
      for (let c = 0; c < (this.merge2048Grid[r]?.length ?? 0); c += 1) {
        if (this.merge2048Grid[r]![c] === 0) empty.push({ r, c });
      }
    }
    if (!empty.length) return;
    const pick = empty[Math.floor(this.runtimeRng() * empty.length)]!;
    this.merge2048Grid[pick.r]![pick.c] = this.runtimeRng() > 0.85 ? 4 : 2;
  }

  private redraw2048(cols: number, rows: number) {
    const palette: Record<number, number> = {
      0: 0xc7b8ae,
      2: 0xfde68a,
      4: 0xfbbf24,
      8: 0xfb923c,
      16: 0xf97316,
      32: 0xef4444,
      64: 0xec4899,
      128: 0x8b5cf6,
      256: 0x06b6d4,
      512: 0x22c55e,
      1024: 0x84cc16,
      2048: 0xfacc15,
    };
    this.merge2048Texts.forEach((t) => t.destroy());
    this.merge2048Texts = [];
    this.gridGfx.clear();
    this.gridGfx.fillStyle(0x8d7b68, 0.85);
    this.gridGfx.fillRoundedRect(this.ox - 10, this.oy - 10, this.cell * cols + 20, this.cell * rows + 20, 14);
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const value = this.merge2048Grid[r]?.[c] ?? 0;
        const x = this.ox + c * this.cell;
        const y = this.oy + r * this.cell;
        this.gridGfx.fillStyle(palette[value] ?? 0x0ea5e9, 1);
        this.gridGfx.fillRoundedRect(x + 4, y + 4, this.cell - 8, this.cell - 8, 10);
        if (value > 0) {
          const label = styleHudText(
            this.add
              .text(x + this.cell / 2, y + this.cell / 2, String(value), {
                fontSize: `${Math.max(20, Math.floor(this.cell * 0.34))}px`,
                color: value >= 8 ? "#fff7ed" : "#111827",
              })
              .setOrigin(0.5)
              .setDepth(4),
          );
          this.merge2048Texts.push(label);
        }
      }
    }
  }

  private buildMatch3(cols: number, rows: number, w: number) {
    const bloomScale = this.spec.samplePlayProfile?.puzzle?.match3BloomScale ?? 1;
    const swapMode = this.anipopMode || this.spec.puzzle?.matchMechanic === "swap";
    const h = this.scale.height;
    const paletteSize = this.anipopMode ? 5 : COLORS.length;
    this.anipopMatchCols = cols;
    this.anipopMatchRows = rows;
    this.cell = this.anipopMode ? Math.min(42, (w - 48) / cols) : Math.min(48, (w - 40) / cols);
    this.ox = (w - this.cell * cols) / 2;
    this.oy = this.anipopMode ? 88 : Math.max(120, (h - this.cell * rows) / 2 + 16);
    if (this.anipopMode) {
      drawAnipopBoardFrame(this.gridGfx, this.ox, this.oy, this.cell * cols, this.cell * rows);
    } else {
      paintPuzzleBoardFrame(this, this.spec, this.ox - 4, this.oy - 4, this.cell * cols + 8, this.cell * rows + 8);
    }
    this.grid = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => Math.floor(this.runtimeRng() * paletteSize)),
    );
    if (this.anipopMode) {
      this.ensureNoInitialMatch3(cols, rows, paletteSize);
      this.seedAnipopIce(cols, rows);
      const cr = Math.floor(rows / 2);
      const cc = Math.floor(cols / 2);
      this.grid[cr]![cc] = 0;
      this.grid[cr]![cc + 1] = 1;
      this.grid[cr]![cc + 2] = 0;
    } else if (swapMode) {
      const cr = Math.floor(rows / 2);
      const cc = Math.floor(cols / 2);
      this.grid[cr]![cc] = 0;
      this.grid[cr]![cc + 1] = 1;
      this.grid[cr]![cc + 2] = 0;
      this.grid[cr + 1]![cc + 1] = 2;
    }
    this.redrawMatch3(cols, rows);
    const hint = this.anipopMode ? anipopSwapHint(this.uiLocale === "zh-Hans") : hudPuzzleMatch3Hint(this.uiLocale);
    const hintY = this.anipopMode ? h - 96 : h - 88;
    this.add
      .text(w / 2, hintY, hint, {
        fontSize: this.anipopMode ? "11px" : "12px",
        color: "#fef3c7",
        backgroundColor: this.anipopMode ? "rgba(15, 39, 68, 0.55)" : undefined,
        padding: this.anipopMode ? { x: 8, y: 3 } : undefined,
      })
      .setOrigin(0.5)
      .setDepth(25)
      .setScrollFactor(0);
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.finished) return;
      if (this.anipopMode && this.anipopBoosterGfx) {
        const hit = hitAnipopBooster(this.anipopBoosterSlots, p.x, p.y);
        if (hit) {
          this.activateAnipopBooster(hit, cols, rows, p.x, p.y);
          return;
        }
      }
      const c = Math.floor((p.x - this.ox) / this.cell);
      const r = Math.floor((p.y - this.oy) / this.cell);
      if (c < 0 || c >= cols || r < 0 || r >= rows) return;
      if (this.anipopMode && this.anipopBoosterArmed === "hammer") {
        this.useAnipopHammer(r, c, cols, rows, p.x, p.y);
        return;
      }
      if (swapMode) {
        this.handleSwapMatch3(r, c, cols, rows, p.x, p.y);
        return;
      }
      const color = this.grid[r]![c]!;
      const group = this.floodMatch3(r, c, color, new Set());
      if (group.size < 2) {
        juiceHit(this, {
          x: p.x,
          y: p.y,
          colorHex: "#e2e8f0",
          text: this.uiLocale === "zh-Hans" ? "再试" : "Try again",
          textColorCss: "#e2e8f0",
        });
        return;
      }
      for (const key of group) {
        const [rr, cc] = key.split(",").map(Number);
        this.grid[rr]![cc] = -1;
      }
      this.collapseMatch3(cols, rows);
      const gain = group.size * group.size * 3;
      this.score += gain;
      this.scoreText.setText(hudScore(this.uiLocale, this.score));
      this.addMove();
      const combo = Math.max(group.size, Math.round(group.size * bloomScale));
      juiceCombo(this, {
        x: p.x,
        y: p.y,
        colorHex: COLORS[color] ?? "#fff",
        text: this.richMatch3 && group.size >= 4 ? `${this.uiLocale === "zh-Hans" ? "绽放" : "Bloom"} +${gain}` : `+${gain}`,
        textColorCss: this.richMatch3 && group.size >= 4 ? "#f472b6" : this.cohesive.hud.accent,
        combo,
        large: group.size >= 5,
      });
      playBleep("pickup");
      this.redrawMatch3(cols, rows);
      if (this.score >= this.target) this.finish(true);
    });
  }

  private handleSwapMatch3(r: number, c: number, cols: number, rows: number, x: number, y: number) {
    const palette = this.anipopMode ? ANIPOP_COLORS : COLORS;
    if (!this.selectedMatch3Cell) {
      if (this.anipopMode && this.anipopIce.has(`${r},${c}`)) {
        const zh = this.uiLocale === "zh-Hans";
        const icedSpecial = this.match3Specials.has(`${r},${c}`);
        juiceHit(this, {
          x,
          y,
          colorHex: icedSpecial ? "#fef08a" : "#bae6fd",
          text: icedSpecial
            ? zh
              ? "先破冰，再激活特殊块"
              : "Break ice to use special"
            : zh
              ? "冰块不可选"
              : "Frozen",
          textColorCss: icedSpecial ? "#fef08a" : "#bae6fd",
        });
        return;
      }
      this.selectedMatch3Cell = { r, c };
      this.redrawMatch3(cols, rows);
      return;
    }

    const first = this.selectedMatch3Cell;
    this.selectedMatch3Cell = null;
    const adjacent = Math.abs(first.r - r) + Math.abs(first.c - c) === 1;
    if (!adjacent) {
      this.selectedMatch3Cell = { r, c };
      this.redrawMatch3(cols, rows);
      juiceHit(this, { x, y, colorHex: "#e2e8f0", text: this.uiLocale === "zh-Hans" ? "相邻交换" : "Adjacent", textColorCss: "#e2e8f0" });
      return;
    }
    if (
      this.anipopMode &&
      (this.anipopIce.has(`${first.r},${first.c}`) || this.anipopIce.has(`${r},${c}`))
    ) {
      this.redrawMatch3(cols, rows);
      juiceHit(this, {
        x,
        y,
        colorHex: "#bae6fd",
        text: this.uiLocale === "zh-Hans" ? "冰块不可交换" : "Frozen",
        textColorCss: "#bae6fd",
      });
      return;
    }

    const keyA = `${first.r},${first.c}`;
    const keyB = `${r},${c}`;
    const spA = this.match3Specials.get(keyA);
    const spB = this.match3Specials.get(keyB);
    if (this.anipopMode && (spA || spB)) {
      const gemA = this.grid[first.r]![first.c]!;
      const gemB = this.grid[r]![c]!;
      this.grid[first.r]![first.c] = gemB;
      this.grid[r]![c] = gemA;
      this.match3Specials.delete(keyA);
      this.match3Specials.delete(keyB);
      if (spB) this.match3Specials.set(keyA, spB);
      if (spA) this.match3Specials.set(keyB, spA);
      this.executeAnipopSpecialSwap(first, { r, c }, cols, rows, x, y, spA ?? null, spB ?? null);
      return;
    }

    const a = this.grid[first.r]![first.c]!;
    this.grid[first.r]![first.c] = this.grid[r]![c]!;
    this.grid[r]![c] = a;
    if (this.findLineMatches(cols, rows).size === 0) {
      const back = this.grid[first.r]![first.c]!;
      this.grid[first.r]![first.c] = this.grid[r]![c]!;
      this.grid[r]![c] = back;
      this.redrawMatch3(cols, rows);
      juiceHit(this, { x, y, colorHex: "#e2e8f0", text: this.uiLocale === "zh-Hans" ? "未成三消" : "No match", textColorCss: "#e2e8f0" });
      return;
    }

    this.addMove();
    const result = this.resolveMatch3Cascade(cols, rows, { r, c });
    const gain = result.cleared * 12 + result.chains * 25 + (result.specialType ? 40 : 0);
    this.score += gain;
    this.scoreText.setText(hudScore(this.uiLocale, this.score));
    this.publishQaState();
    const zh = this.uiLocale === "zh-Hans";
    juiceCombo(this, {
      x,
      y,
      colorHex: palette[a] ?? this.cohesive.hud.accent,
      text:
        result.chains >= 2
          ? zh
            ? `连锁 x${result.chains} +${gain}`
            : `Chain x${result.chains} +${gain}`
          : result.specialType
            ? zh
              ? `特殊块 +${gain}`
              : `Special +${gain}`
            : `+${gain}`,
      textColorCss: this.cohesive.hud.accent,
      combo: Math.max(3, result.chains),
      large: result.chains >= 2 || Boolean(result.specialType),
    });
    playBleep("pickup");
    this.redrawMatch3(cols, rows);
    this.checkAnipopWin();
  }

  private checkAnipopWin() {
    if (!this.anipopMode) {
      if (this.score >= this.target) this.finish(true);
      return;
    }
    if (
      this.score >= this.target &&
      this.anipopChicksCollected >= this.anipopChickTarget &&
      this.anipopIceBroken >= this.anipopIceTarget
    ) {
      this.finish(true);
    } else if (this.moves >= this.moveLimit) {
      this.finish(false);
    }
  }

  private applyAnipopLevelConfig(level: number) {
    const cfg = ANIPOP_LEVEL_CONFIGS[Math.min(level, ANIPOP_LEVEL_CONFIGS.length) - 1]!;
    this.anipopLevel = level;
    this.target = cfg.scoreTarget;
    this.moveLimit = cfg.moveLimit;
    this.anipopChickTarget = cfg.chickTarget;
    this.anipopIceTarget = cfg.iceTarget;
  }

  private playAnipopStarFlyIn(stars: number, onDone: () => void) {
    const bar = this.anipopTopBarLayout;
    if (!bar || stars <= 0) {
      onDone();
      return;
    }
    const cx = this.scale.width / 2;
    const cy = this.scale.height * 0.42;
    let done = 0;
    const finishOne = () => {
      done += 1;
      if (done >= stars) onDone();
    };
    for (let i = 0; i < stars; i += 1) {
      const star = this.add
        .text(cx + (i - (stars - 1) / 2) * 30, cy, "⭐", { fontSize: "30px" })
        .setDepth(220)
        .setOrigin(0.5);
      this.tweens.add({
        targets: star,
        x: bar.levelCx + (i - (stars - 1) / 2) * 10,
        y: bar.levelCy,
        scale: 0.55,
        alpha: 0.92,
        duration: 700 + i * 110,
        ease: "Cubic.easeOut",
        onComplete: () => {
          star.destroy();
          finishOne();
        },
      });
    }
  }

  private advanceAnipopLevel() {
    const cols = this.anipopMatchCols;
    const rows = this.anipopMatchRows;
    const paletteSize = 5;
    this.applyAnipopLevelConfig(this.anipopLevel + 1);
    this.score = 0;
    this.moves = 0;
    this.anipopChicksCollected = 0;
    this.anipopIceBroken = 0;
    this.match3Specials.clear();
    this.selectedMatch3Cell = null;
    this.anipopBoosterArmed = null;
    if (this.anipopLevel === 2) this.anipopBoosterCounts.hammer += 1;
    if (this.anipopLevel === 3) {
      this.anipopBoosterCounts.shuffle += 1;
      this.anipopBoosterCounts.steps += 1;
    }
    this.grid = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => Math.floor(this.runtimeRng() * paletteSize)),
    );
    this.ensureNoInitialMatch3(cols, rows, paletteSize);
    this.seedAnipopIce(cols, rows);
    this.redrawMatch3(cols, rows);
    this.finished = false;
    this.publishQaState();
  }

  private seedAnipopIce(cols: number, rows: number) {
    this.anipopIce.clear();
    this.anipopIceBroken = 0;
    const cr = Math.floor(rows / 2);
    const cc = Math.floor(cols / 2);
    let placed = 0;
    const iceGoal = this.anipopIceTarget;
    while (placed < iceGoal) {
      const r = Math.floor(this.runtimeRng() * rows);
      const c = Math.floor(this.runtimeRng() * cols);
      if (Math.abs(r - cr) <= 1 && Math.abs(c - cc) <= 2) continue;
      const key = `${r},${c}`;
      if (this.anipopIce.has(key)) continue;
      this.anipopIce.set(key, 1 + Math.floor(this.runtimeRng() * 2));
      placed += 1;
    }
  }

  private expandSpecialBlast(
    kind: "rowClear" | "colClear" | "bomb" | "rainbow",
    r: number,
    c: number,
    cols: number,
    rows: number,
    rainbowColor?: number,
  ): Set<string> {
    const blast = new Set<string>();
    if (kind === "rowClear") {
      for (let cc = 0; cc < cols; cc += 1) blast.add(`${r},${cc}`);
    } else if (kind === "colClear") {
      for (let rr = 0; rr < rows; rr += 1) blast.add(`${rr},${c}`);
    } else if (kind === "bomb") {
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) blast.add(`${rr},${cc}`);
        }
      }
    } else if (kind === "rainbow" && rainbowColor !== undefined && rainbowColor >= 0) {
      for (let rr = 0; rr < rows; rr += 1) {
        for (let cc = 0; cc < cols; cc += 1) {
          if (this.grid[rr]![cc] === rainbowColor) blast.add(`${rr},${cc}`);
        }
      }
    }
    return blast;
  }

  private detectSpecialFromMatch(
    matches: Set<string>,
    swapCell: { r: number; c: number },
  ): { type: "rowClear" | "colClear" | "bomb" | "rainbow"; spawnKey: string } | null {
    if (!this.anipopMode || matches.size < 4) return null;
    const spawnKey = this.pickSpecialSpawnKey(matches, swapCell);
    if (matches.size >= 5) return { type: "rainbow", spawnKey };
    const matchRows = new Set([...matches].map((k) => Number(k.split(",")[0])));
    const matchCols = new Set([...matches].map((k) => Number(k.split(",")[1])));
    if (matchRows.size === 1) return { type: "rowClear", spawnKey };
    if (matchCols.size === 1) return { type: "colClear", spawnKey };
    return { type: "bomb", spawnKey };
  }

  private pickSpecialSpawnKey(matches: Set<string>, swapCell: { r: number; c: number }): string {
    const iceFree = [...matches].filter((k) => !this.anipopIce.has(k));
    const pool = iceFree.length > 0 ? iceFree : [...matches];
    const swapKey = `${swapCell.r},${swapCell.c}`;
    if (pool.includes(swapKey)) return swapKey;
    return pool[0]!;
  }

  private expandMatchesWithSpecials(matches: Set<string>, cols: number, rows: number): Set<string> {
    const expanded = new Set(matches);
    let changed = true;
    while (changed) {
      changed = false;
      for (const key of [...expanded]) {
        const sp = this.match3Specials.get(key);
        if (!sp) continue;
        const [rr, cc] = key.split(",").map(Number);
        const color = this.grid[rr]![cc]!;
        const blast = this.expandSpecialBlast(sp, rr, cc, cols, rows, sp === "rainbow" ? color : undefined);
        this.match3Specials.delete(key);
        for (const bk of blast) {
          if (!expanded.has(bk)) {
            expanded.add(bk);
            changed = true;
          }
        }
      }
    }
    return expanded;
  }

  private executeAnipopSpecialSwap(
    cellA: { r: number; c: number },
    cellB: { r: number; c: number },
    cols: number,
    rows: number,
    x: number,
    y: number,
    spA: "rowClear" | "colClear" | "bomb" | "rainbow" | null,
    spB: "rowClear" | "colClear" | "bomb" | "rainbow" | null,
  ) {
    this.addMove();
    const keyA = `${cellA.r},${cellA.c}`;
    const keyB = `${cellB.r},${cellB.c}`;
    const blasts = new Set<string>();
    const partnerA = this.grid[cellA.r]![cellA.c]!;
    const partnerB = this.grid[cellB.r]![cellB.c]!;

    const appendBlast = (
      sp: "rowClear" | "colClear" | "bomb" | "rainbow",
      r: number,
      c: number,
      partnerColor: number,
    ) => {
      const blast = this.expandSpecialBlast(
        sp,
        r,
        c,
        cols,
        rows,
        sp === "rainbow" ? partnerColor : undefined,
      );
      for (const bk of blast) blasts.add(bk);
      this.match3Specials.delete(`${r},${c}`);
    };

    if (spA) appendBlast(spA, cellB.r, cellB.c, partnerA);
    if (spB) appendBlast(spB, cellA.r, cellA.c, partnerB);
    if (spA && spB) {
      for (const key of [keyA, keyB]) {
        const [rr, cc] = key.split(",").map(Number);
        const blast = this.expandSpecialBlast("bomb", rr, cc, cols, rows);
        for (const bk of blast) blasts.add(bk);
      }
    }
    blasts.add(keyA);
    blasts.add(keyB);

    const cleared = this.processMatchClear(blasts, cols, rows);
    this.collapseMatch3(cols, rows);
    const result = this.resolveMatch3Cascade(cols, rows, cellB);
    const gain = cleared * 12 + result.cleared * 12 + result.chains * 25 + 60;
    this.score += gain;
    this.scoreText.setText(hudScore(this.uiLocale, this.score));
    this.publishQaState();
    const zh = this.uiLocale === "zh-Hans";
    const label =
      spA && spB
        ? zh
          ? "双特殊!"
          : "Double special!"
        : spA === "rainbow" || spB === "rainbow"
          ? zh
            ? "彩虹清场"
            : "Rainbow!"
          : spA === "bomb" || spB === "bomb"
            ? zh
              ? "炸弹!"
              : "Bomb!"
            : zh
              ? "直线消除"
              : "Line clear!";
    juiceCombo(this, {
      x,
      y,
      colorHex: "#f472b6",
      text: `${label} +${gain}`,
      textColorCss: "#f472b6",
      combo: Math.max(4, result.chains + 1),
      large: true,
    });
    playBleep("pickup");
    this.redrawMatch3(cols, rows);
    this.checkAnipopWin();
  }

  private activateAnipopBooster(id: AnipopBoosterId, cols: number, rows: number, x: number, y: number) {
    if (this.anipopBoosterCounts[id] <= 0) return;
    if (id === "steps") {
      this.anipopBoosterCounts.steps -= 1;
      this.moveLimit += 5;
      juicePickup(this, {
        x,
        y,
        colorHex: "#4ade80",
        text: this.uiLocale === "zh-Hans" ? "+5 步" : "+5 moves",
        textColorCss: "#4ade80",
      });
      return;
    }
    if (id === "shuffle") {
      this.anipopBoosterCounts.shuffle -= 1;
      this.shuffleAnipopGrid(cols, rows);
      juicePickup(this, {
        x,
        y,
        colorHex: "#38bdf8",
        text: this.uiLocale === "zh-Hans" ? "重排" : "Shuffle",
        textColorCss: "#38bdf8",
      });
      return;
    }
    this.anipopBoosterArmed = this.anipopBoosterArmed === "hammer" ? null : "hammer";
  }

  private shuffleAnipopGrid(cols: number, rows: number) {
    const gems: number[] = [];
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const v = this.grid[r]![c]!;
        if (v >= 0) gems.push(v);
      }
    }
    for (let i = gems.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.runtimeRng() * (i + 1));
      [gems[i], gems[j]] = [gems[j]!, gems[i]!];
    }
    let idx = 0;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (this.grid[r]![c]! >= 0) {
          this.grid[r]![c] = gems[idx] ?? 0;
          idx += 1;
        }
      }
    }
    this.ensureNoInitialMatch3(cols, rows, 5);
    this.redrawMatch3(cols, rows);
  }

  private useAnipopHammer(r: number, c: number, cols: number, rows: number, x: number, y: number) {
    if (this.anipopBoosterCounts.hammer <= 0) return;
    const key = `${r},${c}`;
    const sp = this.match3Specials.get(key);
    this.anipopBoosterCounts.hammer -= 1;
    this.anipopBoosterArmed = null;
    if (sp) {
      this.match3Specials.delete(key);
      if (this.anipopIce.has(key)) {
        this.anipopIce.delete(key);
        this.anipopIceBroken += 1;
      }
      const color = this.grid[r]![c]!;
      const blast = this.expandSpecialBlast(sp, r, c, cols, rows, sp === "rainbow" ? color : undefined);
      const cleared = this.processMatchClear(blast, cols, rows);
      this.collapseMatch3(cols, rows);
      const result = this.resolveMatch3Cascade(cols, rows, { r, c });
      const gain = cleared * 12 + result.cleared * 12 + result.chains * 25 + 50;
      this.score += gain;
      juiceCombo(this, {
        x,
        y,
        colorHex: "#f472b6",
        text: this.uiLocale === "zh-Hans" ? `特殊引爆 +${gain}` : `Special +${gain}`,
        textColorCss: "#f472b6",
        combo: Math.max(3, result.chains + 1),
        large: true,
      });
      playBleep("pickup");
      this.redrawMatch3(cols, rows);
      this.checkAnipopWin();
      return;
    }
    if (this.anipopIce.has(key)) {
      this.anipopIce.delete(key);
      this.anipopIceBroken += 1;
    }
    this.match3Specials.delete(key);
    const color = this.grid[r]![c]!;
    if (color === 4) this.anipopChicksCollected += 1;
    this.grid[r]![c] = -1;
    this.collapseMatch3(cols, rows);
    const result = this.resolveMatch3Cascade(cols, rows, { r, c });
    const gain = result.cleared * 10 + result.chains * 20;
    this.score += gain;
    juiceCombo(this, {
      x,
      y,
      colorHex: "#f59e0b",
      text: this.uiLocale === "zh-Hans" ? `锤子 +${gain}` : `Hammer +${gain}`,
      textColorCss: "#f59e0b",
      combo: Math.max(2, result.chains),
      large: result.chains >= 2,
    });
    playBleep("pickup");
    this.redrawMatch3(cols, rows);
    this.checkAnipopWin();
  }

  private processMatchClear(matches: Set<string>, cols: number, rows: number): number {
    let cleared = 0;
    const adjacentIce = new Set<string>();
    for (const key of matches) {
      const [rr, cc] = key.split(",").map(Number);
      for (const [nr, nc] of [
        [rr - 1, cc],
        [rr + 1, cc],
        [rr, cc - 1],
        [rr, cc + 1],
      ] as const) {
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        const nk = `${nr},${nc}`;
        if (this.anipopIce.has(nk)) adjacentIce.add(nk);
      }
      const ice = this.anipopIce.get(key);
      if (ice && ice > 0) {
        if (ice <= 1) {
          this.anipopIce.delete(key);
          this.anipopIceBroken += 1;
        } else this.anipopIce.set(key, ice - 1);
      } else {
        const color = this.grid[rr]![cc]!;
        if (this.anipopMode && color === 4) this.anipopChicksCollected += 1;
        this.grid[rr]![cc] = -1;
        this.match3Specials.delete(key);
        cleared += 1;
      }
    }
    for (const key of adjacentIce) {
      if (matches.has(key)) continue;
      const ice = this.anipopIce.get(key)!;
      if (ice <= 1) {
        this.anipopIce.delete(key);
        this.anipopIceBroken += 1;
      } else this.anipopIce.set(key, ice - 1);
    }
    return cleared;
  }

  private resolveMatch3Cascade(
    cols: number,
    rows: number,
    swapCell: { r: number; c: number },
  ): { cleared: number; chains: number; specialType: "rowClear" | "colClear" | "bomb" | "rainbow" | null } {
    let totalCleared = 0;
    let chains = 0;
    let specialType: "rowClear" | "colClear" | "bomb" | "rainbow" | null = null;

    while (true) {
      let matches = this.findLineMatches(cols, rows);
      if (matches.size === 0) break;
      chains += 1;
      let pendingSpawn: { key: string; type: "rowClear" | "colClear" | "bomb" | "rainbow" } | null = null;
      if (chains === 1) {
        const det = this.detectSpecialFromMatch(matches, swapCell);
        if (det) {
          pendingSpawn = { key: det.spawnKey, type: det.type };
          matches.delete(det.spawnKey);
          specialType = det.type;
        }
      }
      matches = this.expandMatchesWithSpecials(matches, cols, rows);
      totalCleared += this.anipopMode
        ? this.processMatchClear(matches, cols, rows)
        : this.clearMatchCellsSimple(matches);
      if (pendingSpawn) {
        const [sr, sc] = pendingSpawn.key.split(",").map(Number);
        if (this.grid[sr]?.[sc]! >= 0) {
          this.match3Specials.set(pendingSpawn.key, pendingSpawn.type);
          this.specialTilesCreated += 1;
        }
      }
      this.collapseMatch3(cols, rows);
    }

    return { cleared: totalCleared, chains, specialType };
  }

  private clearMatchCellsSimple(matches: Set<string>): number {
    for (const key of matches) {
      const [rr, cc] = key.split(",").map(Number);
      this.grid[rr]![cc] = -1;
      this.match3Specials.delete(key);
    }
    return matches.size;
  }

  private ensureNoInitialMatch3(cols: number, rows: number, paletteSize: number) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (this.findLineMatches(cols, rows).size === 0) return;
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          this.grid[r]![c] = Math.floor(this.runtimeRng() * paletteSize);
        }
      }
    }
  }

  private findLineMatches(cols: number, rows: number): Set<string> {
    const matches = new Set<string>();
    for (let r = 0; r < rows; r += 1) {
      let start = 0;
      for (let c = 1; c <= cols; c += 1) {
        if (c < cols && this.grid[r]![c] === this.grid[r]![start]) continue;
        if (this.grid[r]![start]! >= 0 && c - start >= 3) {
          for (let cc = start; cc < c; cc += 1) matches.add(`${r},${cc}`);
        }
        start = c;
      }
    }
    for (let c = 0; c < cols; c += 1) {
      let start = 0;
      for (let r = 1; r <= rows; r += 1) {
        if (r < rows && this.grid[r]![c] === this.grid[start]![c]) continue;
        if (this.grid[start]![c]! >= 0 && r - start >= 3) {
          for (let rr = start; rr < r; rr += 1) matches.add(`${rr},${c}`);
        }
        start = r;
      }
    }
    return matches;
  }

  private floodMatch3(r: number, c: number, color: number, seen: Set<string>): Set<string> {
    const key = `${r},${c}`;
    if (seen.has(key)) return seen;
    if (this.grid[r]?.[c] !== color) return seen;
    seen.add(key);
    this.floodMatch3(r - 1, c, color, seen);
    this.floodMatch3(r + 1, c, color, seen);
    this.floodMatch3(r, c - 1, color, seen);
    this.floodMatch3(r, c + 1, color, seen);
    return seen;
  }

  private collapseMatch3(cols: number, rows: number) {
    const paletteSize = this.anipopMode ? 5 : COLORS.length;
    type StackGem = { v: number; special?: "rowClear" | "colClear" | "bomb" | "rainbow" };
    for (let c = 0; c < cols; c += 1) {
      const stack: StackGem[] = [];
      for (let r = rows - 1; r >= 0; r -= 1) {
        const v = this.grid[r]![c]!;
        if (v >= 0) {
          const key = `${r},${c}`;
          const sp = this.match3Specials.get(key);
          if (sp) this.match3Specials.delete(key);
          stack.push(sp ? { v, special: sp } : { v });
        }
      }
      for (let r = rows - 1; r >= 0; r -= 1) {
        const idx = rows - 1 - r;
        if (idx < stack.length) {
          const gem = stack[idx]!;
          this.grid[r]![c] = gem.v;
          if (gem.special) this.match3Specials.set(`${r},${c}`, gem.special);
        } else {
          this.grid[r]![c] = Math.floor(this.runtimeRng() * paletteSize);
        }
      }
    }
  }

  private redrawMatch3(cols: number, rows: number) {
    this.gridGfx.clear();
    this.anipopOverlayGfx?.clear();
    const useGemSprites = this.anipopMode && hasAnipopGemAtlas(this);
    const activeGemKeys = new Set<string>();
    if (this.anipopMode) {
      drawAnipopBoardFrame(this.gridGfx, this.ox, this.oy, this.cell * cols, this.cell * rows);
    }
    const palette = this.anipopMode ? ANIPOP_COLORS : COLORS;
    const iceGfx = this.anipopOverlayGfx ?? this.gridGfx;

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const v = this.grid[r]![c]!;
        if (v < 0) continue;
        const x = this.ox + c * this.cell;
        const y = this.oy + r * this.cell;
        if (this.anipopMode) {
          drawAnipopCellBg(this.gridGfx, x, y, this.cell, (r + c) % 2 === 0);
        }
      }
    }

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const v = this.grid[r]![c]!;
        const cellKey = `${r},${c}`;
        if (v < 0) continue;
        const x = this.ox + c * this.cell;
        const y = this.oy + r * this.cell;
        const selected = this.selectedMatch3Cell?.r === r && this.selectedMatch3Cell?.c === c;
        if (this.anipopMode) {
          const kind = anipopKindFromColorIndex(v);
          if (useGemSprites) {
            activeGemKeys.add(cellKey);
            const cx = x + this.cell / 2;
            const cy = y + this.cell / 2;
            let img = this.anipopGemImages.get(cellKey);
            if (!img) {
              img = this.add
                .image(cx, cy, anipopGemAtlasKey(), anipopGemFrameIndex(kind))
                .setDepth(12);
              this.anipopGemImages.set(cellKey, img);
            } else {
              img.setPosition(cx, cy).setVisible(true);
              img.setFrame(anipopGemFrameIndex(kind));
            }
            img.setScale((this.cell - 6) / ANIPOP_GEM_FRAME_SIZE);
            if (selected) img.setTint(0xfff3c4);
            else img.clearTint();
          } else {
            drawAnipopGem(this.gridGfx, kind, x, y, this.cell, selected);
          }
        } else if (this.richMatch3) {
          drawMatch3Gem(this.gridGfx, palette[v]!, x, y, this.cell, true);
        } else {
          this.gridGfx.fillStyle(Phaser.Display.Color.HexStringToColor(palette[v]!).color, 1);
          this.gridGfx.fillRoundedRect(x + 2, y + 2, this.cell - 4, this.cell - 4, 6);
        }
      }
    }

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const v = this.grid[r]![c]!;
        const cellKey = `${r},${c}`;
        if (v < 0 || !this.anipopMode) continue;
        const x = this.ox + c * this.cell;
        const y = this.oy + r * this.cell;
        const ice = this.anipopIce.get(cellKey);
        if (ice) drawAnipopIceOverlay(iceGfx, x, y, this.cell, ice);
        const special = this.match3Specials.get(cellKey);
        if (special) {
          if (ice) drawAnipopIcedSpecialGlow(iceGfx, x, y, this.cell);
          drawAnipopSpecialMark(iceGfx, x, y, this.cell, special, Boolean(ice));
        }
      }
    }

    if (useGemSprites) {
      for (const [key, img] of this.anipopGemImages) {
        if (!activeGemKeys.has(key)) img.setVisible(false);
      }
    }
  }

  private buildSpotDifference(w: number, h: number) {
    const pw = Math.min(280, (w - 60) / 2);
    const ph = 220;
    const y = 100;
    const lx = w / 2 - pw - 12;
    const rx = w / 2 + 12;
    const whimsical = this.spec.samplePlayProfile?.puzzle?.whimsicalPanels ?? false;
    const panelA = whimsical ? 0xa78bfa : 0x6366f1;
    const panelB = whimsical ? 0xf472b6 : 0x6366f1;
    paintSpotDiffPanels(this, this.spec, lx, rx, y, pw, ph);
    const panelGfxL = this.add.graphics().setDepth(2);
    const panelGfxR = this.add.graphics().setDepth(2);
    if (whimsical) {
      paintWhimsyPanelScene(panelGfxL, lx, y, pw, ph, runtimeSeedFromSpec(this.spec), "left");
      paintWhimsyPanelScene(panelGfxR, rx, y, pw, ph, runtimeSeedFromSpec(this.spec) + 3, "right");
    } else {
      this.add.rectangle(lx + pw / 2, y + ph / 2, pw, ph, panelA, 0.35);
      this.add.rectangle(rx + pw / 2, y + ph / 2, pw, ph, panelB, 0.35);
    }
    if (whimsical) {
      for (const pt of [
        { x: lx + 12, y: y + 12 },
        { x: lx + pw - 12, y: y + ph - 12 },
        { x: rx + pw - 12, y: y + 12 },
        { x: rx + 12, y: y + ph - 12 },
      ]) {
        juiceBurst(this, pt.x, pt.y, "#fcd34d", 4);
      }
    }
    const diffCount = this.target;
    this.diffMarks = Array.from({ length: diffCount }, () => false);
    const markCircles: Phaser.GameObjects.Arc[] = [];
    for (let i = 0; i < diffCount; i += 1) {
      const onLeft = i % 2 === 0;
      const baseX = onLeft ? lx : rx;
      const pt = {
        x: baseX + pw * (0.18 + ((i * 13) % 62) / 100),
        y: y + ph * (0.16 + ((i * 11) % 68) / 100),
      };
      if (i === 0) {
        setPhaserQaClickHints([{ x: pt.x / w, y: pt.y / h }]);
      }
      const mark = this.add.circle(pt.x, pt.y, 10, whimsical ? 0xf472b6 : 0xfde047).setVisible(false);
      markCircles.push(mark);
      this.add
        .circle(pt.x, pt.y, 22, 0x000000, 0)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => {
          if (this.diffMarks[i] || this.finished) return;
          this.diffMarks[i] = true;
          mark.setVisible(true);
          mark.setScale(1.8);
          this.foundDiff += 1;
          this.score += 20;
          this.scoreText.setText(hudScore(this.uiLocale, this.score));
          juicePickup(this, {
            x: pt.x,
            y: pt.y,
            colorHex: whimsical ? "#f472b6" : themeParticleHex(this.spec),
            text: "+20",
            textColorCss: this.cohesive.hud.accent,
            large: this.foundDiff >= diffCount,
          });
          this.addMove();
          playBleep("pickup");
          this.publishQaState();
          if (this.foundDiff >= diffCount) this.finish(true);
        });
    }
    this.add.text(w / 2, h - 48, hudPuzzleSpotDiffHint(this.uiLocale), { fontSize: "14px", color: "#e2e8f0" }).setOrigin(0.5);
  }

  private buildMemoryMatch(cols: number, rows: number, w: number) {
    const pairs = (cols * rows) / 2;
    const ids = Array.from({ length: pairs }, (_, i) => i);
    const deck = seededShuffle([...ids, ...ids], runtimeSeedFromSpec(this.spec));
    this.cell = Math.min(64, (w - 40) / cols);
    this.ox = (w - this.cell * cols) / 2;
    paintPuzzleBoardFrame(this, this.spec, this.ox - 4, this.oy - 4, this.cell * cols + 8, this.cell * rows + 8);
    const timed = this.memoryTimerSec > 0;
    const h = this.scale.height;
    deck.forEach((id, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const x = this.ox + c * this.cell + this.cell / 2;
      const y = this.oy + r * this.cell + this.cell / 2;
      if (i === 0) {
        setPhaserQaClickHints([{ x: x / w, y: y / h }]);
      }
      const rect = this.add
        .rectangle(x, y, this.cell - 8, this.cell - 8, timed ? 0x581c87 : 0x4c1d95)
        .setStrokeStyle(2, timed ? 0xf472b6 : 0xc4b5fd)
        .setInteractive({ useHandCursor: true });
      const faceText = this.memoryEmoji ? memoryCardEmoji(id) : String(id + 1);
      const label = this.add
        .text(x, y, "?", { fontSize: this.memoryEmoji ? "26px" : "20px", color: "#fff" })
        .setOrigin(0.5);
      const card = { id, face: false, matched: false, x, y, rect, label, faceText };
      this.cards.push(card);
      rect.on("pointerdown", () => this.flipCard(card));
    });
  }

  private flipCard(card: (typeof this.cards)[number]) {
    if (this.finished || card.face || card.matched || this.flipped.length >= 2) return;
    card.face = true;
    card.label.setText(card.faceText);
      card.rect.setFillStyle(Phaser.Display.Color.HexStringToColor(COLORS[card.id % COLORS.length]!).color);
    this.flipped.push(card);
    this.publishQaState();
    if (this.flipped.length === 2) {
      this.addMove();
      const [a, b] = this.flipped;
      if (a!.id === b!.id) {
        a!.matched = b!.matched = true;
        this.score += 15;
        this.flipped = [];
        this.scoreText.setText(hudScore(this.uiLocale, this.score));
        juicePickup(this, {
          x: a!.x,
          y: a!.y,
          colorHex: COLORS[a!.id % COLORS.length] ?? "#fff",
          text: "+15",
          textColorCss: this.cohesive.hud.accent,
        });
        playBleep("pickup");
        if (this.cards.every((c) => c.matched)) this.finish(true);
      } else {
        juiceHit(this, {
          x: (a!.x + b!.x) / 2,
          y: (a!.y + b!.y) / 2,
          colorHex: this.cohesive.hud.danger,
        });
        this.time.delayedCall(600, () => {
          a!.face = b!.face = false;
          a!.label.setText("?");
          b!.label.setText("?");
          a!.rect.setFillStyle(0x4c1d95);
          b!.rect.setFillStyle(0x4c1d95);
          this.flipped = [];
        });
      }
    }
  }

  private buildJigsaw(w: number, h: number) {
    const cols = this.jigsawCols;
    const rows = this.jigsawRows;
    const total = cols * rows;
    const blockScale = this.jigsawLargeBlocks ? 1.18 : 1;
    const size = Math.min(88 * blockScale, Math.min((w - 100) / (cols + 1), (h - 220) / (rows + 2)));
    const sx = w / 2 - (cols * size) / 2;
    const sy = h / 2 - (rows * size) / 2 - 20;
    if (this.kidsJigsaw) {
      const frame = this.add.graphics().setDepth(1);
      frame.lineStyle(4, 0xfcd34d, 0.85);
      frame.strokeRoundedRect(sx - 16, sy - 16, cols * size + 32, rows * size + 32, 12);
      frame.lineStyle(2, 0x38bdf8, 0.6);
      frame.strokeRoundedRect(sx - 8, sy - 8, cols * size + 16, rows * size + 16, 8);
    } else {
      paintPuzzleBoardFrame(this, this.spec, sx - 10, sy - 10, cols * size + 20, rows * size + 20);
    }
    for (let i = 0; i < total; i += 1) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const tx = sx + c * size;
      const ty = sy + r * size;
      const slot = this.add
        .rectangle(tx + size / 2, ty + size / 2, size - 4, size - 4, 0x334155)
        .setStrokeStyle(2, 0x94a3b8);
      this.jigsawSlots.push(slot);
      const px = 36 + (i % cols) * (size + 6);
      const py = h - 150 + Math.floor(i / cols) * (size + 6);
      const piece = this.add
        .rectangle(px, py, size - 8, size - 8, Phaser.Display.Color.HexStringToColor(COLORS[i % COLORS.length]!).color)
        .setInteractive({ useHandCursor: true, draggable: true });
      if (this.kidsJigsaw) {
        this.add
          .text(px, py, kidsJigsawEmoji(i), { fontSize: `${Math.floor(size * 0.38)}px` })
          .setOrigin(0.5)
          .setDepth(3);
      }
      piece.on("pointerdown", () => {
        this.addMove(1);
        if (this.kidsJigsaw) {
          const emptyIdx = this.jigsawSlots.findIndex((s) => !s.getData("filled"));
          if (emptyIdx >= 0) {
            piece.setPosition(this.jigsawSlots[emptyIdx]!.x, this.jigsawSlots[emptyIdx]!.y);
            this.jigsawSlots[emptyIdx]!.setData("filled", true);
            piece.setScale(1.08);
            this.jigsawDone += 1;
            this.score += 10;
            this.scoreText.setText(hudScore(this.uiLocale, this.score));
            this.publishQaState();
            juiceCombo(this, {
              x: piece.x,
              y: piece.y,
              colorHex: COLORS[emptyIdx % COLORS.length] ?? "#fff",
              text: "+10",
              textColorCss: this.cohesive.hud.accent,
              combo: this.jigsawDone,
              large: this.jigsawDone >= total,
            });
            playBleep("pickup");
            this.addMove(1);
            if (this.jigsawDone >= total) this.finish(true);
            return;
          }
        }
      });
      piece.on("drag", (_p: Phaser.Input.Pointer, dragX: number, dragY: number) => piece.setPosition(dragX, dragY));
      piece.on("dragend", () => {
        const slotIdx = this.jigsawSlots.findIndex(
          (s) => Phaser.Math.Distance.Between(piece.x, piece.y, s.x, s.y) < size * 0.45,
        );
        if (slotIdx >= 0 && !this.jigsawSlots[slotIdx]!.getData("filled")) {
          piece.setPosition(this.jigsawSlots[slotIdx]!.x, this.jigsawSlots[slotIdx]!.y);
          this.jigsawSlots[slotIdx]!.setData("filled", true);
          this.jigsawDone += 1;
          this.score += 10;
          this.scoreText.setText(hudScore(this.uiLocale, this.score));
          this.publishQaState();
          juicePickup(this, {
            x: piece.x,
            y: piece.y,
            colorHex: COLORS[slotIdx % COLORS.length] ?? "#fff",
            text: this.starReward ? "⭐ +10" : "+10",
            textColorCss: this.starReward ? "#fcd34d" : this.cohesive.hud.accent,
            large: this.jigsawDone >= total,
          });
          playBleep("pickup");
          this.addMove(1);
          if (this.jigsawDone >= total) this.finish(true);
        }
      });
    }
    if (this.kidsJigsaw) {
      this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
        if (p.y >= h - 200) {
          this.addMove(1);
          this.publishQaState();
        }
      });
    }
  }
}
