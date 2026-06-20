import Phaser from "phaser";
import type {
  ShooterBlueprint,
  ShooterBulletPattern,
  ShooterFormationPattern,
  ShooterWave,
} from "@/lib/shooter-blueprint";

/**
 * Shooter Runtime：把 LLM 输出的 ShooterBlueprint 数据真正接通运行时。
 *
 * 三组纯函数 + 一个 BossController：
 *   1. spawnFormationFromPattern：按编队脚本计算敌人初始位置 / 行进路径
 *   2. emitEnemyBulletsByPattern：按弹幕图样从 origin 发射子弹
 *   3. emitPlayerBulletsByWeapon：按武器树类型生成玩家子弹
 *   4. BossController：管理 Boss 多阶段（HP 阈值 / motion / 当前 bullet pattern）
 *
 * Scene 调用方仅传 callbacks（spawnEnemy / spawnBullet），具体物理由 Scene 完成。
 */

export type SpawnEnemyParams = {
  x: number;
  y: number;
  hp: number;
  elite: boolean;
  /** 行进风格：决定 Scene 的 update 阶段如何移动 */
  motion: "descend" | "swoop-left" | "swoop-right" | "orbit-center" | "zigzag" | "tail" | "boss-arena";
  /** 行进初始相位 */
  motionPhase: number;
};

export type SpawnEnemyBulletParams = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export type SpawnPlayerBulletParams = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** rotation in radians (用于斜射子弹的视觉旋转) */
  rotation: number;
};

export type FormationCtx = {
  width: number;
  /** 关卡时间线 0..1 进度（用于计算难度调制） */
  progress: number;
  rng: () => number;
};

/**
 * 按编队脚本生成敌人初始位置。返回数组让 Scene 自己 spawn。
 */
export function spawnFormationFromPattern(
  pattern: ShooterFormationPattern,
  wave: ShooterWave,
  ctx: FormationCtx,
): SpawnEnemyParams[] {
  const out: SpawnEnemyParams[] = [];
  const { width, rng } = ctx;
  const baseHp = Math.max(1, Math.round((wave.elite ? 2 : 1) * wave.hpMul));

  switch (pattern) {
    case "v-formation": {
      // V 字编队：从中央向两侧扩散
      const apex = width / 2;
      for (let i = 0; i < wave.count; i += 1) {
        const half = Math.floor(wave.count / 2);
        const k = i - half;
        const x = apex + k * 56;
        const y = -60 + Math.abs(k) * 36;
        out.push({
          x,
          y,
          hp: baseHp,
          elite: Boolean(wave.elite),
          motion: "descend",
          motionPhase: rng() * Math.PI * 2,
        });
      }
      return out;
    }
    case "side-swoop": {
      // 从左右两侧轮流入场
      for (let i = 0; i < wave.count; i += 1) {
        const fromLeft = i % 2 === 0;
        const x = fromLeft ? -40 : width + 40;
        const y = 60 + (i % 4) * 36;
        out.push({
          x,
          y,
          hp: baseHp,
          elite: Boolean(wave.elite),
          motion: fromLeft ? "swoop-left" : "swoop-right",
          motionPhase: rng() * Math.PI * 2,
        });
      }
      return out;
    }
    case "circle-swarm": {
      // 圆形蜂群：在屏幕上方一段圆弧上排开
      const cx = width / 2;
      const cy = -20;
      const r = Math.min(width * 0.42, 260);
      for (let i = 0; i < wave.count; i += 1) {
        const a = -Math.PI * 0.5 + ((i + 0.5) / wave.count - 0.5) * Math.PI * 0.9;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r + 80;
        out.push({
          x,
          y,
          hp: baseHp,
          elite: Boolean(wave.elite),
          motion: "orbit-center",
          motionPhase: a,
        });
      }
      return out;
    }
    case "wave-grid": {
      // 经典横向网格（小蜜蜂）
      const cols = Math.min(8, Math.max(3, wave.count));
      const rows = Math.max(1, Math.ceil(wave.count / cols));
      const cellW = Math.min(72, (width - 80) / cols);
      const startX = (width - cellW * (cols - 1)) / 2;
      let placed = 0;
      for (let row = 0; row < rows && placed < wave.count; row += 1) {
        for (let col = 0; col < cols && placed < wave.count; col += 1) {
          const x = startX + col * cellW;
          const y = -40 - row * 48;
          out.push({
            x,
            y,
            hp: baseHp,
            elite: Boolean(wave.elite),
            motion: "descend",
            motionPhase: rng() * Math.PI * 2,
          });
          placed += 1;
        }
      }
      return out;
    }
    case "diagonal-strafe": {
      // 一字斜线，从右上斜扫到左下（或反之）
      const fromRight = rng() > 0.5;
      for (let i = 0; i < wave.count; i += 1) {
        const t = i / Math.max(1, wave.count - 1);
        const x = fromRight ? width + 30 - t * 30 : -30 + t * 30;
        const y = -60 - i * 32;
        out.push({
          x,
          y,
          hp: baseHp,
          elite: Boolean(wave.elite),
          motion: fromRight ? "swoop-right" : "swoop-left",
          motionPhase: i * 0.3,
        });
      }
      return out;
    }
    case "tail-chase": {
      // 长蛇阵：单列纵深，前后跟随
      const x = width * (0.3 + rng() * 0.4);
      for (let i = 0; i < wave.count; i += 1) {
        out.push({
          x,
          y: -40 - i * 38,
          hp: baseHp,
          elite: Boolean(wave.elite),
          motion: "tail",
          motionPhase: i * 0.18,
        });
      }
      return out;
    }
    case "burst-spawn": {
      // 集中一团生成（弹幕用）
      const cx = width / 2;
      for (let i = 0; i < wave.count; i += 1) {
        const a = (i / wave.count) * Math.PI * 2;
        const r = 60 + rng() * 30;
        out.push({
          x: cx + Math.cos(a) * r,
          y: -30 + Math.sin(a) * r,
          hp: baseHp,
          elite: Boolean(wave.elite),
          motion: "zigzag",
          motionPhase: a,
        });
      }
      return out;
    }
    case "boss-arena":
    default:
      // Boss 战由专用路径处理；这里不产出小怪
      return [];
  }
}

