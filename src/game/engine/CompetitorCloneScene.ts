import Phaser from "phaser";
import type { AppLocale } from "@/i18n/routing";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import { playBleep } from "@/game/audio/webBleeps";
import { schedulePhaserPlayReady, setPhaserQaClickHints } from "@/game/engine/phaser-play-ready";
import { bumpQaTouch, setPhaserQaState } from "@/game/engine/phaser-qa-state";
import { styleHudText } from "@/game/engine/hudTextStyle";
import type { GameSpec } from "@/lib/game-spec";

type EndPayload = { score: number; won: boolean };
type CloneMode = NonNullable<NonNullable<GameSpec["samplePlayProfile"]>["competitorClone"]>["mode"];

const COPY: Record<CloneMode, { title: string; objective: string; action: string; color: number; accent: number }> = {
  "voxel-builder": { title: "方块超能工坊", objective: "采集能量方块并完成核心建筑", action: "挖掘 / 放置", color: 0x2563eb, accent: 0x22c55e },
  "territory-loop": { title: "霓虹领地", objective: "闭合轨迹，夺取目标面积", action: "扩张领地", color: 0x111827, accent: 0x22d3ee },
  "tower-punch": { title: "百层破壁", objective: "蓄力击穿十段、共一百层防线", action: "重拳破壁", color: 0x7c2d12, accent: 0xf97316 },
  "estate-merge": { title: "庄园合成", objective: "合成建筑，完成中央庄园", action: "合并建筑", color: 0x78350f, accent: 0xfbbf24 },
  "voxel-sniper": { title: "方块远猎", objective: "在弹药耗尽前命中全部目标", action: "瞄准射击", color: 0x14532d, accent: 0xef4444 },
  "daybreak-survival": { title: "方块黎明", objective: "收集资源，熬过三个昼夜", action: "采集生存", color: 0x0f172a, accent: 0xfacc15 },
  "passenger-rail": { title: "乘客快线", objective: "切换轨道，接满沿途乘客", action: "接载乘客", color: 0x1e3a8a, accent: 0x38bdf8 },
  "fusion-legends": { title: "英雄融合", objective: "合并同阶英雄，组建终极阵容", action: "融合升级", color: 0x312e81, accent: 0xa78bfa },
  "auto-spa": { title: "闪亮车坊", objective: "按清洁流程完成三辆汽车", action: "执行工序", color: 0x0e7490, accent: 0xf0fdfa },
  "team-arsenal": { title: "双队军械场", objective: "在对手之前取得十次击破", action: "锁定敌队", color: 0x172554, accent: 0x60a5fa },
};

/**
 * 十款竞品首页玩法的 clean-room 复刻运行时。
 * 只复刻可观察的核心循环和完成条件，不携带第三方源码、商标角色或素材。
 */
export class CompetitorCloneScene extends Phaser.Scene {
  public backgroundUrl: string | null = null;
  public projectId: string | null = null;
  public uiLocale: AppLocale = "zh-Hans";

  private readonly spec: GameSpec;
  private readonly onEnd: (result: EndPayload) => void;
  private readonly soundscape: GameSoundscape | null;
  private mode: CloneMode;
  private target: number;
  private progress = 0;
  private score = 0;
  private finished = false;
  private progressText!: Phaser.GameObjects.Text;
  private actionText!: Phaser.GameObjects.Text;
  private board!: Phaser.GameObjects.Container;
  private meter!: Phaser.GameObjects.Graphics;

  constructor(spec: GameSpec, onEnd: (result: EndPayload) => void, soundscape: GameSoundscape | null) {
    super({ key: "CompetitorCloneScene" });
    this.spec = spec;
    this.onEnd = onEnd;
    this.soundscape = soundscape;
    const clone = spec.samplePlayProfile?.competitorClone;
    this.mode = clone?.mode ?? "territory-loop";
    this.target = clone?.target ?? 10;
  }

