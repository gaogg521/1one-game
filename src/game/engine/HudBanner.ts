import Phaser from "phaser";
import type { CohesiveHudBannerStyle } from "@/lib/cohesive-presentation";

export class HudBanner {
  private readonly scene: Phaser.Scene;

  private readonly box: Phaser.GameObjects.Rectangle;

  private readonly title: Phaser.GameObjects.Text;

  private readonly message: Phaser.GameObjects.Text;

  private hideAt = 0;

  constructor(scene: Phaser.Scene, style: CohesiveHudBannerStyle) {
    this.scene = scene;
    const w = scene.scale.width;

    this.box = scene.add.rectangle(w / 2, 96, Math.min(560, w - 40), 64, style.fill, style.fillAlpha);
    this.box.setStrokeStyle(1, style.stroke, style.strokeAlpha);
    this.box.setDepth(200);
    this.box.setScrollFactor(0);
    this.box.setAlpha(0);

    this.title = scene.add.text(w / 2, 80, "", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "14px",
      color: style.titleColor,
    });
    this.title.setOrigin(0.5, 0);
    this.title.setDepth(201);
    this.title.setScrollFactor(0);
    this.title.setAlpha(0);

    this.message = scene.add.text(w / 2, 102, "", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "12px",
      color: style.messageColor,
    });
    this.message.setOrigin(0.5, 0);
    this.message.setDepth(201);
    this.message.setScrollFactor(0);
    this.message.setAlpha(0);
  }

  show(params: { title: string; message?: string; ms?: number }) {
    const ms = params.ms ?? 2200;
    this.hideAt = this.scene.time.now + ms;

    this.title.setText(params.title);
    this.message.setText(params.message ?? "");

    this.scene.tweens.add({
      targets: [this.box, this.title, this.message],
      alpha: 1,
      duration: 160,
      ease: "Quad.Out",
    });
  }

  tick() {
    if (this.hideAt <= 0) return;
    if (this.scene.time.now < this.hideAt) return;
    this.hideAt = 0;
    this.scene.tweens.add({
      targets: [this.box, this.title, this.message],
      alpha: 0,
      duration: 220,
      ease: "Quad.In",
    });
  }

  destroy() {
    this.box.destroy();
    this.title.destroy();
    this.message.destroy();
  }
}
