import type { QaFinding } from "./types";

type Actor = { kind?: string; x: number; y: number; visible: boolean };
export type PlayerEvidenceEvent = { type: string; inputActive?: boolean; players?: Actor[]; sprites?: Actor[] };

/** Draw observations, independent of score/collision counters. Pixel review is still required. */
export function playerEvidenceFindings(design: unknown, events: PlayerEvidenceEvent[]): QaFinding[] {
  if (!design || typeof design !== "object") return [];
  const doc = design as { assets?: Array<{ kind?: string }>; controls?: Array<{ action?: string; desktop?: string }> };
  if (!Array.isArray(doc.assets) || !doc.assets.some(asset => asset?.kind === "player")) return [];
  const samples = events.filter(event => event.type === "forge-player-evidence");
  const visible = samples.flatMap(event => event.players ?? []).filter(actor => actor.visible);
  if (!visible.length) return [{ severity: "blocker", moduleId: "assembled", code: "player_not_visible", message: "No player sprite was drawn inside the viewport. Check camera centre, spawn coordinates and draw calls." }];
  const movementRequired = Array.isArray(doc.controls) && doc.controls.some(control => /移动|左右|方向键|摇杆|move|arrow|wasd|stick/i.test(`${control?.action} ${control?.desktop}`));
  const active = samples.filter(event => event.inputActive).flatMap(event => event.players ?? []).filter(actor => actor.visible);
  const moved = active.some((actor, i) => i > 0 && Math.hypot(actor.x - active[i - 1]!.x, actor.y - active[i - 1]!.y) > 4);
  if (movementRequired && !moved) return [{ severity: "blocker", moduleId: "assembled", code: "player_input_no_visible_response", message: "Held movement input did not move the rendered player. Init, movement, collision and draw must share G.player = g.world.spawn('player', ...); do not move a detached object." }];
  const findings: QaFinding[] = [];
  const collectibleRequired = doc.assets.some(asset => asset?.kind === "collectible");
  const visibleCollectible = samples.flatMap(event => event.sprites ?? []).some(sprite => sprite.kind === "collectible" && sprite.visible);
  if (collectibleRequired && !visibleCollectible) findings.push({ severity: "blocker", moduleId: "assembled", code: "collectible_not_visible", message: "No collectible sprite appeared in the viewport. Spawn, update, draw and collision must iterate the same authoritative entities (prefer g.world); do not render a detached private array." });
  return findings;
}
