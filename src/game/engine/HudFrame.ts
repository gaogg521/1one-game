import Phaser from "phaser";
import type { CohesivePresentation } from "@/lib/cohesive-presentation";
import type { SceneGoalGuidance } from "@/lib/scene-goal-guidance";
import { styleHudText } from "@/game/engine/hudTextStyle";

/**
 * 统一 HUD 框架。
 *
 * 替代 12 个散写元素（scoreText/livesText/waveText/banner/goalPanel/...），
 * 一个 Scene 一个 HudFrame，所有数据通过 `update(state)` 推入，由组件自己排版。
 *
 * 设计目标：
 * - 顶栏一行：title + 章节 chip + 分数 / 生命 / 波次 / 进度 / 技能冷却
 * - 中部按需 banner（瞬时事件，1.2s 自动淡出）
 * - 开场目标卡（goal card）显示 3 秒后整体消失，不在战斗中常驻
 * - 底栏一行：控制提示
 * - 所有元素 setScrollFactor(0)、depth 200+，且彼此不互相覆盖
 */
export class HudFrame {
  private readonly scene: Phaser.Scene;
  private readonly ui: CohesivePresentation;
  private readonly guidance: SceneGoalGuidance;
  private readonly w: number;
  private readonly h: number;

  // ── 顶栏 ──
  private readonly topBar: Phaser.GameObjects.Rectangle;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly actChip: Phaser.GameObjects.Text;
  private readonly statsLeft: Phaser.GameObjects.Text;
  private readonly statsRight: Phaser.GameObjects.Text;
  private readonly skillChip: Phaser.GameObjects.Text;

  // ── 目标卡（开场短暂显示） ──
  private readonly goalBox: Phaser.GameObjects.Rectangle;
  private readonly goalTitle: Phaser.GameObjects.Text;
  private readonly goalObjective: Phaser.GameObjects.Text;
  private readonly goalControls: Phaser.GameObjects.Text;
  private goalElements: Phaser.GameObjects.GameObject[];
  private goalHideAt = 0;
  private goalHidden = false;

  // ── Banner（瞬时事件） ──
  private readonly bannerBox: Phaser.GameObjects.Rectangle;
  private readonly bannerTitle: Phaser.GameObjects.Text;
  private readonly bannerMessage: Phaser.GameObjects.Text;
  private bannerHideAt = 0;

  // ── 底栏 ──
  private readonly bottomHint: Phaser.GameObjects.Text;

  // ── 武器栏（Shooter 专用） ──
  private weaponChip: Phaser.GameObjects.Text | null = null;
  private weaponBar: Phaser.GameObjects.Graphics | null = null;
  private weaponBarBg: Phaser.GameObjects.Rectangle | null = null;

  // ── 危险红边 ──
  private readonly dangerVignette: Phaser.GameObjects.Graphics;
  private dangerTarget = 0;

