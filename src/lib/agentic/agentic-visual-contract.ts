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
  /*
   * A Forge design names its own asset keys -- the design prompt asks for
   * subject-specific ones like `ship_blue` and `meteor_red`. Looking only for
   * the literal `ctx.assets.player` therefore reported all three slots unused
   * against builds that were drawing their artwork correctly, and those false
   * findings then spent a real repair round telling the agent to use art it was
   * already using. Ask the design which key stands for each kind.
   */
  const designAssets = (() => {
    const raw = (spec.forgeBuild as { design?: { assets?: Array<{ key?: unknown; kind?: unknown }> } } | undefined)?.design?.assets;
    return Array.isArray(raw) ? raw : [];
  })();
  const keysFor = (kind: string, fallback: string): string[] => {
    const keys = designAssets
      .filter((slot) => slot?.kind === kind && typeof slot.key === "string" && slot.key)
      .map((slot) => String(slot.key));
    return keys.length ? keys : [fallback];
  };
  const referencesAny = (keys: string[]): boolean =>
    keys.some((key) => new RegExp(`assets\\s*\\.\\s*${key.replace(/[^\w]/g, "\\$&")}\\b`).test(source));

  const usesBackground = referencesAny(keysFor("background", "background"));
  const usesPlayer = referencesAny(keysFor("player", "player"));
  // An "enemy" slot is optional by genre; a build with no hazard art declared
  // cannot be faulted for not drawing it.
  const enemyKeys = designAssets.some((slot) => slot?.kind === "enemy") ? keysFor("enemy", "enemy") : [];
  const usesEnemy = enemyKeys.length === 0 || referencesAny(enemyKeys);
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