/**
 * 按弹幕图样发射敌方子弹。
 * 返回 SpawnEnemyBulletParams[] 让 Scene 一次性 spawn 出来。
 */
export function emitEnemyBulletsByPattern(
  pattern: ShooterBulletPattern,
  origin: { x: number; y: number },
  /** 目标方向（玩家位置） */
  target: { x: number; y: number },
  baseSpeed: number,
  rng: () => number,
): SpawnEnemyBulletParams[] {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const dist = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / dist;
  const uy = dy / dist;
  const out: SpawnEnemyBulletParams[] = [];

  const push = (vx: number, vy: number) => {
    out.push({ x: origin.x, y: origin.y + 12, vx, vy });
  };

  switch (pattern) {
    case "single": {
      push(0, baseSpeed);
      return out;
    }
    case "aimed-volley": {
      // 朝玩家 3 连
      for (let i = 0; i < 3; i += 1) {
        push(ux * baseSpeed + (rng() - 0.5) * 40, uy * baseSpeed + (rng() - 0.5) * 40);
      }
      return out;
    }
    case "spread-3": {
      const a0 = Math.atan2(uy, ux);
      for (const a of [a0 - 0.22, a0, a0 + 0.22]) {
        push(Math.cos(a) * baseSpeed, Math.sin(a) * baseSpeed);
      }
      return out;
    }
    case "spread-5": {
      const a0 = Math.atan2(uy, ux);
      for (const a of [a0 - 0.32, a0 - 0.16, a0, a0 + 0.16, a0 + 0.32]) {
        push(Math.cos(a) * baseSpeed, Math.sin(a) * baseSpeed);
      }
      return out;
    }
    case "fan-7": {
      const a0 = Math.PI / 2; // 朝下扇形
      for (let i = -3; i <= 3; i += 1) {
        const a = a0 + i * 0.22;
        push(Math.cos(a) * baseSpeed * 0.92, Math.sin(a) * baseSpeed * 0.92);
      }
      return out;
    }
    case "shotgun": {
      for (let i = 0; i < 8; i += 1) {
        const a = Math.atan2(uy, ux) + (rng() - 0.5) * 0.7;
        const speed = baseSpeed * (0.85 + rng() * 0.3);
        push(Math.cos(a) * speed, Math.sin(a) * speed);
      }
      return out;
    }
    case "ring": {
      for (let i = 0; i < 12; i += 1) {
        const a = (i / 12) * Math.PI * 2;
        push(Math.cos(a) * baseSpeed * 0.8, Math.sin(a) * baseSpeed * 0.8);
      }
      return out;
    }
    case "spiral": {
      // 螺旋点：调用方多次调用每次推进一个相位
      const phase = rng() * Math.PI * 2;
      for (let i = 0; i < 6; i += 1) {
        const a = phase + (i / 6) * Math.PI * 2;
        push(Math.cos(a) * baseSpeed * 0.78, Math.sin(a) * baseSpeed * 0.78);
      }
      return out;
    }
    case "laser-beam": {
      // 一连串高速直线子弹形成激光感
      for (let i = 0; i < 4; i += 1) {
        push(ux * baseSpeed * 2.6, uy * baseSpeed * 2.6);
      }
      return out;
    }
  }
}

