import type { GameSpec } from "@/lib/game-spec";
import { enrichGameSpecForRuntime } from "@/lib/enrich-game-spec";
import { coerceGameSpec } from "@/lib/normalize-spec";

/** 导出 Godot 前补全规格（与 Phaser 试玩共用 enrichGameSpecForRuntime） */
export function prepareSpecForGodotExport(spec: GameSpec, promptHint = ""): GameSpec {
  const coerced = coerceGameSpec(spec);
  if (!coerced.ok) {
    throw new Error(coerced.issues.join("; "));
  }
  return enrichGameSpecForRuntime(coerced.spec, promptHint);
}
