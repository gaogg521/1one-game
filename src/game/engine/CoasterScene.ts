import Phaser from "phaser";
import { playBleep, setBleepTemperament } from "@/game/audio/webBleeps";
import { HudBanner } from "@/game/engine/HudBanner";
import { juiceBurst, juiceFlash, juiceFloater, juiceShake } from "@/game/engine/gameJuice";
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
import { paintCoasterSkyBackdrop } from "@/game/engine/template-theme-visual";
import {
  drawCoasterCartRich,
  drawEndlessRoadObstacle,
  paintCoasterSkyGradient,
} from "@/game/engine/action-visual";
import type { GameSpec } from "@/lib/game-spec";
import {
  bannerCoasterFinishLose,
  bannerCoasterFinishWin,
  hudCoasterControls,
  hudCoasterSpeed,
  hudEndlessRoadControls,
  hudEndlessRoadDistance,
  hudReady,
  hudScore,
} from "@/lib/i18n/game-hud-labels";
import { runtimeSeedFromSpec, seededFloatBetween, seededIntBetween, seededRandom } from "@/lib/runtime-seed";
import { schedulePhaserPlayReady } from "@/game/engine/phaser-play-ready";
import { setPhaserQaState } from "@/game/engine/phaser-qa-state";

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
  private keyLaneLeft!: Phaser.Input.Keyboard.Key;
  private keyLaneRight!: Phaser.Input.Keyboard.Key;

  private endlessMode = false;
  private distanceGoal = 600;
  private distanceM = 0;
  private lane = 0;
  private targetLane = 0;
  private roadObstacles: Array<{ lane: number; z: number; w: number; h: number }> = [];
  private obstacleSpawnCd = 0;
  private roadLives = 3;
  private pointerDownX = 0;

  private lastMilestone = 0;

  private nearMissCd = 0;

  private bankIntensity = 1;
  private richVisuals = false;
  private runtimeRng!: () => number;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape: GameSoundscape | null) {
    super({ key: "CoasterScene" });
    this.spec = spec;
    this.onEnd = onEnd;
    this.soundscape = soundscape;
  }

  create() {
    this.cohesive = buildCohesivePresentation(this.spec);
    setBleepTemperament(this.cohesive.bleepTemperament);
    this.runtimeRng = seededRandom(runtimeSeedFromSpec(this.spec));

    const bp = this.spec.coaster ?? buildCoasterBlueprint({ spec: this.spec });
    this.path = bp.path;
    this.endlessMode = bp.mode === "endlessRoad";
    this.distanceGoal = bp.distanceGoal ?? 600;
    const coasterPf = this.spec.samplePlayProfile?.coaster;
    const speedBoost = coasterPf?.speedBoost ?? 1;
    this.bankIntensity = coasterPf?.bankIntensity ?? 1;
    const variantId = this.spec.samplePlayProfile?.variantId;
    this.richVisuals = variantId === "rail-in-air" || variantId === "crashy-roads";
    this.baseSpeed = (38 + (this.spec.director?.intensity ?? 0.55) * 22) * speedBoost;
    this.maxSpeed = this.endlessMode ? 95 : 95 + (this.spec.gameplay.playerSpeed - 300) * 0.15;
    this.speed = this.baseSpeed * 0.6;

    const w = this.scale.width;
    const h = this.scale.height;

    paintCoasterSkyBackdrop(this, this.spec, w, h, this.endlessMode);

    this.trackGfx = this.add.graphics().setDepth(2);
    this.decorGfx = this.add.graphics().setDepth(1);
    this.cartGfx = this.add.graphics().setDepth(5);

    for (let i = 0; i < 14; i += 1) {
      this.clouds.push({
        x: seededIntBetween(this.runtimeRng, 0, w),
        y: seededIntBetween(this.runtimeRng, 20, Math.floor(h * 0.42)),
        r: seededIntBetween(this.runtimeRng, 18, 42),
        sp: seededFloatBetween(this.runtimeRng, 0.08, 0.22),
      });
    }

    this.banner = new HudBanner(this, this.cohesive.banner);
    this.scoreText = styleHudText(this.add.text(16, 12, this.spec.title, { fontSize: "20px" }));
    this.timerText = styleHudText(
      this.add.text(w / 2, 14, formatTime(0), { fontSize: "22px" }).setOrigin(0.5, 0),
    );
    this.speedText = styleHudText(
      this.add.text(16, 44, hudCoasterSpeed(this.uiLocale, 0), { fontSize: "14px" }),
    );
    this.hintText = styleHudText(
      this.add.text(w / 2, h - 28, this.endlessMode ? hudEndlessRoadControls(this.uiLocale) : hudCoasterControls(this.uiLocale), {
        fontSize: "11px",
      }).setOrigin(0.5),
    );

    const kb = this.input.keyboard;
    if (kb) {
      this.keyBoost = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E);
      this.keyBrake = kb.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
      this.keyV = kb.addKey(Phaser.Input.Keyboard.KeyCodes.V);
      if (this.endlessMode) {
        this.keyLaneLeft = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        this.keyLaneRight = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
      }
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
    schedulePhaserPlayReady(this, 500);
    setPhaserQaState({ coasterDistance: 0, coasterLives: this.roadLives });

    if (this.endlessMode) {
      this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
        this.pointerDownX = p.x;
      });
      this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
        if (this.finished) return;
        const w = this.scale.width;
        const dx = p.x - this.pointerDownX;
        if (Math.abs(dx) > 36) {
          this.shiftLane(dx > 0 ? 1 : -1);
        } else if (p.x < w * 0.42) {
          this.shiftLane(-1);
        } else if (p.x > w * 0.58) {
          this.shiftLane(1);
        }
      });
    }
  }

  private shiftLane(delta: -1 | 1) {
    const next = Phaser.Math.Clamp(this.targetLane + delta, -1, 1);
    if (next === this.targetLane) return;
    this.targetLane = next;
    playBleep("pickup");
    juiceShake(this, { intensity: 0.004, durationMs: 50 });
  }

  update(_time: number, deltaMs: number) {
    if (this.finished) return;
    if (this.endlessMode) {
      this.updateEndlessRoad(deltaMs);
      return;
    }
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

    if (this.boostPower > 0.6 && this.runtimeRng() < 0.12) {
      juiceShake(this, { intensity: 0.004, durationMs: 80 });
    }

    this.drawWorld();
    this.timerText.setText(formatTime(this.elapsed));
    this.speedText.setText(hudCoasterSpeed(this.uiLocale, Math.round(this.speed * 3.2)));
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
    if (this.richVisuals) {
      paintCoasterSkyGradient(this.decorGfx, this.spec, w, h, false);
    } else {
      this.decorGfx.fillGradientStyle(0x38bdf8, 0x38bdf8, 0x7dd3fc, 0xbae6fd, 1);
      this.decorGfx.fillRect(0, 0, w, h);
    }

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
        const starCol = this.richVisuals ? 0xfde047 : 0xfde047;
        this.trackGfx.fillStyle(starCol, 0.35 + depth * 0.4);
        const starX = cx + Math.sin(i * 1.7) * half * 1.4;
        this.trackGfx.fillCircle(starX, screenY + lift - 30 * depth, 4 + depth * 5);
      }
      if (this.richVisuals && i % 2 === 0 && depth > 0.5) {
        this.trackGfx.lineStyle(1, 0xffffff, 0.15 * depth);
        this.trackGfx.lineBetween(cx, screenY + lift + 8, cx, screenY + lift + 28 * depth);
      }
    }

    this.cartGfx.clear();
    const cartY = h - 118 + (this.thirdPerson ? 0 : -40);
    const cartX = w / 2;
    const bank = cam.bank * (this.thirdPerson ? 0.6 : 0.2);
    const pc = Phaser.Display.Color.HexStringToColor(this.spec.theme.playerColor);
    const cartW = this.thirdPerson ? 54 : 72;
    const cartH = this.thirdPerson ? 28 : 36;

    if (this.richVisuals) {
      drawCoasterCartRich(this.cartGfx, cartX, cartY, cartW, cartH, pc.color, this.thirdPerson);
    } else {
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
    }

    if (Math.abs(bank) > 0.05) {
      this.cameras.main.setRotation(bank * 0.08 * this.bankIntensity);
    } else {
      this.cameras.main.setRotation(0);
    }
  }

  private updateEndlessRoad(deltaMs: number) {
    const dt = deltaMs / 1000;
    this.elapsed += dt;
    const cursors = this.input.keyboard?.createCursorKeys();
    if (cursors?.left && Phaser.Input.Keyboard.JustDown(cursors.left)) this.shiftLane(-1);
    if (cursors?.right && Phaser.Input.Keyboard.JustDown(cursors.right)) this.shiftLane(1);
    if (this.keyLaneLeft && Phaser.Input.Keyboard.JustDown(this.keyLaneLeft)) this.shiftLane(-1);
    if (this.keyLaneRight && Phaser.Input.Keyboard.JustDown(this.keyLaneRight)) this.shiftLane(1);

    this.lane = Phaser.Math.Linear(this.lane, this.targetLane, dt * 10);
    const ramp = this.baseSpeed + 16 + this.distanceM * 0.055 + this.elapsed * 0.35;
    const targetSpeed = Math.min(this.maxSpeed + 28, ramp);
    this.speed = Phaser.Math.Linear(this.speed, targetSpeed, dt * 1.1);
    this.distanceM += this.speed * dt * 0.38;
    this.trackProgress = Math.min(1, this.distanceM / this.distanceGoal);

    this.obstacleSpawnCd -= dt;
    if (this.obstacleSpawnCd <= 0) {
      const density = 1.35 - this.trackProgress * 0.45;
      this.obstacleSpawnCd = Math.max(0.42, density);
      this.roadObstacles.push({
        lane: Phaser.Math.Between(-1, 1),
        z: 1.12,
        w: 36 + Phaser.Math.Between(0, 22),
        h: 28 + Phaser.Math.Between(0, 18),
      });
    }
    for (const o of this.roadObstacles) o.z -= dt * (0.62 + this.speed * 0.014);
    this.roadObstacles = this.roadObstacles.filter((o) => o.z > -0.05);

    this.nearMissCd = Math.max(0, this.nearMissCd - dt);
    for (const o of this.roadObstacles) {
      if (o.z < 0.12 && o.z > 0.02 && Math.abs(o.lane - this.lane) < 0.55) {
        this.roadLives -= 1;
        o.z = -1;
        juiceShake(this, { intensity: 0.022, durationMs: 220 });
        juiceFlash(this, { r: 239, g: 68, b: 68 }, { durationMs: 120 });
        playBleep("hit");
        if (this.roadLives <= 0) {
          this.finish(false);
          return;
        }
      } else if (
        o.z < 0.05 &&
        o.z > 0.03 &&
        this.nearMissCd <= 0 &&
        Math.abs(o.lane - this.lane) >= 0.55 &&
        Math.abs(o.lane - this.lane) < 0.9
      ) {
        this.nearMissCd = 0.8;
        juiceFloater(this, this.scale.width / 2, this.scale.height * 0.42, this.uiLocale === "zh-Hans" ? "擦边!" : "Near!", "#fde047");
        juiceShake(this, { intensity: 0.003, durationMs: 60 });
      }
    }

    const milestoneStep = 200;
    const milestone = Math.floor(this.distanceM / milestoneStep);
    if (milestone > this.lastMilestone) {
      this.lastMilestone = milestone;
      juiceFloater(
        this,
        this.scale.width / 2,
        this.scale.height * 0.36,
        `${milestone * milestoneStep}m`,
        this.cohesive.hud.accent,
      );
      playBleep("pickup");
    }

    this.drawEndlessRoad();
    this.timerText.setText(formatTime(this.elapsed));
    this.speedText.setText(
      `${this.uiLocale === "zh-Hans" ? "生命" : "Lives"} ${this.roadLives}  ·  ${hudCoasterSpeed(this.uiLocale, Math.round(this.speed * 3.2))}`,
    );
    this.scoreText.setText(hudEndlessRoadDistance(this.uiLocale, Math.round(this.distanceM)));
    setPhaserQaState({ coasterDistance: Math.round(this.distanceM), coasterLives: this.roadLives });

    if (this.distanceM >= this.distanceGoal) this.finish(true);
  }

  private drawEndlessRoad() {
    const w = this.scale.width;
    const h = this.scale.height;
    const horizon = h * 0.3;
    this.decorGfx.clear();
    if (this.richVisuals) {
      paintCoasterSkyGradient(this.decorGfx, this.spec, w, h, true);
    } else {
      this.decorGfx.fillGradientStyle(0x7dd3fc, 0x7dd3fc, 0xbae6fd, 0xe0f2fe, 1);
      this.decorGfx.fillRect(0, 0, w, h);
    }

    this.trackGfx.clear();
    const laneW = 110;
    const roadCol = Phaser.Display.Color.HexStringToColor(this.spec.theme.backgroundColor).color;
    for (let lane = -1; lane <= 1; lane += 1) {
      const cx = w / 2 + lane * laneW + this.lane * -laneW * 0.15;
      this.trackGfx.fillStyle(roadCol, this.richVisuals ? 0.92 : 0.85);
      this.trackGfx.fillRect(cx - laneW * 0.42, horizon, laneW * 0.84, h - horizon - 40);
      this.trackGfx.lineStyle(2, 0xfde047, this.richVisuals ? 0.45 : 0.35);
      this.trackGfx.lineBetween(cx - laneW * 0.42, horizon, cx - laneW * 0.42, h - 40);
      this.trackGfx.lineBetween(cx + laneW * 0.42, horizon, cx + laneW * 0.42, h - 40);
      if (this.richVisuals) {
        for (let dash = horizon + 20; dash < h - 50; dash += 48) {
          this.trackGfx.fillStyle(0xffffff, 0.25);
          this.trackGfx.fillRect(cx - 3, dash, 6, 18);
        }
      }
    }

    for (const o of this.roadObstacles) {
      const depth = 1 - o.z;
      if (depth <= 0 || depth > 1) continue;
      const cx = w / 2 + o.lane * laneW;
      const y = horizon + (1 - depth) * (h - horizon - 120);
      const scale = 0.25 + depth * 0.85;
      const ow = o.w * scale;
      const oh = o.h * scale;
      if (this.richVisuals) {
        drawEndlessRoadObstacle(this.trackGfx, cx, y, ow, oh);
      } else {
        this.trackGfx.fillStyle(0xef4444, 0.55 + depth * 0.4);
        this.trackGfx.fillRoundedRect(cx - ow / 2, y, ow, oh, 6);
      }
    }

    this.cartGfx.clear();
    const cartX = w / 2 + this.lane * laneW;
    const cartY = h - 108;
    const pc = Phaser.Display.Color.HexStringToColor(this.spec.theme.playerColor);
    if (this.richVisuals) {
      drawCoasterCartRich(this.cartGfx, cartX, cartY, 56, 28, pc.color, true);
    } else {
      this.cartGfx.fillStyle(pc.color, 1);
      this.cartGfx.fillRoundedRect(cartX - 28, cartY - 22, 56, 28, 6);
      this.cartGfx.fillStyle(0x1f2937, 1);
      this.cartGfx.fillCircle(cartX - 18, cartY + 8, 7);
      this.cartGfx.fillCircle(cartX + 18, cartY + 8, 7);
    }
  }

  private finish(won: boolean) {
    if (this.finished) return;
    this.finished = true;
    const score = this.endlessMode
      ? Math.round(this.distanceM * (won ? 14 : 6))
      : won
        ? Math.max(1, Math.round(10000 / Math.max(this.elapsed, 1)))
        : 0;
    this.banner.show({
      ...(won
        ? this.endlessMode
          ? {
              title: this.uiLocale === "zh-Hans" ? "公路征服!" : "Road cleared!",
              message:
                this.uiLocale === "zh-Hans"
                  ? `距离 ${Math.round(this.distanceM)} m · 得分 ${score}`
                  : `${Math.round(this.distanceM)} m · score ${score}`,
            }
          : bannerCoasterFinishWin(this.uiLocale, formatTime(this.elapsed))
        : this.endlessMode
          ? {
              title: this.uiLocale === "zh-Hans" ? "撞车了!" : "Crashed!",
              message:
                this.uiLocale === "zh-Hans"
                  ? `跑了 ${Math.round(this.distanceM)} m · 得分 ${score}`
                  : `${Math.round(this.distanceM)} m · score ${score}`,
            }
          : bannerCoasterFinishLose(this.uiLocale, this.spec.labels.hazard)),
      ms: 3200,
    });
    playBleep(won ? "win" : "hit");
    juiceShake(this, { intensity: won ? 0.012 : 0.02, durationMs: 220 });
    if (won) {
      juiceFlash(this, { r: 120, g: 210, b: 255 }, { durationMs: 160 });
      juiceFloater(this, this.scale.width / 2, this.scale.height * 0.4, this.uiLocale === "zh-Hans" ? "完赛!" : "Finish!", this.cohesive.hud.accent);
    }
    this.time.delayedCall(900, () => {
      this.onEnd({ score, won });
    });
  }
}
