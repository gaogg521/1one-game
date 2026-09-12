import type { QaFinding } from "./types";

type Actor = { kind?: string; x: number; y: number; screenX?: number; screenY?: number; w?: number; h?: number; visible: boolean };

/**
 * The protagonist must occupy at least 9% of its own axis on screen. Measured
 * against the axis it is widest on, so the floor holds on any stage aspect
 * without needing the canvas pixel size here.
 */
const MIN_PLAYER_SCREEN_FRACTION = 0.09;
export type PlayerEvidenceEvent = { type: string; inputActive?: boolean; players?: Actor[]; sprites?: Actor[] };

/** Draw observations, independent of score/collision counters. Pixel review is still required. */
export function playerEvidenceFindings(design: unknown, events: PlayerEvidenceEvent[]): QaFinding[] {
  if (!design || typeof design !== "object") return [];
  const doc = design as {
    assets?: Array<{ kind?: string }>;
    controls?: Array<{ action?: string; desktop?: string; touch?: string }>;
    mechanics?: Array<{ id?: string; summary?: string }>;
  };
  if (!Array.isArray(doc.assets) || !doc.assets.some(asset => asset?.kind === "player")) return [];
  const samples = events.filter(event => event.type === "forge-player-evidence");
  const visible = samples.flatMap(event => event.players ?? []).filter(actor => actor.visible);
  /*
   * Not every game has a protagonist standing on the field at boot. In a
   * placement game -- a tower defence, a farm, a builder -- the "player" asset
   * is the thing you put down, and it does not exist until the player spends a
   * resource to place it. A probe that taps once in the first seconds will
   * never see one, so treating its absence as fatal made an entire genre
   * impossible to ship: measured on a plants-vs-zombies build that ran for ten
   * minutes and was rejected because no plant had been bought yet.
   */
  const placementControlled = [
    ...(doc.controls ?? []).map(control => `${control?.action} ${control?.desktop} ${control?.touch}`),
    ...(doc.mechanics ?? []).map(mechanic => `${mechanic?.id} ${mechanic?.summary}`),
  ].some(text => /种植|放置|建造|布置|召唤|部署|摆放|plant|place|build|deploy|summon|tower/i.test(text));
  if (!visible.length) {
    return [
      placementControlled
        ? { severity: "major", moduleId: "assembled", code: "player_not_placed_yet", message: "No player-kind sprite was drawn during the probe. This design places its units, so that may simply mean nothing was affordable yet — but confirm a unit can be placed and is drawn where it was placed." }
        : { severity: "blocker", moduleId: "assembled", code: "player_not_visible", message: "No player sprite was drawn inside the viewport. Check camera centre, spawn coordinates and draw calls." },
    ];
  }
  const movementRequired = Array.isArray(doc.controls) && doc.controls.some(control => /移动|左右|方向键|摇杆|move|arrow|wasd|stick/i.test(`${control?.action} ${control?.desktop}`));
  const active = samples.filter(event => event.inputActive).flatMap(event => event.players ?? []).filter(actor => actor.visible);
  const moved = active.some((actor, i) => i > 0 && Math.hypot(actor.x - active[i - 1]!.x, actor.y - active[i - 1]!.y) > 4);
  if (movementRequired && !moved) return [{ severity: "blocker", moduleId: "assembled", code: "player_input_no_visible_response", message: "Held movement input did not move the rendered player. Init, movement, collision and draw must share G.player = g.world.spawn('player', ...); do not move a detached object." }];
  const findings: QaFinding[] = [];
  const measured = visible.filter(actor => typeof actor.w === "number" && typeof actor.h === "number");
  if (measured.length >= 4) {
    const sizes = measured.map(actor => Math.max(actor.w!, actor.h!)).sort((a, b) => a - b);
    const median = sizes[Math.floor(sizes.length / 2)]!;
    if (median < MIN_PLAYER_SCREEN_FRACTION) {
      findings.push({
        severity: "major",
        moduleId: "assembled",
        code: "player_too_small",
        message: `The player was drawn at ${(median * 100).toFixed(1)}% of the screen, below the ${MIN_PLAYER_SCREEN_FRACTION * 100}% a phone player can track. Size the sprite from the live stage, e.g. Math.max(48, Math.min(g.width, g.height) * 0.09), not a fixed small number.`,
      });
    }
  }
  const collectibleRequired = doc.assets.some(asset => asset?.kind === "collectible");
  const collectibleSamples = samples.flatMap(event => event.sprites ?? []).filter(sprite => sprite.kind === "collectible");
  const visibleCollectible = collectibleSamples.some(sprite => sprite.visible);
  if (collectibleRequired && !visibleCollectible) findings.push({ severity: "blocker", moduleId: "assembled", code: "collectible_not_visible", message: "No collectible sprite appeared in the viewport. Spawn, update, draw and collision must iterate the same authoritative entities (prefer g.world); do not render a detached private array." });
  const positioned = collectibleSamples.filter(sprite => typeof sprite.screenX === "number");
  const horizontallyOutside = positioned.filter(sprite => sprite.screenX! < -0.05 || sprite.screenX! > 1.05);
  if (positioned.length >= 6 && horizontallyOutside.length / positioned.length >= 0.4) {
    findings.push({ severity: "blocker", moduleId: "assembled", code: "collectible_spawn_outside_viewport", message: "At least 40% of observed collectible draws were horizontally outside the viewport. Derive spawn bounds from g.width and the sprite radius; do not use a configured maximum larger than the live stage." });
  }
  return findings;
}
