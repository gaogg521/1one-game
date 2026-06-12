import Phaser from "phaser";
import { playBleep, setBleepTemperament } from "@/game/audio/webBleeps";
import { HudBanner } from "@/game/engine/HudBanner";
import { juiceShake } from "@/game/engine/gameJuice";
import { styleHudText } from "@/game/engine/hudTextStyle";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { AppLocale } from "@/i18n/routing";
import {
  buildCoasterBlueprint,
  coasterPathLength,
  sampleCoasterPath,
  type CoasterPathPoint,
} from "@/lib/coaster-blueprint";
import { buildCohesivePresentation, type CohesivePresentation } from "@/lib/cohesive-presentation";
import type { GameSpec } from "@/lib/game-spec";
import { hudScore, hudReady } from "@/lib/i18n/game-hud-labels";

type EndPayload = { score: number; won: boolean };

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
}

/** 伪 3D 空中轨道竞速：第三人称跟车、Boost/Brake、计时完赛 */
export class CoasterScene extends Phaser.Scene {
  public backgroundUrl: string | null = null;
  public projectId: string | null = null;
  public uiLocale: AppLocale = "zh-Hans";

  private readonly spec: GameSpec;
  private readonly onEnd: (r: EndPayload) => void;
  private readonly soundscape: GameSoundscape | null;

  private path: CoasterPathPoint[] = [];
  private trackProgress = 0;
  private speed = 0;
  private baseSpeed = 42;
  private maxSpeed = 118;
  private minSpeed = 8;
  private boostPower = 0;
  private brakePower = 0;
  private elapsed = 0;
  private finished = false;
  private thirdPerson = true;

  private scoreText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private speedText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private banner!: HudBanner;
  private cohesive!: CohesivePresentation;
  private trackGfx!: Phaser.GameObjects.Graphics;
  private decorGfx!: Phaser.GameObjects.Graphics;
  private cartGfx!: Phaser.GameObjects.Graphics;
  private clouds: Array<{ x: number; y: number; r: number; sp: number }> = [];

