import type { AgenticGameModule } from "@/lib/agentic/game-module";
import type { GameSpec } from "@/lib/game-spec";
import { requiresBespokeRuntime } from "@/lib/game-runtime-policy";

export type AgenticVisualContract = {
  required: boolean;
  ok: boolean;
  blockers: string[];
  evidence: string[];
};

/**
 * A bespoke game must visibly consume the project asset pack. This does not
 * measure taste, but it prevents the old failure mode: a generated module that
 * technically runs while rendering only circles and rectangles.
 */
export function evaluateAgenticVisualContract(spec: GameSpec, module?: AgenticGameModule | null): AgenticVisualContract {
  const required = requiresBespokeRuntime(spec);
  if (!required) return { required: false, ok: true, blockers: [], evidence: ["visual_contract:not_required"] };
  const source = module?.source ?? "";
  const usesBackground = /assets\?\.(?:backgroundKey)|assets\s*&&\s*ctx\.assets\.backgroundKey/.test(source);
  const usesPlayer = /assets\?\.(?:playerKey)|assets\s*&&\s*ctx\.assets\.playerKey/.test(source);
  const usesEnemy = /assets\?\.(?:enemyKey)|assets\s*&&\s*ctx\.assets\.enemyKey/.test(source);
  const usesImageActor = /scene\.add\.(?:image|sprite)\s*\(/.test(source);
  const blockers = [
    ...(usesBackground ? [] : ["runtime_background_asset_unused"]),
    ...(usesPlayer ? [] : ["runtime_player_asset_unused"]),
    ...(usesEnemy ? [] : ["runtime_enemy_asset_unused"]),
    ...(usesImageActor ? [] : ["runtime_sprite_actor_missing"]),
  ];
  return {
    required,
    ok: blockers.length === 0,
    blockers,
    evidence: [
      `background_asset:${usesBackground ? "used" : "missing"}`,
      `player_asset:${usesPlayer ? "used" : "missing"}`,
      `enemy_asset:${usesEnemy ? "used" : "missing"}`,
      `sprite_actor:${usesImageActor ? "used" : "missing"}`,
    ],
  };
}
