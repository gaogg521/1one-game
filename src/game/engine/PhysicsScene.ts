import Phaser from "phaser";
import { playBleep, setBleepTemperament } from "@/game/audio/webBleeps";
import { HudBanner } from "@/game/engine/HudBanner";
import { juiceBurst, juiceShake } from "@/game/engine/gameJuice";
import { styleHudText } from "@/game/engine/hudTextStyle";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { AppLocale } from "@/i18n/routing";
import { buildCohesivePresentation, type CohesivePresentation } from "@/lib/cohesive-presentation";
import type { GameSpec } from "@/lib/game-spec";
import { hudReady, hudScore } from "@/lib/i18n/game-hud-labels";

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
  private cohesive!: CohesivePresentation;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape: GameSoundscape | null) {
    super({ key: "PhysicsScene" });
    this.spec = spec;
    this.onEnd = onEnd;
    this.soundscape = soundscape;
  }

  create() {
    const cohesive = buildCohesivePresentation(this.spec);
    setBleepTemperament(cohesive.bleepTemperament);
    this.cohesive = cohesive;
    this.winScore = this.spec.gameplay.winScore ?? 500;

    const w = this.scale.width;
    const h = this.scale.height;
    this.add.rectangle(w / 2, h / 2, w, h, Phaser.Display.Color.HexStringToColor(this.spec.theme.backgroundColor).color);

    this.physics.world.setBounds(0, 0, w, h);
    this.dummy = this.physics.add.image(w / 2, h * 0.48, "dummyBody");
    if (!this.textures.exists("dummyBody")) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(Phaser.Display.Color.HexStringToColor(this.spec.theme.playerColor).color, 1);
      g.fillRoundedRect(0, 0, 72, 120, 12);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(36, 28, 18);
      g.generateTexture("dummyBody", 72, 120);
      g.destroy();
      this.dummy.setTexture("dummyBody");
    }
    this.dummy.setCollideWorldBounds(true).setBounce(0.35).setDrag(80).setMass(2.2);

    const floor = this.add.rectangle(w / 2, h - 24, w, 48, 0x334155);
    this.physics.add.existing(floor, true);

    this.scoreText = styleHudText(
      this.add.text(16, 12, hudScore(this.uiLocale, 0), { fontSize: "18px", color: "#fff" }),
    );
    this.comboText = styleHudText(
      this.add.text(16, 38, "连击 x0", { fontSize: "15px", color: "#fbbf24" }),
    );
    this.hintText = styleHudText(
      this.add.text(w / 2, h - 52, "点击假人猛击 · 拖拽方向施加冲量", {
        fontSize: "14px",
        color: "#cbd5e1",
      }).setOrigin(0.5),
    );
    this.banner = new HudBanner(this, this.cohesive.banner);
    this.banner.show({ title: hudReady(this.uiLocale), ms: 1200 });

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.hitDummy(p));
  }

  private hitDummy(p: Phaser.Input.Pointer) {
    if (this.finished) return;
    const dx = this.dummy.x - p.x;
    const dy = this.dummy.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 120) return;

    const force = Phaser.Math.Clamp(280 - dist, 120, 420);
    const nx = dx / (dist || 1);
    const ny = dy / (dist || 1);
    this.dummy.setVelocity(nx * force, ny * force - 80);

    const now = this.time.now;
    if (now < this.comboUntil) this.combo += 1;
    else this.combo = 1;
    this.comboUntil = now + 900;

    const gain = Math.round(20 + this.combo * 8);
    this.score += gain;
    this.hits += 1;
    this.scoreText.setText(hudScore(this.uiLocale, this.score));
    this.comboText.setText(`连击 x${this.combo}`);
    juiceShake(this, { intensityScale: 0.8 + this.combo * 0.15 });
    juiceBurst(this, this.dummy.x, this.dummy.y, this.spec.theme.particleTint ?? "#f97316", 6 + this.combo);
    playBleep("hit");
    this.soundscape?.triggerEvent("restore");

    if (this.score >= this.winScore) this.finish(true);
  }

  update(_t: number, dt: number) {
    this.banner.tick();
    if (this.finished) return;
    if (this.time.now > this.comboUntil && this.combo > 0) {
      this.combo = 0;
      this.comboText.setText("连击 x0");
    }
    if (this.hits === 0 && this.time.now > 45_000) this.finish(false);
    void dt;
  }

  private finish(won: boolean) {
    if (this.finished) return;
    this.finished = true;
    this.banner.show({ title: won ? "解压达成！" : "时间到", ms: 2200 });
    this.time.delayedCall(2400, () => this.onEnd({ score: this.score, won }));
  }
}
