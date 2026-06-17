import Phaser from "phaser";
import { playBleep } from "@/game/audio/webBleeps";
import { HudBanner } from "@/game/engine/HudBanner";
import { HudGoalPanel } from "@/game/engine/HudGoalPanel";
import { juiceCombo, juiceHit, juiceWin } from "@/game/engine/gameJuice";
import { generateRichDummyTexture, paintSmashDummyArena } from "@/game/engine/action-visual";
import { styleHudText } from "@/game/engine/hudTextStyle";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { AppLocale } from "@/i18n/routing";
import { type CohesivePresentation } from "@/lib/cohesive-presentation";
import { buildSceneCohesion } from "@/lib/scene-experience";
import type { GameSpec } from "@/lib/game-spec";
import { bannerPhysicsFinish, floaterCombo, hudPhysicsControls, hudScore } from "@/lib/i18n/game-hud-labels";
import { runtimeSeedFromSpec, seededRandom } from "@/lib/runtime-seed";
import { bumpQaTouch, setPhaserQaState } from "@/game/engine/phaser-qa-state";
import { schedulePhaserPlayReady, setPhaserQaClickHints } from "@/game/engine/phaser-play-ready";
import { assetBackgroundAlpha } from "@/game/engine/phaser-loaded-sprites";
import { buildSceneGoalGuidance } from "@/lib/scene-goal-guidance";

type EndPayload = { score: number; won: boolean };

/** 物理发泄：点击/拖拽对 dummy 施加冲量，连击计分 */
export class PhysicsScene extends Phaser.Scene {
  public backgroundUrl: string | null = null;
  public projectId: string | null = null;
  public uiLocale: AppLocale = "zh-Hans";

  private readonly spec: GameSpec;
  private readonly onEnd: (r: EndPayload) => void;
  private readonly soundscape: GameSoundscape | null;

  private dummy!: Phaser.Types.Physics.Arcade.ImageWithDynamicBody;
  private score = 0;
  private combo = 0;
  private comboUntil = 0;
  private hits = 0;
  private finished = false;
  private winScore = 500;
  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private banner!: HudBanner;
  private goalPanel!: HudGoalPanel;
  private cohesive!: CohesivePresentation;

  private comboWindowMs = 900;

  private hitImpulse = 1;