  constructor(
    scene: Phaser.Scene,
    spec: { title: string },
    guidance: SceneGoalGuidance,
    ui: CohesivePresentation,
  ) {
    this.scene = scene;
    this.ui = ui;
    this.guidance = guidance;
    this.w = scene.scale.width;
    this.h = scene.scale.height;

    // ── 顶栏背板 ──
    this.topBar = scene.add
      .rectangle(this.w / 2, 18, this.w, 36, ui.panelFill, 0.42)
      .setDepth(200)
      .setScrollFactor(0);

    this.titleText = styleHudText(
      scene.add
        .text(16, 10, spec.title, {
          fontFamily:
            "'Inter', system-ui, -apple-system, 'Segoe UI', 'PingFang SC', sans-serif",
          fontSize: "15px",
          fontStyle: "600",
          color: ui.hud.title,
        })
        .setDepth(201)
        .setScrollFactor(0),
    );

    this.actChip = styleHudText(
      scene.add
        .text(16 + this.titleText.width + 10, 14, "", {
          fontFamily: "system-ui, sans-serif",
          fontSize: "10px",
          color: ui.hud.accent,
          backgroundColor: `rgba(255,255,255,0.06)`,
          padding: { x: 6, y: 2 },
        })
        .setDepth(201)
        .setScrollFactor(0),
    );

    this.statsLeft = styleHudText(
      scene.add
        .text(16, 38, "", {
          fontFamily: "system-ui, sans-serif",
          fontSize: "12px",
          color: ui.hud.body,
        })
        .setDepth(201)
        .setScrollFactor(0),
    );

    this.statsRight = styleHudText(
      scene.add
        .text(this.w - 16, 38, "", {
          fontFamily: "system-ui, sans-serif",
          fontSize: "12px",
          color: ui.hud.accent2,
        })
        .setOrigin(1, 0)
        .setDepth(201)
        .setScrollFactor(0),
    );

    this.skillChip = styleHudText(
      scene.add
        .text(this.w - 16, 12, "", {
          fontFamily: "system-ui, sans-serif",
          fontSize: "11px",
          color: ui.hud.muted,
        })
        .setOrigin(1, 0)
        .setDepth(201)
        .setScrollFactor(0),
    );

    // ── 目标卡（开场 3.6s） ──
    const goalW = Math.min(420, this.w - 48);
    const goalH = 96;
    const goalCx = this.w / 2;
    const goalCy = Math.max(120, this.h * 0.32);
    this.goalBox = scene.add
      .rectangle(goalCx, goalCy, goalW, goalH, ui.panelFill, 0.78)
      .setStrokeStyle(1, ui.panelStroke, 0.4)
      .setDepth(198)
      .setScrollFactor(0);
    this.goalTitle = styleHudText(
      scene.add
        .text(goalCx, goalCy - goalH / 2 + 12, guidance.title, {
          fontFamily: "system-ui, sans-serif",
          fontSize: "12px",
          fontStyle: "600",
          color: ui.hud.accent,
        })
        .setOrigin(0.5, 0)
        .setDepth(199)
        .setScrollFactor(0),
    );
    const goalPrefix = guidance.banner.message.startsWith("Goal:") ? "Goal" : "目标";
    const ctrlPrefix = guidance.banner.message.startsWith("Goal:") ? "Controls" : "操作";
    this.goalObjective = styleHudText(
      scene.add
        .text(goalCx, goalCy - 12, `${goalPrefix}：${guidance.objective}`, {
          fontFamily: "system-ui, sans-serif",
          fontSize: "13px",
          color: ui.hud.body,
          align: "center",
          wordWrap: { width: goalW - 28 },
        })
        .setOrigin(0.5, 0)
        .setDepth(199)
        .setScrollFactor(0),
    );
    this.goalControls = styleHudText(
      scene.add
        .text(goalCx, goalCy + goalH / 2 - 22, `${ctrlPrefix}：${guidance.controls}`, {
          fontFamily: "system-ui, sans-serif",
          fontSize: "11px",
          color: ui.hud.hint,
          align: "center",
          wordWrap: { width: goalW - 28 },
        })
        .setOrigin(0.5, 0)
        .setDepth(199)
        .setScrollFactor(0),
    );
    this.goalElements = [this.goalBox, this.goalTitle, this.goalObjective, this.goalControls];
    this.goalHideAt = scene.time.now + 3600;

    // ── Banner（瞬时） ──
    const bannerW = Math.min(420, this.w - 80);
    this.bannerBox = scene.add
      .rectangle(this.w / 2, 78, bannerW, 36, ui.banner.fill, ui.banner.fillAlpha)
      .setStrokeStyle(1, ui.banner.stroke, ui.banner.strokeAlpha)
      .setDepth(210)
      .setScrollFactor(0)
      .setAlpha(0);
    this.bannerTitle = styleHudText(
      scene.add
        .text(this.w / 2, 70, "", {
          fontFamily: "system-ui, sans-serif",
          fontSize: "12px",
          fontStyle: "600",
          color: ui.banner.titleColor,
          shadow: { offsetX: 1, offsetY: 1, color: "rgba(0,0,0,0.6)", blur: 2, stroke: false, fill: true },
        })
        .setOrigin(0.5, 0)
        .setDepth(211)
        .setScrollFactor(0)
        .setAlpha(0),
    );
    this.bannerMessage = styleHudText(
      scene.add
        .text(this.w / 2, 86, "", {
          fontFamily: "system-ui, sans-serif",
          fontSize: "11px",
          color: ui.banner.messageColor,
        })
        .setOrigin(0.5, 0)
        .setDepth(211)
        .setScrollFactor(0)
        .setAlpha(0),
    );

    // ── 底栏控制提示 ──
    this.bottomHint = styleHudText(
      scene.add
        .text(this.w / 2, this.h - 18, guidance.bottomHint, {
          fontFamily: "system-ui, sans-serif",
          fontSize: "11px",
          color: ui.hud.hint,
        })
        .setOrigin(0.5, 0)
        .setDepth(205)
        .setScrollFactor(0)
        .setAlpha(0.85),
    );

    // ── 危险红边 ──
    this.dangerVignette = scene.add.graphics().setDepth(208).setScrollFactor(0).setAlpha(0);
    this.drawVignette();
  }

