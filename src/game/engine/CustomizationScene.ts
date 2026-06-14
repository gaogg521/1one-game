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
import { schedulePhaserPlayReady } from "@/game/engine/phaser-play-ready";

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
    schedulePhaserPlayReady(this, 400);
  }

  update(_time: number, deltaMs: number) {
    if (this.mode !== "pottery") return;
    this.spinAngle += deltaMs * this.potterySpinRate;
    this.drawPottery();
  }

  private drawCar() {
    const w = this.scale.width;
    const h = this.scale.height;
    const cx = w / 2;
    const cy = h * 0.42;
    this.carGfx.clear();
    this.carGfx.fillStyle(Phaser.Display.Color.HexStringToColor(this.bodyColor).color, 1);
    this.carGfx.fillRoundedRect(cx - 90, cy - 30, 180, 50, 10);
    this.carGfx.fillStyle(Phaser.Display.Color.HexStringToColor(this.wheelColor).color, 1);
    this.carGfx.fillCircle(cx - 55, cy + 28, 18);
    this.carGfx.fillCircle(cx + 55, cy + 28, 18);
    this.carGfx.fillStyle(0xbae6fd, 0.9);
    this.carGfx.fillRoundedRect(cx - 20, cy - 22, 50, 22, 4);
  }

  private drawPottery() {
    const w = this.scale.width;
    const h = this.scale.height;
    const cx = w / 2;
    const cy = h * 0.46;
    const g = this.potteryGfx;
    g.clear();

    g.lineStyle(3, 0x78716c, 0.5);
    g.strokeCircle(cx, cy + 70, 72);
    g.fillStyle(0x57534e, 0.35);
    g.fillCircle(cx, cy + 70, 72);

    const vh = 40 + this.vaseHeight * 120;
    const gw = 28 + this.vaseHeight * 18;
    const topW = gw * 0.72;
    g.fillStyle(Phaser.Display.Color.HexStringToColor(this.glazeColor).color, 1);
    g.fillEllipse(cx, cy - vh * 0.35, topW, 18);
    g.fillRoundedRect(cx - gw / 2, cy - vh * 0.25, gw, vh * 0.55, 12);
    g.fillStyle(Phaser.Display.Color.HexStringToColor(this.rimColor).color, 1);
    g.fillEllipse(cx, cy - vh * 0.28, topW + 8, 10);
    g.fillStyle(Phaser.Display.Color.HexStringToColor(this.baseColor).color, 1);
    g.fillRoundedRect(cx - gw * 0.55, cy + vh * 0.22, gw * 1.1, 16, 4);

    g.lineStyle(2, 0xffffff, 0.15);
    for (let i = 0; i < 6; i += 1) {
      const a = this.spinAngle + (i / 6) * Math.PI * 2;
      g.lineBetween(cx, cy - vh * 0.1, cx + Math.cos(a) * gw * 0.45, cy - vh * 0.1 + Math.sin(a) * 8);
    }
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
