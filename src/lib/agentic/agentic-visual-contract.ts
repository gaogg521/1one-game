import type { AgenticGameModule } from "@/lib/agentic/game-module";
import type { GameSpec } from "@/lib/game-spec";

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
  const required = true;
  const source = module?.source ?? "";
  const usesBackground = /ctx\.assets\.background/.test(source);
  const usesPlayer = /ctx\.assets\.player/.test(source);
  const usesEnemy = /ctx\.assets\.enemy/.test(source);
  /*
   * Two runtimes reach a textured actor by different APIs. The legacy agentic
   * module builds a DOM image itself; a Forge module cannot -- it loads through
   * `g.assets.image(url, ...)` and draws the returned holder with `r.sprite(...)`.
   * Matching only the DOM idiom reported `runtime_sprite_actor_missing` against
   * every correct Forge build, which is how a passing game still shipped with
   * `visualContract.ok=false`.
   */
  const usesImageActor =
    /(?:new\s+Image\s*\(|\.src\s*=|backgroundImage)/.test(source) ||
    /\bassets\s*\.\s*image\s*\(/.test(source) ||
    /\.\s*sprite\s*\(/.test(source);
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
      `image_actor:${usesImageActor ? "used" : "missing"}`,
    ],
  };
}