  create() {
    const copy = COPY[this.mode];
    const w = this.scale.width;
    const h = this.scale.height;
    this.cameras.main.setBackgroundColor(copy.color);
    this.paintBackdrop(w, h, copy);

    styleHudText(this.add.text(16, 14, copy.title, { fontSize: "20px", fontStyle: "bold", color: "#ffffff" })).setDepth(30);
    styleHudText(this.add.text(16, 44, copy.objective, { fontSize: "12px", color: "#dbeafe", wordWrap: { width: w - 32 } })).setDepth(30);
    this.progressText = styleHudText(this.add.text(16, 76, "", { fontSize: "16px", color: "#ffffff" })).setDepth(30);
    this.meter = this.add.graphics().setDepth(30);
    this.board = this.add.container(0, 0).setDepth(10);
    this.paintModeBoard(w, h, copy);

    const button = this.add.rectangle(w / 2, h - 54, Math.min(300, w - 40), 58, copy.accent, 0.96)
      .setStrokeStyle(2, 0xffffff, 0.65)
      .setInteractive({ useHandCursor: true });
    this.actionText = styleHudText(this.add.text(w / 2, h - 54, copy.action, { fontSize: "18px", fontStyle: "bold", color: "#08111f" }).setOrigin(0.5)).setDepth(31);
    button.setDepth(29).on("pointerdown", () => this.act(w, h, copy));
    this.input.keyboard?.on("keydown-SPACE", () => this.act(w, h, copy));
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.y < h - 92) this.act(w, h, copy, pointer);
    });

    this.refreshHud();
    setPhaserQaClickHints([{ x: 0.5, y: 0.52 }, { x: 0.5, y: 0.9 }]);
    setPhaserQaState({ qaTouches: 0, cloneProgress: 0, cloneTarget: this.target, cloneMode: this.mode, cloneCompleted: false });
    schedulePhaserPlayReady(this, 280, { cloneMode: this.mode });
  }

  private paintBackdrop(w: number, h: number, copy: (typeof COPY)[CloneMode]) {
    const g = this.add.graphics().setDepth(-10);
    for (let y = 0; y < h; y += 48) {
      g.fillStyle(y % 96 === 0 ? copy.color : Phaser.Display.Color.ValueToColor(copy.color).brighten(8).color, 1);
      g.fillRect(0, y, w, 48);
    }
    for (let i = 0; i < 16; i += 1) {
      g.fillStyle(copy.accent, 0.08 + (i % 3) * 0.03);
      g.fillCircle((i * 83) % w, 110 + ((i * 67) % Math.max(120, h - 240)), 18 + (i % 4) * 9);
    }
  }

  private paintModeBoard(w: number, h: number, copy: (typeof COPY)[CloneMode]) {
    const cy = h * 0.5;
    if (this.mode === "territory-loop" || this.mode === "estate-merge" || this.mode === "fusion-legends" || this.mode === "voxel-builder") {
      const cols = this.mode === "territory-loop" ? 6 : 4;
      const size = Math.min(64, (w - 48) / cols);
      for (let r = 0; r < 4; r += 1) for (let c = 0; c < cols; c += 1) {
        const box = this.add.rectangle(w / 2 + (c - (cols - 1) / 2) * size, cy + (r - 1.5) * size, size - 5, size - 5, 0x0f172a, 0.72)
          .setStrokeStyle(1, copy.accent, 0.55);
        this.board.add(box);
      }
    } else if (this.mode === "passenger-rail") {
      for (let lane = -1; lane <= 1; lane += 1) this.board.add(this.add.rectangle(w / 2 + lane * 74, cy, 42, h * 0.52, 0x334155, 0.8));
      this.board.add(this.add.rectangle(w / 2, cy + 90, 54, 100, copy.accent, 1));
    } else if (this.mode === "auto-spa") {
      this.board.add(this.add.rectangle(w / 2, cy, Math.min(290, w - 64), 128, 0xe2e8f0, 1).setStrokeStyle(6, 0x334155));
      this.board.add(this.add.circle(w / 2 - 92, cy + 60, 26, 0x111827));
      this.board.add(this.add.circle(w / 2 + 92, cy + 60, 26, 0x111827));
    } else if (this.mode === "tower-punch") {
      for (let i = 0; i < 10; i += 1) this.board.add(this.add.rectangle(w / 2, cy + 150 - i * 30, Math.min(310, w - 52), 22, i % 2 ? 0xf97316 : 0xfbbf24, 0.9));
    } else {
      for (let i = 0; i < 6; i += 1) {
        const x = 58 + ((i * 97) % Math.max(120, w - 116));
        const y = 150 + ((i * 83) % Math.max(160, h - 330));
        this.board.add(this.add.circle(x, y, 18 + (i % 2) * 7, i % 2 ? 0xef4444 : copy.accent, 0.95).setStrokeStyle(2, 0xffffff, 0.7));
      }
      if (this.mode === "voxel-sniper" || this.mode === "team-arsenal") {
        const scope = this.add.graphics();
        scope.lineStyle(2, 0xffffff, 0.8).strokeCircle(w / 2, cy, 62).lineBetween(w / 2 - 82, cy, w / 2 + 82, cy).lineBetween(w / 2, cy - 82, w / 2, cy + 82);
        this.board.add(scope);
      }
    }
  }

  private act(w: number, h: number, copy: (typeof COPY)[CloneMode], pointer?: Phaser.Input.Pointer) {
    if (this.finished) return;
    bumpQaTouch();
    this.progress += 1;
    const multiplier = this.mode === "tower-punch" ? 10 : this.mode === "daybreak-survival" ? 1 : 1;
    this.score += 100 * multiplier;
    playBleep(this.progress % 4 === 0 ? "power" : "pickup");

    const x = pointer?.x ?? w / 2;
    const y = pointer?.y ?? h * 0.5;
    const burst = this.add.circle(x, y, 12, copy.accent, 0.9).setDepth(22);
    this.tweens.add({ targets: burst, scale: 3.5, alpha: 0, duration: 260, onComplete: () => burst.destroy() });
    this.actionText.setScale(0.94);
    this.tweens.add({ targets: this.actionText, scale: 1, duration: 120, ease: "Back.Out" });

    if (this.board.list.length) {
      const item = this.board.list[(this.progress - 1) % this.board.list.length] as Phaser.GameObjects.GameObject & { setAlpha?: (a: number) => unknown; setScale?: (v: number) => unknown };
      item.setAlpha?.(0.3);
      item.setScale?.(1.08);
    }
    this.refreshHud();
    setPhaserQaState({ cloneProgress: this.progress, cloneTarget: this.target, cloneMode: this.mode, cloneCompleted: this.progress >= this.target });
    if (this.progress >= this.target) this.finish(true);
  }

  private refreshHud() {
    const unit = this.mode === "tower-punch" ? "层" : this.mode === "auto-spa" ? "工序" : this.mode === "passenger-rail" ? "乘客" : "进度";
    const shown = this.mode === "tower-punch" ? this.progress * 10 : this.progress;
    const total = this.mode === "tower-punch" ? this.target * 10 : this.target;
    this.progressText.setText(`${unit} ${Math.min(shown, total)} / ${total}   ·   得分 ${this.score}`);
    this.meter.clear().fillStyle(0x0f172a, 0.7).fillRoundedRect(16, 104, this.scale.width - 32, 10, 4);
    this.meter.fillStyle(COPY[this.mode].accent, 1).fillRoundedRect(16, 104, (this.scale.width - 32) * Phaser.Math.Clamp(this.progress / this.target, 0, 1), 10, 4);
  }

  private finish(won: boolean) {
    if (this.finished) return;
    this.finished = true;
    this.soundscape?.setSection(won ? "victory" : "defeat");
    playBleep(won ? "win" : "death");
    const w = this.scale.width;
    const h = this.scale.height;
    this.add.rectangle(w / 2, h / 2, w, h, 0x020617, 0.82).setDepth(80);
    styleHudText(this.add.text(w / 2, h / 2 - 34, won ? "挑战完成" : "挑战失败", { fontSize: "34px", fontStyle: "bold", color: won ? "#facc15" : "#fb7185" }).setOrigin(0.5)).setDepth(81);
    styleHudText(this.add.text(w / 2, h / 2 + 18, `最终得分 ${this.score}`, { fontSize: "18px", color: "#ffffff" }).setOrigin(0.5)).setDepth(81);
    this.time.delayedCall(650, () => this.onEnd({ score: this.score, won }));
  }
}