/**
 * 按武器树类型发射玩家子弹。返回方向数组让 Scene spawn。
 */
export function emitPlayerBulletsByWeapon(
  weapon: ShooterBulletPattern,
  origin: { x: number; y: number },
  baseSpeed: number,
): SpawnPlayerBulletParams[] {
  const out: SpawnPlayerBulletParams[] = [];
  const push = (vx: number, vy: number, rot: number) => {
    out.push({ x: origin.x, y: origin.y - 20, vx, vy, rotation: rot });
  };
  // 玩家子弹通常向上（-y）
  const up = -baseSpeed;

  switch (weapon) {
    case "single":
      push(0, up, 0);
      return out;
    case "spread-3":
      push(-baseSpeed * 0.22, up, -0.22);
      push(0, up, 0);
      push(baseSpeed * 0.22, up, 0.22);
      return out;
    case "spread-5":
      for (const k of [-2, -1, 0, 1, 2]) {
        const a = (k / 2) * 0.32;
        push(baseSpeed * Math.sin(a), up * Math.cos(a), a);
      }
      return out;
    case "fan-7":
      for (const k of [-3, -2, -1, 0, 1, 2, 3]) {
        const a = (k / 3) * 0.42;
        push(baseSpeed * Math.sin(a), up * Math.cos(a), a);
      }
      return out;
    case "shotgun":
      for (let i = 0; i < 8; i += 1) {
        const a = (Math.random() - 0.5) * 0.7;
        const sp = baseSpeed * (0.85 + Math.random() * 0.3);
        push(sp * Math.sin(a), -sp * Math.cos(a), a);
      }
      return out;
    case "ring":
      // 玩家版的"清屏环"：8 个方向少量子弹
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        push(Math.cos(a) * baseSpeed * 0.7, Math.sin(a) * baseSpeed * 0.7, a);
      }
      return out;
    case "spiral":
      // 一个螺旋点
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        push(Math.cos(a) * baseSpeed * 0.65, Math.sin(a) * baseSpeed * 0.65, a);
      }
      return out;
    case "laser-beam":
      // 高速 4 发紧密直线
      for (let i = 0; i < 4; i += 1) {
        push(0, up * 1.5, 0);
      }
      return out;
    case "aimed-volley":
    default:
      push(0, up, 0);
      return out;
  }
}

/**
 * Boss 控制器。管理多阶段切换。Scene 持有一个实例。
 */
export class BossController {
  private currentPhaseIndex = 0;
  private hp: number;
  private readonly maxHp: number;
  private nextFireAt = 0;

  constructor(
    private readonly blueprint: ShooterBlueprint["boss"],
    private readonly waveNum: number,
  ) {
    this.maxHp = Math.round(blueprint.baseHp * (1 + waveNum * 0.15));
    this.hp = this.maxHp;
  }

  getHpRatio(): number {
    return Math.max(0, this.hp / this.maxHp);
  }

  getHp(): number {
    return this.hp;
  }

  getMaxHp(): number {
    return this.maxHp;
  }

  /** 当前阶段定义 */
  getPhase() {
    return this.blueprint.phases[this.currentPhaseIndex]!;
  }

  /** 受到伤害；若跨越下一阶段 HP 阈值则切换阶段，返回 phaseChanged */
  takeDamage(dmg: number): { phaseChanged: boolean; killed: boolean } {
    this.hp = Math.max(0, this.hp - dmg);
    if (this.hp <= 0) return { phaseChanged: false, killed: true };
    const ratio = this.getHpRatio();
    let next = this.currentPhaseIndex;
    for (let i = 0; i < this.blueprint.phases.length; i += 1) {
      if (ratio <= this.blueprint.phases[i]!.hpThreshold) next = i;
    }
    if (next > this.currentPhaseIndex) {
      this.currentPhaseIndex = next;
      this.nextFireAt = 0;
      return { phaseChanged: true, killed: false };
    }
    return { phaseChanged: false, killed: false };
  }

