import Phaser from "phaser";
import { playBleep, setBleepTemperament } from "@/game/audio/webBleeps";
import { HudBanner } from "@/game/engine/HudBanner";
import { juiceBurst, juiceFlash, themeParticleHex } from "@/game/engine/gameJuice";
import { styleHudText } from "@/game/engine/hudTextStyle";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { AppLocale } from "@/i18n/routing";
import { buildCohesivePresentation, type CohesivePresentation } from "@/lib/cohesive-presentation";
import { buildCustomizationBlueprint, type CustomizationMode } from "@/lib/customization-blueprint";
import type { GameSpec } from "@/lib/game-spec";
import { paintCustomizationStudio } from "@/game/engine/template-theme-visual";
import { drawStyledCar, drawStyledPottery } from "@/game/engine/action-visual";
import {
  bannerCustomizationFinish,
  customizationPartLabel,
  hudCustomizationEditing,
  hudCustomizationHint,
  hudCustomizationPotteryHint,
  hudCustomizationRandom,
  hudReady,
} from "@/lib/i18n/game-hud-labels";
import { pickSeededFromArray, runtimeSeedFromSpec, seededRandom } from "@/lib/runtime-seed";
import { bumpQaTouch, initQaState, setPhaserQaState } from "@/game/engine/phaser-qa-state";
import { schedulePhaserPlayReady, setPhaserQaClickHints } from "@/game/engine/phaser-play-ready";

type EndPayload = { score: number; won: boolean };
type CarPart = "body" | "wheel" | "bg";
type PotteryPart = "glaze" | "rim" | "base";

/** 汽车涂色 / 陶艺拉坯定制 */
export class CustomizationScene extends Phaser.Scene {
  public backgroundUrl: string | null = null;
  public projectId: string | null = null;
  public uiLocale: AppLocale = "zh-Hans";

  private readonly spec: GameSpec;
  private readonly onEnd: (r: EndPayload) => void;
  private readonly soundscape: GameSoundscape | null;

  private mode: CustomizationMode = "carPaint";
  private editGoal = 5;
  private bodyColor: string;
  private wheelColor: string;
  private bgColor: string;
  private glazeColor: string;
  private rimColor: string;
  private baseColor: string;
  private vaseHeight = 0.35;
  private spinAngle = 0;