  private keyBoost!: Phaser.Input.Keyboard.Key;
  private keyBrake!: Phaser.Input.Keyboard.Key;
  private keyV!: Phaser.Input.Keyboard.Key;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape: GameSoundscape | null) {
    super({ key: "CoasterScene" });
    this.spec = spec;
    this.onEnd = onEnd;
    this.soundscape = soundscape;
  }

  create() {
    this.cohesive = buildCohesivePresentation(this.spec);
    setBleepTemperament(this.cohesive.bleepTemperament);

    const bp = this.spec.coaster ?? buildCoasterBlueprint({ spec: this.spec });
    this.path = bp.path;
    this.baseSpeed = 38 + (this.spec.director?.intensity ?? 0.55) * 22;
    this.maxSpeed = 95 + (this.spec.gameplay.playerSpeed - 300) * 0.15;
    this.speed = this.baseSpeed * 0.6;

    const w = this.scale.width;
    const h = this.scale.height;

    this.trackGfx = this.add.graphics().setDepth(2);
    this.decorGfx = this.add.graphics().setDepth(1);
    this.cartGfx = this.add.graphics().setDepth(5);

    for (let i = 0; i < 14; i += 1) {
      this.clouds.push({
        x: Phaser.Math.Between(0, w),
        y: Phaser.Math.Between(20, h * 0.42),
        r: Phaser.Math.Between(18, 42),
        sp: Phaser.Math.FloatBetween(0.08, 0.22),
      });
    }

    this.banner = new HudBanner(this, this.cohesive.banner);
    this.scoreText = styleHudText(this.add.text(16, 12, this.spec.title, { fontSize: "20px" }));
    this.timerText = styleHudText(
      this.add.text(w / 2, 14, formatTime(0), { fontSize: "22px" }).setOrigin(0.5, 0),
    );
    this.speedText = styleHudText(this.add.text(16, 44, "0 KM/H", { fontSize: "14px" }));
    this.hintText = styleHudText(
      this.add
        .text(w / 2, h - 28, "Boost · E / →   ·   Brake · Q / ←   ·   视角 · V", { fontSize: "11px" })
        .setOrigin(0.5),
    );

    const kb = this.input.keyboard;
    if (kb) {
      this.keyBoost = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E);
      this.keyBrake = kb.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
      this.keyV = kb.addKey(Phaser.Input.Keyboard.KeyCodes.V);
      kb.addCapture([
        Phaser.Input.Keyboard.KeyCodes.SPACE,
        Phaser.Input.Keyboard.KeyCodes.E,
        Phaser.Input.Keyboard.KeyCodes.Q,
        Phaser.Input.Keyboard.KeyCodes.V,
      ]);
    }

    this.banner.show({
      title: this.spec.title,
      message: this.spec.labels.subtitle ?? hudReady(this.uiLocale),
      ms: 2200,
    });
  }

  update(_time: number, deltaMs: number) {
    if (this.finished) return;
    const dt = deltaMs / 1000;
    this.elapsed += dt;

    const cursors = this.input.keyboard?.createCursorKeys();
    const boostOn =
      this.keyBoost?.isDown ||
      cursors?.right?.isDown ||
      cursors?.shift?.isDown ||
      this.input.activePointer.isDown;
    const brakeOn = this.keyBrake?.isDown || cursors?.left?.isDown;

    if (Phaser.Input.Keyboard.JustDown(this.keyV)) {
      this.thirdPerson = !this.thirdPerson;
      playBleep("pickup");
    }

    this.boostPower = Phaser.Math.Linear(this.boostPower, boostOn ? 1 : 0, dt * 4);
    this.brakePower = Phaser.Math.Linear(this.brakePower, brakeOn ? 1 : 0, dt * 5);

    const sample = sampleCoasterPath(this.path, this.trackProgress);
    const hill = -sample.tangent.y;
    const gravity = 18 * hill;
    const target = this.baseSpeed + this.boostPower * 48 - this.brakePower * 36 + gravity;
    this.speed = Phaser.Math.Linear(this.speed, Phaser.Math.Clamp(target, this.minSpeed, this.maxSpeed), dt * 2.2);

    const totalLen = coasterPathLength(this.path) || 1;
    this.trackProgress += (this.speed * dt) / totalLen;

    if (this.boostPower > 0.6 && Math.random() < 0.12) {
      juiceShake(this, { intensity: 0.004, durationMs: 80 });
    }

    this.drawWorld();
    this.timerText.setText(formatTime(this.elapsed));
    this.speedText.setText(`${Math.round(this.speed * 3.2)} KM/H`);
    this.scoreText.setText(hudScore(this.uiLocale, Math.round(this.trackProgress * 100)));

    if (this.trackProgress >= 1) {
      this.finish(true);
    }
  }

  private drawWorld() {
    const w = this.scale.width;
    const h = this.scale.height;
    const horizon = h * 0.34;
    const cam = sampleCoasterPath(this.path, this.trackProgress);

    this.decorGfx.clear();
    this.decorGfx.fillGradientStyle(0x38bdf8, 0x38bdf8, 0x7dd3fc, 0xbae6fd, 1);
    this.decorGfx.fillRect(0, 0, w, h);

    for (const c of this.clouds) {
      c.x += c.sp;
      if (c.x > w + 60) c.x = -60;
      this.decorGfx.fillStyle(0xffffff, 0.55);
      this.decorGfx.fillCircle(c.x, c.y, c.r);
      this.decorGfx.fillCircle(c.x + c.r * 0.6, c.y + 4, c.r * 0.72);
    }

    this.trackGfx.clear();
    const railW = parseInt(this.spec.theme.hazardColor.slice(1, 3), 16);
    const railG = parseInt(this.spec.theme.hazardColor.slice(3, 5), 16);
    const railB = parseInt(this.spec.theme.hazardColor.slice(5, 7), 16);
    const tieCol = Phaser.Display.Color.GetColor(
      Math.min(255, railW + 40),
      Math.min(255, railG + 20),
      Math.min(255, railB),
    );

    const segments = 28;
    for (let i = segments; i >= 0; i -= 1) {
      const t = this.trackProgress + i * 0.012;
      if (t > 1.02) continue;
      const s = sampleCoasterPath(this.path, Math.min(1, t));
      const rel = i / segments;
      const depth = 1 - rel * 0.92;
      const scale = 0.15 + depth * 1.35;
      const screenY = horizon + (1 - depth) * (h - horizon - 90);
      const offsetX = (s.pos.x - cam.pos.x) * scale * 6;
      const cx = w / 2 + offsetX;
      const half = (18 + depth * 42) * (1 + Math.abs(s.bank) * 0.4);
      const lift = (s.pos.y - cam.pos.y) * scale * 3;

      this.trackGfx.fillStyle(tieCol, 0.55 + depth * 0.35);
      this.trackGfx.fillRect(cx - half - 6, screenY + lift - 3, half * 2 + 12, 5);
      this.trackGfx.lineStyle(3 + depth * 2, 0xc0c0c0, 0.5 + depth * 0.45);
      this.trackGfx.lineBetween(cx - half, screenY + lift, cx + half, screenY + lift);
      this.trackGfx.lineStyle(2, 0x888888, 0.35 + depth * 0.4);
      this.trackGfx.lineBetween(cx - half, screenY + lift + 5, cx + half, screenY + lift + 5);

      if (i % 4 === 0 && depth > 0.35) {
        this.trackGfx.fillStyle(0xfde047, 0.35 + depth * 0.4);
        const starX = cx + Math.sin(i * 1.7) * half * 1.4;
        this.trackGfx.fillCircle(starX, screenY + lift - 30 * depth, 4 + depth * 5);
      }
    }

    this.cartGfx.clear();
    const cartY = h - 118 + (this.thirdPerson ? 0 : -40);
    const cartX = w / 2;
    const bank = cam.bank * (this.thirdPerson ? 0.6 : 0.2);
    const pc = Phaser.Display.Color.HexStringToColor(this.spec.theme.playerColor);
    const cartW = this.thirdPerson ? 54 : 72;
    const cartH = this.thirdPerson ? 28 : 36;

    this.cartGfx.fillStyle(pc.color, 1);
    this.cartGfx.fillRoundedRect(cartX - cartW / 2, cartY - cartH, cartW, cartH, 6);
    this.cartGfx.fillStyle(0x1f2937, 1);
    this.cartGfx.fillCircle(cartX - cartW * 0.32, cartY + 4, 7);
    this.cartGfx.fillCircle(cartX + cartW * 0.32, cartY + 4, 7);
    if (this.thirdPerson) {
      this.cartGfx.fillStyle(0xfbbf24, 1);
      this.cartGfx.fillRect(cartX - 8, cartY - cartH - 14, 16, 14);
    }
    this.cartGfx.lineStyle(2, 0xffffff, 0.25);
    this.cartGfx.strokeRoundedRect(cartX - cartW / 2, cartY - cartH, cartW, cartH, 6);

    if (Math.abs(bank) > 0.05) {
      this.cameras.main.setRotation(bank * 0.08);
    } else {
      this.cameras.main.setRotation(0);
    }
  }

  private finish(won: boolean) {
    if (this.finished) return;
    this.finished = true;
    const score = won ? Math.max(1, Math.round(10000 / Math.max(this.elapsed, 1))) : 0;
    this.banner.show({
      title: won ? "完赛！" : "脱轨",
      message: won ? `用时 ${formatTime(this.elapsed)}` : this.spec.labels.hazard,
      ms: 3200,
    });
    playBleep(won ? "win" : "hit");
    juiceShake(this, { intensity: won ? 0.012 : 0.02, durationMs: 220 });
    this.time.delayedCall(900, () => {
      this.onEnd({ score, won });
    });
  }
}