  /** Scene update 调用：根据当前 phase.motion 计算 boss 的位移偏移量 */
  computeMotion(time: number, anchorX: number): { x: number; y: number } {
    const phase = this.getPhase();
    switch (phase.motion) {
      case "horizontal-swing":
        return { x: anchorX + Math.sin(time * 0.0014) * 180, y: 140 };
      case "figure-eight":
        return {
          x: anchorX + Math.sin(time * 0.0018) * 200,
          y: 140 + Math.sin(time * 0.0036) * 60,
        };
      case "spiral-down":
        return {
          x: anchorX + Math.cos(time * 0.0022) * 160,
          y: 100 + ((time * 0.04) % 200),
        };
      case "teleport-burst": {
        // 每 2 秒瞬移一次
        const slot = Math.floor(time / 2000);
        const hash = (slot * 9301 + 49297) % 233280;
        const x = anchorX - 200 + (hash / 233280) * 400;
        return { x, y: 140 };
      }
      case "still-rage":
      default:
        return { x: anchorX, y: 160 };
    }
  }

  isEnraged(): boolean {
    return this.getHpRatio() < 0.3;
  }

  /** 是否可以开火（Scene 每帧调用） */
  shouldFire(time: number): boolean {
    if (time < this.nextFireAt) return false;
    const phase = this.getPhase();
    const baseInterval = 900;
    const enrageMultiplier = this.isEnraged() ? 1.8 : 1;
    this.nextFireAt = time + baseInterval / Math.max(0.3, phase.intensity * enrageMultiplier);
    return true;
  }

  getCurrentBullet(): ShooterBulletPattern {
    return this.getPhase().bullet;
  }
}

/**
 * 决定玩家拾取道具后是否升级武器。
 * 拾取 spread-shot / laser-beam / wingman 都视为推进一格，至武器树末尾后保持最强。
 */
export function advanceWeaponTree(
  current: ShooterBulletPattern,
  tree: ShooterBulletPattern[],
): ShooterBulletPattern {
  const idx = tree.indexOf(current);
  if (idx < 0) return tree[1] ?? tree[0] ?? current;
  if (idx >= tree.length - 1) return current;
  return tree[idx + 1]!;
}

/** 给 spec.shooter 缺失时的最简兜底 */
export function fallbackShooterBlueprint(): ShooterBlueprint {
  return {
    waves: [
      { at: 0.1, pattern: "wave-grid", count: 6, hpMul: 1, speedMul: 1, bullet: "single" },
      { at: 0.4, pattern: "v-formation", count: 8, hpMul: 1.1, speedMul: 1.1, bullet: "spread-3" },
      { at: 0.7, pattern: "side-swoop", count: 10, hpMul: 1.2, speedMul: 1.2, bullet: "fan-7", elite: true },
      { at: 0.9, pattern: "boss-arena", count: 1, hpMul: 1, speedMul: 1, bullet: "spiral" },
    ],
    drops: ["spread-shot", "shield", "bomb"],
    boss: {
      label: "Boss",
      baseHp: 60,
      phases: [
        { hpThreshold: 1, label: "Phase 1", bullet: "aimed-volley", motion: "horizontal-swing", intensity: 0.85 },
        { hpThreshold: 0.5, label: "Phase 2", bullet: "spread-5", motion: "figure-eight", intensity: 1.1 },
        { hpThreshold: 0.25, label: "Phase 3", bullet: "spiral", motion: "still-rage", intensity: 1.5 },
      ],
    },
    startingWeapon: "single",
    weaponTree: ["single", "spread-3", "spread-5", "fan-7"],
  };
}

/**
 * 把 Scene 的"枪击 ⇒ 调用 BulletPattern"和"敌人 ⇒ motion update"两件事
 * 抽出为可在多个 Scene 共享的辅助。当前直接由 ShooterScene 使用。
 */
export function applyEnemyMotion(
  body: Phaser.Physics.Arcade.Body,
  motion: SpawnEnemyParams["motion"],
  motionPhase: number,
  time: number,
  baseSpeed: number,
  width: number,
): void {
  switch (motion) {
    case "descend":
      body.setVelocity(0, baseSpeed);
      return;
    case "swoop-left":
      body.setVelocity(baseSpeed * 0.55, baseSpeed * 0.7);
      return;
    case "swoop-right":
      body.setVelocity(-baseSpeed * 0.55, baseSpeed * 0.7);
      return;
    case "orbit-center": {
      const a = motionPhase + time * 0.0008;
      body.setVelocity(Math.cos(a) * baseSpeed * 0.6, baseSpeed * 0.5);
      return;
    }
    case "zigzag":
      body.setVelocity(Math.sin(time * 0.003 + motionPhase) * baseSpeed * 0.8, baseSpeed * 0.6);
      return;
    case "tail":
      body.setVelocity(Math.sin(time * 0.002 + motionPhase) * baseSpeed * 0.4, baseSpeed * 0.8);
      return;
    case "boss-arena":
    default:
      body.setVelocity(0, 0);
  }
}