  private potterySpinRate = 0.0012;
  private carGfx!: Phaser.GameObjects.Graphics;
  private potteryGfx!: Phaser.GameObjects.Graphics;
  private bgRect!: Phaser.GameObjects.Rectangle;
  private palette: string[] = [];
  private activeCarPart: CarPart = "body";
  private activePotteryPart: PotteryPart = "glaze";
  private hintText!: Phaser.GameObjects.Text;
  private banner!: HudBanner;
  private cohesive!: CohesivePresentation;
  private edits = 0;
  private runtimeRng!: () => number;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape: GameSoundscape | null) {
    super({ key: "CustomizationScene" });
    this.spec = spec;
    this.onEnd = onEnd;
    this.soundscape = soundscape;
    this.bodyColor = spec.theme.playerColor;
    this.wheelColor = spec.theme.hazardColor;
    this.bgColor = spec.theme.backgroundColor;
    this.glazeColor = spec.theme.playerColor;
    this.rimColor = spec.theme.collectibleColor ?? "#fde047";
    this.baseColor = spec.theme.hazardColor;
  }

  create() {
    setPhaserQaClickHints([]);
    const cohesive = buildCohesivePresentation(this.spec);
    setBleepTemperament(cohesive.bleepTemperament);
    this.cohesive = cohesive;
    this.runtimeRng = seededRandom(runtimeSeedFromSpec(this.spec));

    const bp = this.spec.customization ?? buildCustomizationBlueprint({ spec: this.spec });
    this.mode = bp.mode;
    this.editGoal = this.spec.samplePlayProfile?.customization?.editGoal ?? bp.editGoal;
    this.potterySpinRate = this.spec.samplePlayProfile?.customization?.potterySpin ?? 0.0012;

    const w = this.scale.width;
    const h = this.scale.height;
    paintCustomizationStudio(this, this.spec, w, h, this.mode);
    this.bgRect = this.add
      .rectangle(w / 2, h / 2, w, h, Phaser.Display.Color.HexStringToColor(this.bgColor).color)
      .setAlpha(this.mode === "pottery" ? 0 : 0.18);
    this.carGfx = this.add.graphics();
    this.potteryGfx = this.add.graphics().setVisible(this.mode === "pottery");

    this.palette = [
      "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#a855f7", "#ec4899", "#ffffff", "#1e293b",
    ];
    const px = 16;
    const py = h - 56;
    this.palette.forEach((col, i) => {
      const sw = 28;
      const x = px + (i % 10) * (sw + 6);
      const y = py + Math.floor(i / 10) * (sw + 6);
      this.add
        .rectangle(x, y, sw, sw, Phaser.Display.Color.HexStringToColor(col).color)
        .setStrokeStyle(2, 0xffffff)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.applyColor(col));
    });

    this.add
      .text(w - 120, 16, hudCustomizationRandom(this.uiLocale), { fontSize: "16px", color: "#fff", backgroundColor: "#6366f1", padding: { x: 10, y: 6 } })
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.randomize());

    if (this.mode === "pottery") {
      (["glaze", "rim", "base"] as const).forEach((part, i) => {
        const label = customizationPartLabel(this.uiLocale, part);
        this.add
          .text(16 + i * 88, 52, label, { fontSize: "14px", color: "#e2e8f0", backgroundColor: "#334155", padding: { x: 8, y: 4 } })
          .setInteractive({ useHandCursor: true })
          .on("pointerdown", () => {
            this.activePotteryPart = part;
            this.hintText.setText(hudCustomizationEditing(this.uiLocale, label));
          });
      });
      this.hintText = styleHudText(
        this.add.text(w / 2, h - 88, hudCustomizationPotteryHint(this.uiLocale), {
          fontSize: "13px",
          color: "#cbd5e1",
        }).setOrigin(0.5),
      );
      const wheelY = h * 0.46 + 70;
      this.add
        .circle(w / 2, wheelY, 76, 0xffffff, 0.01)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.pullPotteryWheel());
      this.carGfx.setVisible(false);
    } else {
      (["body", "wheel", "bg"] as const).forEach((part, i) => {
        const label = customizationPartLabel(this.uiLocale, part);
        this.add
          .text(16 + i * 72, 52, label, { fontSize: "14px", color: "#e2e8f0", backgroundColor: "#334155", padding: { x: 8, y: 4 } })
          .setInteractive({ useHandCursor: true })
          .on("pointerdown", () => {
            this.activeCarPart = part;
            this.hintText.setText(hudCustomizationEditing(this.uiLocale, label));
          });
      });
      this.hintText = styleHudText(
        this.add.text(w / 2, h - 88, hudCustomizationHint(this.uiLocale), {
          fontSize: "13px",
          color: "#cbd5e1",
        }).setOrigin(0.5),
      );
    }

    this.banner = new HudBanner(this, this.cohesive.banner);
    this.banner.show({ title: hudReady(this.uiLocale), ms: 1200 });

    if (this.mode === "pottery") this.drawPottery();
    else this.drawCar();

    const bodyY = this.mode === "pottery" ? h * 0.46 : h * 0.42;
    this.add
      .rectangle(w / 2, bodyY, 220, 170, 0x000000, 0)
      .setDepth(100)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        if (this.mode === "pottery") {
          this.pullPotteryWheel();
        } else {
          const hex = this.palette[this.edits % this.palette.length] ?? this.palette[0] ?? this.bodyColor;
          this.applyColor(hex);
        }
      });

    const qaInit: Record<string, number> = { potteryHeight: 0 };
    if (this.mode !== "pottery") qaInit.qaTouches = 0;
    setPhaserQaState(qaInit);
    schedulePhaserPlayReady(this, 400, qaInit);
  }

  private publishQaState() {
    setPhaserQaState({
      qaTouches: this.edits,
      potteryHeight: Math.round(this.vaseHeight * 100),
    });
  }

  update(_time: number, deltaMs: number) {
    this.publishQaState();
    if (this.mode !== "pottery") return;
    this.spinAngle += deltaMs * this.potterySpinRate;
    this.drawPottery();
  }

  private drawCar() {
    const w = this.scale.width;
    const h = this.scale.height;
    drawStyledCar(this.carGfx, w / 2, h * 0.42, this.bodyColor, this.wheelColor);
  }

  private drawPottery() {
    const w = this.scale.width;
    const h = this.scale.height;
    drawStyledPottery(
      this.potteryGfx,
      w / 2,
      h * 0.46,
      this.vaseHeight,
      this.glazeColor,
      this.rimColor,
      this.baseColor,
      this.spinAngle,
    );
  }

  private pullPotteryWheel() {
    this.vaseHeight = Math.min(1, this.vaseHeight + 0.12);
    this.potterySpinRate = Math.min(0.0045, this.potterySpinRate + 0.00035);
    bumpQaTouch();
    this.publishQaState();
    playBleep("pickup");
    const cx = this.scale.width / 2;
    const cy = this.scale.height * 0.46;
    juiceBurst(this, cx, cy - 20, this.glazeColor, 12, this.runtimeRng);
    juiceFlash(this, { r: 250, g: 220, b: 120 }, { durationMs: 120 });
    this.drawPottery();
  }

  private applyColor(hex: string) {
    if (this.mode === "pottery") {
      if (this.activePotteryPart === "glaze") this.glazeColor = hex;
      else if (this.activePotteryPart === "rim") this.rimColor = hex;
      else this.baseColor = hex;
      this.vaseHeight = Math.min(1, this.vaseHeight + 0.08);
      this.drawPottery();
    } else {
      if (this.activeCarPart === "body") this.bodyColor = hex;
      else if (this.activeCarPart === "wheel") this.wheelColor = hex;
      else {
        this.bgColor = hex;
        this.bgRect.setFillStyle(Phaser.Display.Color.HexStringToColor(hex).color);
      }
      this.drawCar();
    }
    this.edits += 1;
    bumpQaTouch();
    this.publishQaState();
    playBleep("pickup");
    this.soundscape?.triggerEvent("restore");
    const cx = this.scale.width / 2;
    const cy = this.mode === "pottery" ? this.scale.height * 0.46 : this.scale.height * 0.42;
    juiceBurst(this, cx, cy, hex, 10, this.runtimeRng);
    if (this.edits >= this.editGoal) {
      juiceFlash(this, { r: 180, g: 140, b: 255 }, { durationMs: 150 });
      this.banner.show({ ...bannerCustomizationFinish(this.uiLocale), ms: 1800 });
      this.time.delayedCall(2000, () => this.onEnd({ score: this.edits * 20, won: true }));
    }
  }

  private randomize() {
    const pick = () => this.palette[Math.floor(this.runtimeRng() * this.palette.length)]!;
    if (this.mode === "pottery") {
      this.glazeColor = pick();
      this.rimColor = pick();
      this.baseColor = pick();
      this.vaseHeight = Math.min(1, this.vaseHeight + 0.12);
      this.applyColor(pick());
      return;
    }
    this.bodyColor = pick();
    this.wheelColor = pick();
    this.bgColor = pick();
    this.bgRect.setFillStyle(Phaser.Display.Color.HexStringToColor(this.bgColor).color);
    this.applyColor(pick());
  }
}
