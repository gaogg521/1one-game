import type { GameSpec } from "@/lib/game-spec";

/** The independent runtime is the only supported play route. */
export type OpenGameAgenticRouteMode = "independent";
export type ResolveAgenticPlayRouteOptions = {
  prompt: string;
  spec: GameSpec;
};

export type AgenticPlayRoute = "independent";
export function readOpenGameAgenticRouteMode(): OpenGameAgenticRouteMode {
  return "independent";
}
export function resolveAgenticPlayRoute(_prompt: string, _spec: GameSpec) { return "independent" as const; }
export function shouldUseDedicatedSceneForTemplateFirst() { return false; }
export function stampAgenticPlayRoute(_prompt: string, spec: GameSpec) { return { ...spec, agenticPlayRoute: "independent" as const }; }
export function stripAgenticModuleForDedicatedRoute(spec: GameSpec) { const { agenticModule: _ignored, ...rest } = spec; return { ...rest, agenticPlayRoute: "independent" as const }; }
