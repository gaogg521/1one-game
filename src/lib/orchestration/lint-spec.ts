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

  return issues.length ? { ok: false, issues } : { ok: true };
}
