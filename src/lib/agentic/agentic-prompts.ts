import type { GameSpec } from "@/lib/game-spec";
import { describeRequestedAgenticMechanics } from "@/lib/agentic/agentic-mechanics-contract";

export const AGENTIC_MODULE_JSON_SCHEMA = { name: "independent_game_runtime", strict: true, schema: { type: "object", additionalProperties: false, properties: { source: { type: "string", minLength: 80 }, entry: { type: "string", enum: ["mountGame"] } }, required: ["source", "entry"] } } as const;

export function buildAgenticSystemPrompt(): string {
  return `You are the runtime-code agent. Create one ORIGINAL, self-contained browser game for the supplied request.
Return JSON only: {"source":"...","entry":"mountGame"}. The source must define function mountGame(root, ctx). It runs inside a sandboxed iframe and must build its own DOM/CSS/Canvas, controls, game loop, collisions, scoring, win and loss states. It may use standard browser APIs only: DOM, Canvas 2D, requestAnimationFrame, timers, Math, Image and pointer/keyboard/touch events.
Use the supplied real artwork: ctx.assets.background as the scene background; ctx.assets.player for the primary playable character; ctx.assets.enemy and ctx.assets.collectible where those roles exist. Do not draw generic rectangles/circles as principal actors when asset URLs are supplied. Keep the scene composition, camera and mechanics specific to this exact request.
Call ctx.finish(true, score) for victory and ctx.finish(false, score) for loss. No libraries, imports, network requests, storage, eval, Function, workers, popups, or external assets. Never provide a template, placeholder, generic arena, or click-counter.`;
}

export function buildAgenticUserPrompt(prompt: string, spec: GameSpec): string {
  return [`Original player request: ${prompt}`, `Game title: ${spec.title}`, `Target score: ${spec.gameplay.winScore ?? 100}; lives: ${spec.gameplay.lives ?? 3}`, `Art palette: background ${spec.theme.backgroundColor}, player ${spec.theme.playerColor}, hazard ${spec.theme.hazardColor}, collectible ${spec.theme.collectibleColor ?? "#fbbf24"}`, `Named roles: player=${spec.labels.player}; danger=${spec.labels.hazard}; reward=${spec.labels.collectible ?? "reward"}`, `Required mechanics detected from the request: ${describeRequestedAgenticMechanics(prompt, spec).join(", ") || "derive concrete mechanics from the request"}`, "The runtime is judged from a mobile screenshot and a real playthrough. Make the visual hierarchy strong from the first frame, make the first interaction obvious, and implement a meaningful 30–60 second loop."].join("\n");
}

export function buildAgenticRepairPrompt(prompt: string, spec: GameSpec, previous: string, reason: string, hints: string[] = []): string {
  return [buildAgenticUserPrompt(prompt, spec), "", `Repair the prior independent runtime. Failure: ${reason}.`, ...hints, "Return a fully replaced source, not a diff.", "Previous source:", previous.slice(0, 12_000)].join("\n");
}
