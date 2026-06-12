import Phaser from "phaser";
import { playBleep, setBleepTemperament } from "@/game/audio/webBleeps";
import { HudBanner } from "@/game/engine/HudBanner";
import { styleHudText } from "@/game/engine/hudTextStyle";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { AppLocale } from "@/i18n/routing";
import { buildCohesivePresentation, type CohesivePresentation } from "@/lib/cohesive-presentation";
import type { GameSpec } from "@/lib/game-spec";
import { hudReady } from "@/lib/i18n/game-hud-labels";

type EndPayload = { score: number; won: boolean };

/** 汽车涂色定制：选色填充车身/轮毂/背景 */
export class CustomizationScene extends Phaser.Scene {
  public backgroundUrl: string | null = null;
  public projectId: string | null = null;
  public uiLocale: AppLocale = "zh-Hans";

  private readonly spec: GameSpec;
  private readonly onEnd: (r: EndPayload) => void;
  private readonly soundscape: GameSoundscape | null;

  private bodyColor: string;
  private wheelColor: string;
  private bgColor: string;
  private carGfx!: Phaser.GameObjects.Graphics;
  private bgRect!: Phaser.GameObjects.Rectangle;
  private palette: string[] = [];
  private activePart: "body" | "wheel" | "bg" = "body";
  private hintText!: Phaser.GameObjects.Text;
  private banner!: HudBanner;
  private cohesive!: CohesivePresentation;
  private edits = 0;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape: GameSoundscape | null) {
    super({ key: "CustomizationScene" });
    this.spec = spec;
    this.onEnd = onEnd;
    this.soundscape = soundscape;
    this.bodyColor = spec.theme.playerColor;
    this.wheelColor = spec.theme.hazardColor;
    this.bgColor = spec.theme.backgroundColor;
  }

  create() {
    const cohesive = buildCohesivePresentation(this.spec);
    setBleepTemperament(cohesive.bleepTemperament);
    this.cohesive = cohesive;

    const w = this.scale.width;
    const h = this.scale.height;
    this.bgRect = this.add.rectangle(w / 2, h / 2, w, h, Phaser.Display.Color.HexStringToColor(this.bgColor).color);
    this.carGfx = this.add.graphics();

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
      .text(w - 120, 16, "随机", { fontSize: "16px", color: "#fff", backgroundColor: "#6366f1", padding: { x: 10, y: 6 } })
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.randomize());

    ["车身", "轮毂", "背景"].forEach((label, i) => {
      const part = (["body", "wheel", "bg"] as const)[i]!;
      this.add
        .text(16 + i * 72, 52, label, { fontSize: "14px", color: "#e2e8f0", backgroundColor: "#334155", padding: { x: 8, y: 4 } })
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => {
          this.activePart = part;
          this.hintText.setText(`正在编辑：${label}`);
        });
    });

    this.hintText = styleHudText(
      this.add.text(w / 2, h - 88, "选择部位后点调色盘填色 · 完成 5 次涂色即过关", {
        fontSize: "13px",
        color: "#cbd5e1",
      }).setOrigin(0.5),
    );
    this.banner = new HudBanner(this, this.cohesive.banner);
    this.banner.show({ title: hudReady(this.uiLocale), ms: 1200 });

    this.drawCar();
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

  private applyColor(hex: string) {
    if (this.activePart === "body") this.bodyColor = hex;
    else if (this.activePart === "wheel") this.wheelColor = hex;
    else {
      this.bgColor = hex;
      this.bgRect.setFillStyle(Phaser.Display.Color.HexStringToColor(hex).color);
    }
    this.edits += 1;
    this.drawCar();
    playBleep("pickup");
    this.soundscape?.triggerEvent("restore");
    if (this.edits >= 5) {
      this.banner.show({ title: "定制完成！", ms: 1800 });
      this.time.delayedCall(2000, () => this.onEnd({ score: this.edits * 20, won: true }));
    }
  }

  private randomize() {
    const pick = () => this.palette[Math.floor(Math.random() * this.palette.length)]!;
    this.bodyColor = pick();
    this.wheelColor = pick();
    this.bgColor = pick();
    this.bgRect.setFillStyle(Phaser.Display.Color.HexStringToColor(this.bgColor).color);
    this.applyColor(pick());
  }
}