  private comboMultiplier = 1;
  private richArena = false;
  private progressGfx!: Phaser.GameObjects.Graphics;
  private runtimeRng!: () => number;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape: GameSoundscape | null) {
    super({ key: "PhysicsScene" });
    this.spec = spec;
    this.onEnd = onEnd;
    this.soundscape = soundscape;
  }

  preload() {
    if (this.backgroundUrl) {
      this.load.image("bgTex", this.backgroundUrl);
    }
  }

  create() {
    const cohesive = buildSceneCohesion(this.spec);
    this.cohesive = cohesive;
    this.runtimeRng = seededRandom(runtimeSeedFromSpec(this.spec));
    const physPf = this.spec.samplePlayProfile?.physics;
    this.winScore = physPf?.targetHits ?? this.spec.gameplay.winScore ?? 500;
    this.comboWindowMs = physPf?.comboWindowMs ?? 900;
    this.hitImpulse = physPf?.hitImpulse ?? 1;
    this.comboMultiplier = physPf?.comboMultiplier ?? 1;
    this.richArena = this.spec.samplePlayProfile?.variantId === "smash-the-dummy" || (physPf?.hitImpulse ?? 1) > 1.1;

    const w = this.scale.width;
    const h = this.scale.height;
    const dummyX = w / 2;
    const dummyY = h * 0.48;

    if (this.richArena) {
      paintSmashDummyArena(this, this.spec, w, h, dummyX, dummyY);
    } else {
      this.add
        .rectangle(w / 2, h / 2, w, h, Phaser.Display.Color.HexStringToColor(this.spec.theme.backgroundColor).color)
        .setDepth(-12);
    }
    if (this.backgroundUrl && this.textures.exists("bgTex")) {
      const bg = this.add
        .image(w / 2, h / 2, "bgTex")
        .setDepth(-11)
        .setAlpha(assetBackgroundAlpha(this.projectId, cohesive.qualityTier));
      bg.setScale(Math.max(w / bg.width, h / bg.height));
    }

    this.physics.world.setBounds(0, 0, w, h);
    const texKey = this.richArena ? "dummyBodyRich" : "dummyBody";
    if (this.richArena) {
      generateRichDummyTexture(this, texKey, this.spec.theme.playerColor, this.spec.theme.particleTint ?? "#f97316");
    }
    this.dummy = this.physics.add.image(dummyX, dummyY, texKey);
    if (!this.textures.exists(texKey)) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(Phaser.Display.Color.HexStringToColor(this.spec.theme.playerColor).color, 1);
      g.fillRoundedRect(0, 0, 72, 120, 12);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(36, 28, 18);
      g.generateTexture(texKey, this.richArena ? 88 : 72, this.richArena ? 136 : 120);
      g.destroy();
      this.dummy.setTexture(texKey);
    }
    this.dummy.setCollideWorldBounds(true).setBounce(0.35).setDrag(80).setMass(2.2);
    if (this.richArena) this.dummy.setScale(1.05);

    const floor = this.add.rectangle(w / 2, h - 24, w, 48, 0x334155, this.richArena ? 0.6 : 1);
    this.physics.add.existing(floor, true);

    this.scoreText = styleHudText(
      this.add.text(16, 12, hudScore(this.uiLocale, 0), { fontSize: "18px", color: "#fff" }),
    );
    this.comboText = styleHudText(
      this.add.text(16, 38, floaterCombo(this.uiLocale, 0), { fontSize: "15px", color: "#fbbf24" }),
    );
    this.hintText = styleHudText(
      this.add.text(w / 2, h - 52, hudPhysicsControls(this.uiLocale), {
        fontSize: "14px",
        color: "#cbd5e1",
      }).setOrigin(0.5),
    );
    const guidance = buildSceneGoalGuidance(this.spec, this.uiLocale);
    this.banner = new HudBanner(this, this.cohesive.banner);
    this.banner.show(guidance.banner);
    this.goalPanel = new HudGoalPanel(this, guidance, this.cohesive, { y: 124 });

    if (this.richArena) {
      this.progressGfx = this.add.graphics().setDepth(18);
      this.refreshProgressBar();
      this.hintText.setText(
        this.uiLocale === "zh-Hans" ? "连击越高得分越多 · 猛击沙袋！" : "Combo bonus · Smash the dummy!",
      );
      this.tweens.add({
        targets: this.dummy,
        angle: { from: -2, to: 2 },
        yoyo: true,
        repeat: -1,
        duration: 1200,
      });
    }

    setPhaserQaState({ qaTouches: 0 });
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.hitDummy(p));
    setPhaserQaClickHints([{ x: dummyX / w, y: dummyY / h }]);
    schedulePhaserPlayReady(this, 400, {});
  }

  private refreshProgressBar() {
    if (!this.progressGfx) return;
    const w = this.scale.width;
    const pct = Phaser.Math.Clamp(this.score / this.winScore, 0, 1);
    this.progressGfx.clear();
    this.progressGfx.fillStyle(0x1e293b, 0.7);
    this.progressGfx.fillRoundedRect(w - 136, 12, 120, 10, 4);
    this.progressGfx.fillStyle(0xf97316, 1);
    this.progressGfx.fillRoundedRect(w - 136, 12, 120 * pct, 10, 4);
  }

  private hitDummy(p: Phaser.Input.Pointer) {
    if (this.finished) return;
    const dx = this.dummy.x - p.x;
    const dy = this.dummy.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 120) return;

    const force = Phaser.Math.Clamp(280 - dist, 120, 420) * this.hitImpulse;
    const nx = dx / (dist || 1);
    const ny = dy / (dist || 1);
    this.dummy.setVelocity(nx * force, ny * force - 80);

    const now = this.time.now;
    if (now < this.comboUntil) this.combo += 1;
    else this.combo = 1;
    this.comboUntil = now + this.comboWindowMs;

    const gain = Math.round((20 + this.combo * 8) * this.comboMultiplier);
    this.score += gain;
    this.hits += 1;
    bumpQaTouch();
    this.scoreText.setText(hudScore(this.uiLocale, this.score));
    this.comboText.setText(floaterCombo(this.uiLocale, this.combo));
    this.refreshProgressBar();
    const particle = this.spec.theme.particleTint ?? "#f97316";
    if (this.combo >= 3) {
      juiceCombo(this, {
        x: this.dummy.x,
        y: this.dummy.y,
        colorHex: particle,
        text: String(this.combo),
        textColorCss: "#fbbf24",
        combo: this.combo,
        rng: this.runtimeRng,
      });
    } else {
      juiceHit(this, {
        x: this.dummy.x,
        y: this.dummy.y,
        colorHex: particle,
        rng: this.runtimeRng,
      });
    }
    playBleep("hit");
    this.soundscape?.triggerEvent("restore");

    if (this.score >= this.winScore) this.finish(true);
  }

  update(_t: number, dt: number) {
    this.goalPanel?.update();
    this.banner.tick();
    setPhaserQaState({ qaTouches: this.hits, hits: this.hits });
    if (this.finished) return;
    if (this.time.now > this.comboUntil && this.combo > 0) {
      this.combo = 0;
      this.comboText.setText(floaterCombo(this.uiLocale, 0));
    }
    if (this.hits === 0 && this.time.now > 45_000) this.finish(false);
    void dt;
  }

  private finish(won: boolean) {
    if (this.finished) return;
    this.finished = true;
    if (won) {
      juiceWin(this, {
        x: this.dummy.x,
        y: this.dummy.y,
        colorHex: this.spec.theme.particleTint ?? "#a78bfa",
        text: this.uiLocale === "zh-Hans" ? "完成" : "Win",
        textColorCss: this.cohesive.hud.accent,
        rng: this.runtimeRng,
      });
    }
    this.banner.show({ ...bannerPhysicsFinish(this.uiLocale, won), ms: 2200 });
    this.time.delayedCall(2400, () => this.onEnd({ score: this.score, won }));
  }
}
