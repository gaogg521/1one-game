import type { GameSpec } from "@/lib/game-spec";
import { resolveTemplateRuntime } from "@/lib/game-templates/registry";

/**
 * Delivery policy kept outside the Phaser factory so routing, generation and
 * publication agree on the same rule without importing a browser runtime.
 */
export function requiresBespokeRuntime(spec: Pick<GameSpec, "templateId">): boolean {
  return resolveTemplateRuntime(spec.templateId).phaser === "arena";
}

export function hasBespokeRuntime(spec: Pick<GameSpec, "templateId" | "agenticPlayRoute" | "agenticModule" | "samplePlayProfile">): boolean {
  const showcase = spec.samplePlayProfile?.showcaseRuntime;
  const independentShowcase = showcase === "voxel-frontier" || showcase === "territory-loop" || showcase === "estate-merge";
  return independentShowcase || !requiresBespokeRuntime(spec) || (
    spec.agenticPlayRoute === "agentic" &&
    Boolean(spec.agenticModule?.source?.trim())
  );
}
