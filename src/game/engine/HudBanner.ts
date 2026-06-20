import Phaser from "phaser";
import type { CohesiveHudBannerStyle } from "@/lib/cohesive-presentation";

export class HudBanner {
  private readonly scene: Phaser.Scene;

  private readonly box: Phaser.GameObjects.Rectangle;

  private readonly accent: Phaser.GameObjects.Rectangle;

  private readonly title: Phaser.GameObjects.Text;

  private readonly message: Phaser.GameObjects.Text;

  private hideAt = 0;

  constructor(scene: Phaser.Scene, style: CohesiveHudBannerStyle) {
    this.scene = scene;
    const w = scene.scale.width;
    const boxW = Math.min(560, w - 40);

    this.box = scene.add.rectangle(w / 2, 96, boxW, 64, style.fill, style.fillAlpha);
    this.box.setStrokeStyle(1, style.stroke, style.strokeAlpha);
    this.box.setDepth(200);
    this.box.setScrollFactor(0);
    this.box.setAlpha(0);

    // Left accent stripe
    const accentColor = style.stroke;
    this.accent = scene.add.rectangle(w / 2 - boxW / 2 + 2, 96, 4, 54, accentColor, 0.9);
    this.accent.setDepth(202);
    this.accent.setScrollFactor(0);
    this.accent.setAlpha(0);

    this.title = scene.add.text(w / 2, 80, "", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "14px",
      color: style.titleColor,
    });
    this.title.setShadow(1, 1, "rgba(0,0,0,0.6)", 2, false, true);
    this.title.setOrigin(0.5, 0);
    this.title.setDepth(201);
    this.title.setScrollFactor(0);
    this.title.setAlpha(0);

    this.message = scene.add.text(w / 2, 102, "", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "12px",
      color: style.messageColor,
    });
    this.message.setShadow(1, 1, "rgba(0,0,0,0.5)", 2, false, true);
    this.message.setOrigin(0.5, 0);
    this.message.setDepth(201);
    this.message.setScrollFactor(0);
    this.message.setAlpha(0);
  }

  show(params: { title: string; message?: string; ms?: number; anchor?: "top" | "bottom" }) {
    /**
     * Banner 是"瞬时事件"提示（章节切换 / 事件触发 / 击杀里程碑）。
     * 默认 1400ms（之前是 2200ms 太长，会与下一段 banner 与 goal 卡叠在一起形成信息墙）。
     */
    const ms = params.ms ?? 1400;
    this.hideAt = this.scene.time.now + ms;
    this.applyAnchor(params.anchor ?? "top");

    this.title.setText(params.title);
    this.message.setText(params.message ?? "");

    // Bounce-in: scale from 0.92 → 1
    const all = [this.box, this.title, this.message, this.accent];
    this.scene.tweens.add({ targets: all, alpha: 1, duration: 160, ease: "Quad.Out" });
    this.scene.tweens.add({ targets: all, scaleY: { from: 0.88, to: 1 }, duration: 200, ease: "Back.Out" });
  }

  tick() {
    if (this.hideAt <= 0) return;
    if (this.scene.time.now < this.hideAt) return;
    this.hideAt = 0;
    this.scene.tweens.add({
      targets: [this.box, this.title, this.message, this.accent],
      alpha: 0,
      duration: 220,
      ease: "Quad.In",
    });
  }

  private applyAnchor(anchor: "top" | "bottom") {
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    const boxW = Math.min(560, w - 40);
    /**
     * 顶部 banner 改为更靠上（y=64）的窄条，避免与 HudGoalPanel（y≈112）和顶栏标题（y≈18）同位叠加。
     * 这是截图里"星渊边境 苍穹拦截战 · 目标"与"第 1 波 · 开场 编队入侵"两张卡叠在一起的根因之一。
     */
    const boxY = anchor === "bottom" ? h - 44 : 64;
    const titleY = anchor === "bottom" ? h - 60 : 50;
    const messageY = anchor === "bottom" ? h - 40 : 70;
    this.box.setPosition(w / 2, boxY);
    this.accent.setPosition(w / 2 - boxW / 2 + 2, boxY);
    this.title.setPosition(w / 2, titleY);
    this.message.setPosition(w / 2, messageY);
  }

  destroy() {
    this.box.destroy();
    this.accent.destroy();
    this.title.destroy();
    this.message.destroy();
  }
}
