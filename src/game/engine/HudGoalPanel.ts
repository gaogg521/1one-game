import Phaser from "phaser";
import type { CohesivePresentation } from "@/lib/cohesive-presentation";
import type { SceneGoalGuidance } from "@/lib/scene-goal-guidance";
import { styleHudText } from "@/game/engine/hudTextStyle";

export class HudGoalPanel {
  private readonly scene: Phaser.Scene;
  private readonly box: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly objective: Phaser.GameObjects.Text;
  private readonly controls: Phaser.GameObjects.Text;
  private readonly stakes: Phaser.GameObjects.Text;
  private readonly objects: Array<Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text>;
  private readonly idleAlpha: number;
  private collapseAt = 0;

  constructor(
    scene: Phaser.Scene,
    guidance: SceneGoalGuidance,
    style: CohesivePresentation,
    opts?: { y?: number; hidden?: boolean },
  ) {
    this.scene = scene;
    const w = scene.scale.width;
    const panelW = Math.min(420, Math.max(280, w - 32));
    const x = 16 + panelW / 2;
    const y = opts?.y ?? 112;
    const titleY = y - 38;

    /**
     * 开场 3s 后**完全淡出**，不再半透明常驻。
     * 之前的 0.58~0.82 常驻 alpha 会与 banner / 顶栏 / 滚动战斗信息四层叠加（截图里的"信息墙"现象）。
     * 现在采用"教学卡"模式：开场展示，进入战斗即消失，避免遮挡核心玩法。
     */
    this.idleAlpha = 0;

    this.box = scene.add.rectangle(x, y, panelW, 86, style.panelFill, style.panelFillAlpha);
    this.box.setStrokeStyle(1, style.panelStroke, style.panelStrokeAlpha);
    this.box.setDepth(195);
    this.box.setScrollFactor(0);

    this.title = styleHudText(
      scene.add.text(x - panelW / 2 + 14, titleY, guidance.title, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "12px",
        color: style.hud.accent,
      }),
    );
    const goalPrefix = guidance.banner.message.startsWith("Goal:") ? "Goal" : "目标";
    const controlsPrefix = guidance.banner.message.startsWith("Goal:") ? "Controls" : "操作";
    this.objective = styleHudText(
      scene.add.text(x - panelW / 2 + 14, titleY + 20, `${goalPrefix}：${guidance.objective}`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "11px",
        color: style.hud.body,
        wordWrap: { width: panelW - 28 },
      }),
    );
    this.controls = styleHudText(
      scene.add.text(x - panelW / 2 + 14, titleY + 40, `${controlsPrefix}：${guidance.controls}`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "10px",
        color: style.hud.hint,
        wordWrap: { width: panelW - 28 },
      }),
    );
    this.stakes = styleHudText(
      scene.add.text(x - panelW / 2 + 14, titleY + 58, guidance.stakes, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "10px",
        color: style.hud.muted,
        wordWrap: { width: panelW - 28 },
      }),
    );

    this.objects = [this.box, this.title, this.objective, this.controls, this.stakes];
    for (const obj of this.objects) {
      obj.setDepth(obj === this.box ? 195 : 196);
      obj.setScrollFactor(0);
      obj.setAlpha(0);
    }
    if (!opts?.hidden) this.show(3200);
  }

  show(ms = 2600) {
    this.collapseAt = this.scene.time.now + ms;
    this.scene.tweens.add({
      targets: this.objects,
      alpha: 1,
      duration: 180,
      ease: "Quad.Out",
    });
  }

  update() {
    if (this.collapseAt <= 0 || this.scene.time.now < this.collapseAt) return;
    this.collapseAt = 0;
    this.scene.tweens.add({
      targets: this.objects,
      alpha: this.idleAlpha,
      duration: 360,
      ease: "Quad.InOut",
      onComplete: () => {
        if (this.idleAlpha === 0) {
          for (const obj of this.objects) {
            if ("setVisible" in obj) (obj as { setVisible: (v: boolean) => void }).setVisible(false);
          }
        }
      },
    });
  }

  setVisible(visible: boolean) {
    for (const obj of this.objects) obj.setVisible(visible);
  }

  destroy() {
    for (const obj of this.objects) obj.destroy();
  }
}