  /**
   * 每帧驱动：传入实时状态，组件自己排版。
   * 所有字段都是可选，未提供则保持上次状态。
   */
  update(state: HudFrameState): void {
    if (state.score != null || state.lives != null) {
      const parts: string[] = [];
      if (state.score != null) parts.push(`★ ${state.score}`);
      if (state.lives != null) parts.push(`♥ ${state.lives}`);
      this.statsLeft.setText(parts.join("   "));
    }
    if (state.right != null) this.statsRight.setText(state.right);
    if (state.actLabel != null) {
      const label = state.actLabel.trim();
      this.actChip.setText(label).setVisible(label.length > 0);
      this.actChip.setX(16 + this.titleText.width + 10);
    }
    if (state.skill != null) this.skillChip.setText(state.skill);

    // Goal card 到期淡出
    if (!this.goalHidden && this.goalHideAt > 0 && this.scene.time.now >= this.goalHideAt) {
      this.goalHidden = true;
      this.scene.tweens.add({
        targets: this.goalElements,
        alpha: 0,
        duration: 380,
        ease: "Quad.In",
        onComplete: () => {
          for (const obj of this.goalElements) {
            if ("setVisible" in obj) (obj as { setVisible: (v: boolean) => void }).setVisible(false);
          }
        },
      });
    }

    // Banner 到期淡出
    if (this.bannerHideAt > 0 && this.scene.time.now >= this.bannerHideAt) {
      this.bannerHideAt = 0;
      this.scene.tweens.add({
        targets: [this.bannerBox, this.bannerTitle, this.bannerMessage],
        alpha: 0,
        duration: 240,
        ease: "Quad.In",
      });
    }

    // 武器栏（Shooter 专用，首次传入时惰性创建）
    if (state.weaponInfo !== undefined) {
      const info = state.weaponInfo;
      if (info == null) {
        this.weaponChip?.setVisible(false);
        this.weaponBarBg?.setVisible(false);
        this.weaponBar?.setVisible(false);
      } else {
        // 惰性创建（只在 Shooter 场景中实际构建，避免所有场景多余 DOM 对象）
        if (!this.weaponChip) {
          const bx = 12, by = this.h - 48, bw = 110, bh = 36;
          this.weaponBarBg = this.scene.add
            .rectangle(bx + bw / 2, by + bh / 2, bw, bh, this.ui.panelFill, 0.55)
            .setDepth(201)
            .setScrollFactor(0);
          this.weaponChip = styleHudText(
            this.scene.add
              .text(bx + 8, by + 5, "", {
                fontFamily: "system-ui, sans-serif",
                fontSize: "11px",
                color: this.ui.hud.accent,
              })
              .setDepth(202)
              .setScrollFactor(0),
          );
          this.weaponBar = this.scene.add.graphics().setDepth(202).setScrollFactor(0);
        }
        // 更新文字
        const tierLabel = `⚡ ${info.name}`;
        this.weaponChip.setText(tierLabel).setVisible(true);
        this.weaponBarBg?.setVisible(true);
        // 绘制进度条
        if (this.weaponBar) {
          this.weaponBar.clear().setVisible(true);
          const bx = 12, by = this.h - 48, bw = 110;
          const barY = by + 26, barH = 5;
          const fill = info.total > 1 ? info.tier / (info.total - 1) : 1;
          this.weaponBar.fillStyle(0x333333, 0.7);
          this.weaponBar.fillRect(bx + 6, barY, bw - 12, barH);
          const accentHex = parseInt(this.ui.hud.accent.replace("#", ""), 16);
          this.weaponBar.fillStyle(isNaN(accentHex) ? 0xfbbf24 : accentHex, 1);
          this.weaponBar.fillRect(bx + 6, barY, Math.round((bw - 12) * fill), barH);
          // 节点点
          for (let i = 0; i < info.total; i++) {
            const nx = bx + 6 + Math.round((bw - 12) * (info.total > 1 ? i / (info.total - 1) : 1));
            const filled = i <= info.tier;
            this.weaponBar.fillStyle(filled ? (isNaN(accentHex) ? 0xfbbf24 : accentHex) : 0x555555, 1);
            this.weaponBar.fillCircle(nx, barY + Math.floor(barH / 2), 4);
          }
        }
      }
    }

    // 危险红边
    if (state.dangerLevel != null) {
      this.dangerTarget = Math.max(0, Math.min(1, state.dangerLevel));
    }
    const cur = this.dangerVignette.alpha;
    const target = this.dangerTarget * 0.36;
    if (Math.abs(cur - target) > 0.01) {
      this.dangerVignette.setAlpha(cur + (target - cur) * 0.12);
    }
  }

