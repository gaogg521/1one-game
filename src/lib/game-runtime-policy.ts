import type { GameSpec } from "@/lib/game-spec";

/**
 * Every deliverable must carry a game-specific independent browser runtime.
 */
export function requiresBespokeRuntime(_spec: Pick<GameSpec, "templateId">): boolean {
  return true;
}

export function hasBespokeRuntime(spec: Pick<GameSpec, "templateId" | "agenticPlayRoute" | "agenticModule" | "samplePlayProfile">): boolean {
  return Boolean(spec.agenticModule?.source?.trim());
}
