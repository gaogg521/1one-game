import type { GameSpec } from "@/lib/game-spec";
/** No secondary generic runtime is permitted. These compatibility helpers only serialize design data. */
export type GodotRuntimePayload = Record<string, unknown>;
export function buildGodotRuntimePayload(spec: GameSpec): GodotRuntimePayload { return { title: spec.title, design: spec }; }
export function specJsonForGodotExport(spec: GameSpec): Record<string, unknown> { return { title: spec.title, design: spec }; }
export function isGodotExportSupportedForTemplate(_id: string): boolean { return false; }
