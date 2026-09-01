import type { GameSpec } from "@/lib/game-spec";
/** Migrates persisted records to the only supported play surface. */
export function normalizeAstrocadePlaySpec(spec: GameSpec): GameSpec {
  return { ...spec, agenticPlayRoute: "independent" };
}
