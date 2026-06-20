import Phaser from "phaser";
import { playBleep } from "@/game/audio/webBleeps";
import { HudFrame } from "@/game/engine/HudFrame";
import {
  juiceBurst,
  juiceFail,
  juiceHit,
  juiceWin,
  themeParticleHex,
} from "@/game/engine/gameJuice";
import type { GameSpec } from "@/lib/game-spec";
import { buildFightingBlueprint, type FightingMove } from "@/lib/fighting-blueprint";
import { buildSceneCohesion } from "@/lib/scene-experience";
import { buildSceneGoalGuidance } from "@/lib/scene-goal-guidance";
import { setPhaserQaState } from "@/game/engine/phaser-qa-state";
import { schedulePhaserPlayReady } from "@/game/engine/phaser-play-ready";
import { spawnDamageNumber } from "@/game/engine/damage-number";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { AppLocale } from "@/i18n/routing";
import { hudFightingRound, hudFightingHp, bannerFightingWin } from "@/lib/i18n/game-hud-labels";

type EndPayload = { score: number; won: boolean };

/** 招式定义：伤害 / 攻击范围 / 冷却 / 闪白时长 / 击退 */
type MoveDef = {
  key: FightingMove;
  label: string;
  damage: number;
  /** 攻击判定水平距离（玩家中心到 AI 中心，像素） */
  range: number;
  /** 出招冷却 ms */
  cooldownMs: number;
  /** 命中后 AI 闪白时长 ms */
  flashMs: number;
  /** 命中后击退距离 px */
  knockback: number;
};

/** 单个 fighter 的运行时状态 */
type Fighter = {
  body: Phaser.GameObjects.Rectangle;
  /** 出招时短暂出现的判定 / 视觉冲击框 */
  hitFx: Phaser.GameObjects.Rectangle;
  hp: number;
  hpMax: number;
  facing: 1 | -1; // 1=右，-1=左
  cooldownUntil: number;
  flashUntil: number;
  staggerUntil: number; // 受击硬直，期间无法行动
  blocking: boolean;
};

const PLAYER_COLOR = 0x38bdf8; // 青蓝
const AI_COLOR = 0xf87171; // 红
const GROUND_COLOR = 0x1f2937;
const ARENA_LEFT = 120;
const FIGHTER_W = 54;
const FIGHTER_H = 96;
const FIGHTER_SPEED = 230; // px/s
const ROUND_INTRO_MS = 1200;
const ROUND_END_MS = 1600;

/** 默认招式表（与 blueprint.moves 对齐） */
const MOVE_TABLE: Record<FightingMove, MoveDef> = {
  light: { key: "light", label: "轻拳", damage: 6, range: 78, cooldownMs: 260, flashMs: 140, knockback: 28 },
  heavy: { key: "heavy", label: "重拳", damage: 14, range: 86, cooldownMs: 620, flashMs: 260, knockback: 70 },
  block: { key: "block", label: "格挡", damage: 0, range: 0, cooldownMs: 420, flashMs: 0, knockback: 0 },
  special: { key: "special", label: "特殊技", damage: 22, range: 110, cooldownMs: 1400, flashMs: 360, knockback: 120 },
};

/**
 * FightingScene：2D 横版 1v1 格斗。
 *
 * - 玩家 vs AI，3 局 2 胜
 * - 玩家：A/D 移动，J=轻拳 / K=重拳 / L=格挡 / U=特殊技
 * - AI：按 aiDifficulty 随机出招 / 接近
 * - 命中：扣血 + 闪白 + 击退 + 屏震 + 伤害飘字
 * - HUD：玩家/AI 血量 + 回合比分
 */
export class FightingScene extends Phaser.Scene {
  public backgroundUrl: string | null = null;
  public projectId: string | null = null;
  public uiLocale: AppLocale = "zh-Hans";