  /**
   * 瞬时事件 banner（章节切换 / 事件触发 / 击杀里程碑）。
   * 1.2s 默认时长，强提示用 1.8s。
   */
  flashBanner(params: { title: string; message?: string; ms?: number }): void {
    const ms = params.ms ?? 1400;
    this.bannerHideAt = this.scene.time.now + ms;
    this.bannerTitle.setText(params.title);
    this.bannerMessage.setText(params.message ?? "");
    const targets = [this.bannerBox, this.bannerTitle, this.bannerMessage];
    this.scene.tweens.add({ targets, alpha: 1, duration: 160, ease: "Quad.Out" });
    this.scene.tweens.add({ targets, scaleY: { from: 0.88, to: 1 }, duration: 200, ease: "Back.Out" });
  }

  /** 强制提前隐藏目标卡（用于击杀第一个敌人等时机） */
  dismissGoal(): void {
    if (this.goalHidden) return;
    this.goalHideAt = this.scene.time.now;
  }

  /** 切换底栏提示文案（章节切换可改提示） */
  setBottomHint(text: string): void {
    this.bottomHint.setText(text);
  }

  destroy(): void {
    this.topBar.destroy();
    this.titleText.destroy();
    this.actChip.destroy();
    this.statsLeft.destroy();
    this.statsRight.destroy();
    this.skillChip.destroy();
    for (const obj of this.goalElements) obj.destroy();
    this.bannerBox.destroy();
    this.bannerTitle.destroy();
    this.bannerMessage.destroy();
    this.bottomHint.destroy();
    this.dangerVignette.destroy();
    this.weaponChip?.destroy();
    this.weaponBarBg?.destroy();
    this.weaponBar?.destroy();
  }

  private drawVignette(): void {
    const g = this.dangerVignette;
    g.clear();
    const w = this.w;
    const h = this.h;
    const thickness = Math.max(40, Math.min(120, Math.floor(Math.min(w, h) * 0.12)));
    // 4 条边发光，向内渐变
    const layers = 6;
    for (let i = 0; i < layers; i += 1) {
      const t = i / (layers - 1);
      const a = (1 - t) * 0.42;
      const off = Math.floor(thickness * t);
      g.fillStyle(0xff2a44, a);
      g.fillRect(0, 0, w, 4 + off / 4);
      g.fillRect(0, h - 4 - off / 4, w, 4 + off / 4);
      g.fillRect(0, 0, 4 + off / 4, h);
      g.fillRect(w - 4 - off / 4, 0, 4 + off / 4, h);
    }
  }
}

export type HudFrameState = {
  /** 玩家得分（顶栏左） */
  score?: number;
  /** 玩家生命数（顶栏左） */
  lives?: number;
  /** 顶栏右侧：波次 / 进度 / 章节 / 任意上下文文案 */
  right?: string;
  /** 标题旁的章节 chip（如 "第 2 幕 · 加速"） */
  actLabel?: string;
  /** 顶栏右上角技能状态（"Shift 就绪" / "技能 4.2s"） */
  skill?: string;
  /** 危险等级 0-1：屏幕红边强度，自动平滑 */
  dangerLevel?: number;
  /** Shooter 武器升级信息（不传则不显示武器栏） */
  weaponInfo?: {
    /** 武器名称（如 "散弹 ×3"） */
    name: string;
    /** 当前在升级树中的索引（0起） */
    tier: number;
    /** 升级树总长 */
    total: number;
  } | null;
};
