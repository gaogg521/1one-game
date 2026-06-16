import type { GameSpec } from "@/lib/game-spec";
import { GameSpecSchema } from "@/lib/game-spec";

export type LintResult = { ok: true } | { ok: false; issues: string[] };

/**
 * Phase 1：Schema + 运行时语义校验（独立于 LLM coerce，用于发布后二次把关）。
 */
export function lintGameSpecForOrchestration(spec: GameSpec): LintResult {
  const structural = GameSpecSchema.safeParse(spec);
  if (!structural.success) {
    const issues = structural.error.issues.map(
      (i) => `${i.path.length ? i.path.join(".") : "root"}: ${i.message}`,
    );
    return { ok: false, issues };
  }

  const issues: string[] = [];
  const theme = spec.theme;
  const rgb = (hex: string): [number, number, number] | null => {
    const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
    if (!m) return null;
    const n = Number.parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const dist = (a: string, b: string): number => {
    const A = rgb(a);
    const B = rgb(b);
    if (!A || !B) return 0;
    return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
  };

  if (dist(theme.backgroundColor, theme.playerColor) < 42) {
    issues.push("theme.playerColor: 与背景对比过低，需要更可读的角色色");
  }
  if (dist(theme.backgroundColor, theme.hazardColor) < 42) {
    issues.push("theme.hazardColor: 与背景对比过低，需要更醒目的危险色");
  }
  if (dist(theme.playerColor, theme.hazardColor) < 30) {
    issues.push("theme.playerColor/hazardColor: 角色与威胁色过近，画面辨识度不足");
  }
  if (!spec.theme.collectibleColor) {
    issues.push("theme.collectibleColor: 缺少收集物色，视觉层次不足");
  }
  if (!spec.theme.particleTint) {
    issues.push("theme.particleTint: 缺少粒子色，打击反馈会显得单薄");
  }

  const td = spec.towerDefense;
  if (spec.templateId === "towerDefense" && td) {
    const enemyIds = new Set(td.enemies.map((e) => e.id));
    const towerIds = new Set(td.towers.map((t) => t.id));
    if (td.path.length < 2) issues.push("towerDefense.path: 至少需要 2 个点");
    if (td.waves.length < 1) issues.push("towerDefense.waves: 至少一波");
    if (towerIds.size !== td.towers.length) issues.push("towerDefense.towers: id 重复");
    if (enemyIds.size !== td.enemies.length) issues.push("towerDefense.enemies: id 重复");
    for (let wi = 0; wi < td.waves.length; wi += 1) {
      const w = td.waves[wi]!;
      for (let si = 0; si < w.spawns.length; si += 1) {
        const sp = w.spawns[si]!;
        if (!enemyIds.has(sp.enemyId)) {
          issues.push(`towerDefense.waves[${wi}].spawns[${si}]: enemyId「${sp.enemyId}」不在 enemies 表`);
        }
      }
    }
  }

  if (spec.director?.events?.length) {
    for (let i = 0; i < spec.director.events.length; i += 1) {
      const ev = spec.director.events[i];
      const at = ev?.at;
      if (typeof at === "number" && (at < 0 || at > 1)) {
        issues.push(`director.events[${i}].at 应在 0..1`);
      }
    }
  }

  if (!spec.director) {
    issues.push("director: 缺少关卡节奏与事件编排");
  } else {
    if (spec.director.acts.length < 4) {
      issues.push("director.acts: 建议至少 4 幕，保证阶段变化");
    }
    if (!spec.director.events || spec.director.events.length < 2) {
      issues.push("director.events: 事件太少，关卡节奏偏平");
    }
  }

  if (!spec.systems) {
    issues.push("systems: 缺少技能/道具系统，游戏爽感偏弱");
  }

  const floors: Record<string, { winScore?: number; lives?: number; spawnIntervalMs?: number }> = {
    shooter: { winScore: 50, lives: 3, spawnIntervalMs: 900 },
    platformer: { winScore: 42, lives: 3, spawnIntervalMs: 640 },
    towerDefense: { winScore: 9, spawnIntervalMs: 420 },
    collector: { winScore: 36, lives: 3, spawnIntervalMs: 520 },
    survivor: { winScore: 50, lives: 3, spawnIntervalMs: 520 },
    avoider: { winScore: 50, lives: 1, spawnIntervalMs: 520 },
    coaster: { winScore: 100, lives: 3, spawnIntervalMs: 640 },
    puzzle: { winScore: 20, lives: 3, spawnIntervalMs: 760 },
    customization: { winScore: 18, lives: 3, spawnIntervalMs: 760 },
    strategy: { winScore: 16, lives: 3, spawnIntervalMs: 700 },
    farming: { winScore: 24, lives: 3, spawnIntervalMs: 760 },
    chess: { winScore: 1, lives: 1, spawnIntervalMs: 900 },
    physics: { winScore: 18, lives: 3, spawnIntervalMs: 760 },
  };
  const floor = floors[spec.templateId];
  if (floor) {
    if (typeof floor.winScore === "number" && (spec.gameplay.winScore ?? 0) < floor.winScore) {
      issues.push(`gameplay.winScore: 过低，建议至少 ${floor.winScore}`);
    }
    if (typeof floor.lives === "number" && (spec.gameplay.lives ?? 0) < floor.lives) {
      issues.push(`gameplay.lives: 过低，建议至少 ${floor.lives}`);
    }
    if (typeof floor.spawnIntervalMs === "number" && spec.gameplay.spawnIntervalMs < floor.spawnIntervalMs) {
      issues.push(`gameplay.spawnIntervalMs: 过密，建议至少 ${floor.spawnIntervalMs}`);
    }
  }

  return issues.length ? { ok: false, issues } : { ok: true };
}