  private readonly spec: GameSpec;
  private readonly onEnd: (r: EndPayload) => void;
  private readonly soundscape: GameSoundscape | null;

  private hud!: HudFrame;
  private cohesive!: ReturnType<typeof buildSceneCohesion>;

  private player!: Fighter;
  private ai!: Fighter;

  private ground!: Phaser.GameObjects.Rectangle;

  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyJ!: Phaser.Input.Keyboard.Key;
  private keyK!: Phaser.Input.Keyboard.Key;
  private keyL!: Phaser.Input.Keyboard.Key;
  private keyU!: Phaser.Input.Keyboard.Key;

  private roundsTotal = 3;
  private roundsToWin = 2;
  private playerWins = 0;
  private aiWins = 0;
  private roundIndex = 0;

  private hpMax = 100;
  private aiDifficulty = 0.55;
  private moves: FightingMove[] = ["light", "heavy", "block", "special"];

  private finished = false;
  /** 当前回合状态：intro / fighting / roundEnd / matchEnd */
  private phase: "intro" | "fighting" | "roundEnd" | "matchEnd" = "intro";
  private phaseUntil = 0;

  private aiNextDecisionAt = 0;
  private matchScore = 0; // 玩家累计回合胜数 * 100，作为 onEnd.score

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape?: GameSoundscape) {
    super("FightingScene");
    this.spec = spec;
    this.onEnd = onEnd;
    this.soundscape = soundscape ?? null;
  }

  preload() {
    // 占位：未来可在此 preload 玩家/AI sprite
  }

  create() {
    const viewW = this.scale.width;
    const viewH = this.scale.height;

    const bp = this.spec.fighting ?? buildFightingBlueprint({ spec: this.spec });
    this.roundsTotal = bp.rounds;
    this.roundsToWin = Math.ceil(this.roundsTotal / 2);
    this.hpMax = bp.playerHp;
    this.aiDifficulty = bp.aiDifficulty;
    this.moves = bp.moves ?? ["light", "heavy", "block", "special"];

    this.cohesive = buildSceneCohesion(this.spec);

    // 背景
    this.cameras.main.setBackgroundColor(this.spec.theme.backgroundColor ?? "#0f1424");
    this.add
      .rectangle(0, 0, viewW, viewH, parseInt((this.spec.theme.backgroundColor ?? "#0f1424").replace("#", ""), 16))
      .setOrigin(0, 0)
      .setDepth(-20);
    // 远景柔光
    const glow = this.add.graphics().setDepth(-15);
    glow.fillStyle(0xffffff, 0.04);
    glow.fillEllipse(viewW / 2, viewH * 0.42, viewW * 0.9, viewH * 0.5);

    // 地面
    const groundY = viewH - 80;
    this.ground = this.add
      .rectangle(viewW / 2, groundY + FIGHTER_H / 2, viewW, 8, GROUND_COLOR)
      .setDepth(0);
    // 地面下阴影
    this.add.rectangle(viewW / 2, groundY + FIGHTER_H / 2 + 8, viewW, viewH, 0x000000, 0.25).setDepth(-5).setOrigin(0.5, 0);

    // 玩家（左）与 AI（右）
    const playerX = ARENA_LEFT + 80;
    const aiX = viewW - ARENA_LEFT - 80;
    this.player = this.makeFighter(playerX, groundY, PLAYER_COLOR, 1);
    this.ai = this.makeFighter(aiX, groundY, AI_COLOR, -1);

    // 输入
    const kb = this.input.keyboard!;
    this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyJ = kb.addKey(Phaser.Input.Keyboard.KeyCodes.J);
    this.keyK = kb.addKey(Phaser.Input.Keyboard.KeyCodes.K);
    this.keyL = kb.addKey(Phaser.Input.Keyboard.KeyCodes.L);
    this.keyU = kb.addKey(Phaser.Input.Keyboard.KeyCodes.U);

    // HUD
    const guidance = buildSceneGoalGuidance(this.spec, this.uiLocale);
    this.hud = new HudFrame(this, { title: this.spec.title }, guidance, this.cohesive);
    const hint =
      this.uiLocale === "zh-Hans"
        ? "A/D 移动 · J 轻拳 · K 重拳 · L 格挡 · U 特殊技"
        : "A/D move · J light · K heavy · L block · U special";
    this.hud.setBottomHint(hint);

    this.startRound(0);
    setPhaserQaState({ roundIndex: 0, playerWins: 0, aiWins: 0 });
    schedulePhaserPlayReady(this, 350, { roundIndex: 0 });
  }

  private makeFighter(x: number, groundY: number, color: number, facing: 1 | -1): Fighter {
    const body = this.add.rectangle(x, groundY, FIGHTER_W, FIGHTER_H, color).setDepth(10);
    // 头部圆
    this.add.circle(x, groundY - FIGHTER_H / 2 + 8, 14, color).setDepth(11);
    // 边框
    this.add.rectangle(x, groundY, FIGHTER_W, FIGHTER_H).setStrokeStyle(2, 0x000000, 0.4).setDepth(11);
    // 命中 FX（默认不可见）
    const hitFx = this.add
      .rectangle(x, groundY, 0, 0, 0xffffff, 0)
      .setDepth(12);
    return {
      body,
      hitFx,
      hp: this.hpMax,
      hpMax: this.hpMax,
      facing,
      cooldownUntil: 0,
      flashUntil: 0,
      staggerUntil: 0,
      blocking: false,
    };
  }

  private startRound(idx: number) {
    this.roundIndex = idx;
    this.player.hp = this.hpMax;
    this.ai.hp = this.hpMax;
    this.player.cooldownUntil = 0;
    this.player.flashUntil = 0;
    this.player.staggerUntil = 0;
    this.player.blocking = false;
    this.ai.cooldownUntil = 0;
    this.ai.flashUntil = 0;
    this.ai.staggerUntil = 0;
    this.ai.blocking = false;
    const viewW = this.scale.width;
    const groundY = this.scale.height - 80;
    this.player.body.setPosition(ARENA_LEFT + 80, groundY);
    this.ai.body.setPosition(viewW - ARENA_LEFT - 80, groundY);
    this.player.facing = 1;
    this.ai.facing = -1;

    this.phase = "intro";
    this.phaseUntil = this.time.now + ROUND_INTRO_MS;
    const roundLabel = this.uiLocale === "zh-Hans" ? `第 ${idx + 1} 回合` : `Round ${idx + 1}`;
    this.hud.flashBanner({ title: roundLabel, message: this.uiLocale === "zh-Hans" ? "准备" : "Ready", ms: ROUND_INTRO_MS });
    playBleep("pickup");
    this.refreshHud();
  }

  update() {
    if (this.finished) return;
    const now = this.time.now;

    // 闪白渐隐
    this.applyFlash(this.player, now);
    this.applyFlash(this.ai, now);

    if (this.phase === "intro") {
      if (now >= this.phaseUntil) {
        this.phase = "fighting";
        const fightLabel = this.uiLocale === "zh-Hans" ? "开打！" : "Fight!";
        this.hud.flashBanner({ title: fightLabel, ms: 700 });
        playBleep("hit");
      }
      this.refreshHud();
      return;
    }

    if (this.phase === "fighting") {
      this.tickPlayerInput(now);
      this.tickAI(now);
      this.tickFacing();
      this.checkRoundOutcome(now);
    }

    if (this.phase === "roundEnd") {
      if (now >= this.phaseUntil) {
        // 检查比赛是否结束
        if (this.playerWins >= this.roundsToWin || this.aiWins >= this.roundsToWin || this.roundIndex + 1 >= this.roundsTotal) {
          this.endMatch();
        } else {
          this.startRound(this.roundIndex + 1);
        }
      }
    }

    this.refreshHud();
  }

  private tickPlayerInput(now: number) {
    const p = this.player;
    if (now < p.staggerUntil) {
      p.blocking = false;
      return;
    }
    // 移动
    let vx = 0;
    if (this.keyA.isDown) vx -= FIGHTER_SPEED;
    if (this.keyD.isDown) vx += FIGHTER_SPEED;
    // 不允许穿过 AI
    const nextX = p.body.x + (vx * this.game.loop.delta) / 1000;
    const minGap = FIGHTER_W; // 两 fighter 中心最小间距
    const aiX = this.ai.body.x;
    let clampedX = nextX;
    if (vx > 0 && clampedX > aiX - minGap) clampedX = aiX - minGap;
    if (vx < 0 && clampedX < aiX + minGap && clampedX > ARENA_LEFT) {
      // 玩家在 AI 左侧向左移，允许
    }
    clampedX = Phaser.Math.Clamp(clampedX, ARENA_LEFT, this.scale.width - ARENA_LEFT);
    p.body.setX(clampedX);

    // 格挡（按住 L）
    p.blocking = this.keyL.isDown && now >= p.cooldownUntil;

    // 出招（按下边沿触发）
    if (Phaser.Input.Keyboard.JustDown(this.keyJ)) this.tryMove(p, "light", now);
    else if (Phaser.Input.Keyboard.JustDown(this.keyK)) this.tryMove(p, "heavy", now);
    else if (Phaser.Input.Keyboard.JustDown(this.keyU)) this.tryMove(p, "special", now);
  }

  private tickAI(now: number) {
    const ai = this.ai;
    const p = this.player;
    if (now < ai.staggerUntil) {
      ai.blocking = false;
      return;
    }
    // AI 移动：朝玩家靠近，但保持攻击距离
    const dx = p.body.x - ai.body.x;
    const dist = Math.abs(dx);
    const idealRange = 84;
    let vx = 0;
    if (dist > idealRange + 10) vx = Math.sign(dx) * FIGHTER_SPEED * 0.8;
    else if (dist < idealRange - 20) vx = -Math.sign(dx) * FIGHTER_SPEED * 0.6;
    const nextX = ai.body.x + (vx * this.game.loop.delta) / 1000;
    ai.body.setX(Phaser.Math.Clamp(nextX, ARENA_LEFT, this.scale.width - ARENA_LEFT));

    // AI 决策：到下次决策时间且冷却好了，随机选招或格挡
    if (now < this.aiNextDecisionAt) {
      ai.blocking = false;
      return;
    }
    // 难度影响决策间隔：高难度更频繁
    const baseGap = 900 - this.aiDifficulty * 500; // 400..900ms
    this.aiNextDecisionAt = now + baseGap + Phaser.Math.Between(0, 200);

    // 玩家正在出招（冷却刚触发）时，高难度 AI 倾向格挡
    const playerAttacking = now < p.cooldownUntil && now > p.cooldownUntil - 260;
    const blockRoll = Math.random();
    const blockThreshold = 0.18 + this.aiDifficulty * 0.45; // 0.18..0.63
    if (playerAttacking && blockRoll < blockThreshold && dist < 120) {
      ai.blocking = true;
      ai.cooldownUntil = now + 320;
      return;
    }
    ai.blocking = false;

    // 在攻击距离内出招
    if (dist <= 100 && now >= ai.cooldownUntil) {
      const roll = Math.random();
      let pick: FightingMove;
      if (roll < 0.55) pick = "light";
      else if (roll < 0.82) pick = "heavy";
      else if (roll < 0.93) pick = "block";
      else pick = "special";
      this.tryMove(ai, pick, now);
    }
  }

  private tickFacing() {
    // 双方始终面向对方
    this.player.facing = this.ai.body.x >= this.player.body.x ? 1 : -1;
    this.ai.facing = this.player.body.x >= this.ai.body.x ? -1 : 1;
  }

  /** 试图出招：若冷却未好则忽略；格挡单独处理；攻击招式触发命中判定 */
  private tryMove(fighter: Fighter, moveKey: FightingMove, now: number) {
    if (!this.moves.includes(moveKey)) return;
    if (now < fighter.cooldownUntil) return;
    if (fighter.blocking) return;
    const def = MOVE_TABLE[moveKey];
    fighter.cooldownUntil = now + def.cooldownMs;

    if (def.key === "block") {
      fighter.blocking = true;
      this.fxBlock(fighter);
      return;
    }

    // 攻击视觉：闪现一道白条
    this.fxAttack(fighter, def);
    playBleep(def.key === "heavy" || def.key === "special" ? "hit" : "pickup");

    // 命中判定：对手在攻击范围内 + 在前方
    const target = fighter === this.player ? this.ai : this.player;
    const dx = (target.body.x - fighter.body.x) * fighter.facing; // 正=前方
    const dist = Math.abs(target.body.x - fighter.body.x);
    if (dx >= 0 && dist <= def.range) {
      this.applyHit(target, def, now, fighter);
    }
  }

  private applyHit(target: Fighter, def: MoveDef, now: number, attacker: Fighter) {
    // 格挡减伤 70%
    let dmg = def.damage;
    if (target.blocking) {
      dmg = Math.round(dmg * 0.3);
      this.fxBlock(target);
    }
    target.hp = Math.max(0, target.hp - dmg);
    target.flashUntil = now + def.flashMs;
    target.staggerUntil = now + Math.min(420, def.flashMs + 120);

    // 击退（朝 target.facing 反方向，即被打退）
    const dir = attacker.facing; // 攻击者朝向 = 被击退方向
    const knockX = target.body.x + dir * def.knockback;
    this.tweens.add({
      targets: target.body,
      x: Phaser.Math.Clamp(knockX, ARENA_LEFT, this.scale.width - ARENA_LEFT),
      duration: 160,
      ease: "Quad.Out",
    });

    // 视觉/音效
    juiceHit(this, {
      x: target.body.x,
      y: target.body.y,
      colorHex: this.spec.theme.hazardColor,
      large: def.key === "heavy" || def.key === "special",
    });
    juiceBurst(this, target.body.x, target.body.y, themeParticleHex(this.spec), def.key === "special" ? 16 : 10);
    spawnDamageNumber(this, target.body.x, target.body.y - 40, dmg, {
      color: target.blocking ? "#94a3b8" : "#ff6644",
      large: def.key === "special",
    });
    this.cameras.main.shake(def.key === "special" ? 240 : 120, def.key === "special" ? 0.01 : 0.005);
    playBleep("hit");
  }

  private fxAttack(fighter: Fighter, def: MoveDef) {
    const fx = fighter.hitFx;
    const w = def.range * 0.6;
    const h = FIGHTER_H * 0.5;
    fx.setSize(w, h);
    fx.setPosition(fighter.body.x + fighter.facing * (FIGHTER_W / 2 + w / 2), fighter.body.y);
    fx.setFillStyle(0xffffff, 0.85);
    this.tweens.add({
      targets: fx,
      alpha: { from: 0.85, to: 0 },
      duration: 160,
      ease: "Quad.Out",
      onComplete: () => {
        fx.setSize(0, 0);
        fx.setAlpha(0);
      },
    });
  }

  private fxBlock(fighter: Fighter) {
    const fx = fighter.hitFx;
    fx.setSize(FIGHTER_W * 1.1, FIGHTER_H * 1.1);
    fx.setPosition(fighter.body.x, fighter.body.y);
    fx.setFillStyle(0xfde047, 0.35);
    this.tweens.add({
      targets: fx,
      alpha: { from: 0.35, to: 0 },
      duration: 200,
      ease: "Quad.Out",
      onComplete: () => {
        fx.setSize(0, 0);
        fx.setAlpha(0);
      },
    });
  }

  private applyFlash(f: Fighter, now: number) {
    if (now < f.flashUntil) {
      f.body.setFillStyle(0xffffff, 1);
    } else {
      const baseColor = f === this.player ? PLAYER_COLOR : AI_COLOR;
      f.body.setFillStyle(baseColor, 1);
    }
  }

  private checkRoundOutcome(now: number) {
    if (this.player.hp <= 0 || this.ai.hp <= 0) {
      const playerWon = this.ai.hp <= 0 && this.player.hp > 0;
      const aiWon = this.player.hp <= 0 && this.ai.hp > 0;
      // 同帧双倒：算平局，重打本回合
      if (this.player.hp <= 0 && this.ai.hp <= 0) {
        this.hud.flashBanner({
          title: this.uiLocale === "zh-Hans" ? "双倒！重打" : "Double KO! Retry",
          ms: ROUND_END_MS,
        });
        this.phase = "roundEnd";
        this.phaseUntil = now + ROUND_END_MS;
        return;
      }
      if (playerWon) this.playerWins += 1;
      else if (aiWon) this.aiWins += 1;

      this.phase = "roundEnd";
      this.phaseUntil = now + ROUND_END_MS;
      const title = playerWon
        ? this.uiLocale === "zh-Hans" ? "本回合胜！" : "Round Won!"
        : this.uiLocale === "zh-Hans" ? "本回合负" : "Round Lost";
      this.hud.flashBanner({ title, ms: ROUND_END_MS });
      if (playerWon) playBleep("win");
      else playBleep("hit");
      this.refreshHud();
    }
  }

  private refreshHud() {
    const p = this.player;
    const a = this.ai;
    const left = hudFightingHp(this.uiLocale, Math.max(0, Math.round(p.hp)), Math.max(0, Math.round(a.hp)));
    const right = hudFightingRound(this.uiLocale, this.roundIndex + 1, this.roundsTotal, this.playerWins, this.aiWins);
    this.hud.update({
      score: this.playerWins,
      lives: Math.max(0, Math.ceil(p.hp / 10)),
      right,
      actLabel: left,
    });
    setPhaserQaState({
      roundIndex: this.roundIndex,
      playerWins: this.playerWins,
      aiWins: this.aiWins,
      playerHp: Math.round(p.hp),
      aiHp: Math.round(a.hp),
    });
  }

  private endMatch() {
    const won = this.playerWins >= this.aiWins;
    this.matchScore = this.playerWins * 100;
    this.phase = "matchEnd";
    this.hud.update({ dangerLevel: 0 });
    this.finished = true;
    if (won) {
      const winBanner = bannerFightingWin(this.uiLocale);
      this.hud.setBottomHint(`${winBanner.title} ${this.playerWins}-${this.aiWins}`);
      this.cameras.main.shake(300, 0.008);
      juiceWin(this, {
        x: this.player.body.x,
        y: this.player.body.y,
        colorHex: themeParticleHex(this.spec),
        text: winBanner.title,
        textColorCss: this.cohesive.hud.accent,
      });
      playBleep("win");
      this.soundscape?.triggerEvent("victory");
    } else {
      this.hud.setBottomHint(
        this.uiLocale === "zh-Hans"
          ? `比赛失败 ${this.playerWins}-${this.aiWins}`
          : `Match Lost ${this.playerWins}-${this.aiWins}`,
      );
      juiceFail(this, {
        x: this.player.body.x,
        y: this.player.body.y,
        colorHex: this.spec.theme.hazardColor,
        text: this.uiLocale === "zh-Hans" ? "失败" : "Fail",
        textColorCss: this.cohesive.hud.danger,
      });
      this.soundscape?.triggerEvent("danger");
    }
    this.onEnd({ score: this.matchScore, won });
  }
}
