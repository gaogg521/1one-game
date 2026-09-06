import { llmJson } from "@/lib/llm";
import { PRODUCT } from "@/lib/product-config";
import { resolveGameModelRoute } from "@/lib/game-model-route";
import { loadRuntimeConfig } from "@/lib/runtime-config";
import { runtimeLocaleGroupForCurrentRequest } from "@/lib/runtime-locale-routing";
import type { RuntimeLocaleGroup } from "@/lib/runtime-providers";
import type { GameSpec } from "@/lib/game-spec";
import type { RunTraceRecorder } from "@/lib/orchestration/run-trace";
import { forgeGame, type ForgeOptions } from "@/lib/game-forge/forge";
import { generateModule } from "@/lib/game-forge/code-agent";
import { runQaAgent } from "@/lib/game-forge/qa-agent";
import { assembleGame } from "@/lib/game-forge/assemble";
import { GAME_FORGE_SDK_VERSION } from "@/lib/game-forge/runtime-sdk";
import { GameDesignDocSchema, type GameBuild, type GameDesignDoc, type GameModule } from "@/lib/game-forge/types";

/**
 * Bridge between GameForge and the existing GameSpec plumbing.
 *
 * The assembled runtime keeps living on `spec.agenticModule.source` so every
 * existing playback, publishing and QA path keeps working unchanged. The build
 * itself is persisted alongside it, which is what makes module-level editing
 * possible instead of regenerating a whole game for every tweak.
 */

export function applyBuildToSpec(spec: GameSpec, build: GameBuild): GameSpec {
  return {
    ...spec,
    title: build.design.title || spec.title,
    agenticModule: { version: 2, source: build.source, entry: "mountGame" },
    agenticPlayRoute: "independent",
    forgeBuild: {
      version: 1,
      design: build.design,
      modules: build.modules,
      qa: build.qa,
      provenance: build.provenance,
      sdkVersion: GAME_FORGE_SDK_VERSION,
    },
  };
}

export type ForgeSpecResult =
  | { ok: true; spec: GameSpec; build: GameBuild }
  | { ok: false; reason: string };

/** Full build: design, parallel code agents, QA, repair rounds. */
export async function forgeGameIntoSpec(
  prompt: string,
  spec: GameSpec,
  opts: Omit<ForgeOptions, "prompt"> = {},
): Promise<ForgeSpecResult> {
  const result = await forgeGame({
    prompt,
    title: spec.title,
    winScore: spec.gameplay.winScore ?? undefined,
    ...opts,
  });
  if (!result.ok) return { ok: false, reason: result.reason };
  return { ok: true, spec: applyBuildToSpec(spec, result.build), build: result.build };
}

/* ------------------------------------------------------------------ edit -- */

const EDIT_PLAN_SCHEMA = {
  name: "forge_edit_plan",
  strict: false,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["edits"],
    properties: {
      summary: { type: "string" },
      edits: {
        type: "array", minItems: 1, maxItems: 5,
        items: {
          type: "object", additionalProperties: false,
          required: ["moduleId", "change"],
          properties: {
            moduleId: { type: "string" },
            change: { type: "string" },
          },
        },
      },
    },
  },
} as const;

function editPlanSystemPrompt(): string {
  return `You are the tech lead of a game studio. A player who owns this game has asked for a change. You decide which existing modules must be edited and exactly what each edit is.

Rules:
- Touch the fewest modules that can satisfy the request. Most requests are one or two modules.
- "change" is an instruction to the engineer who owns that module: say what behaviour must differ, with concrete numbers where the request implies them. Do not write code.
- Only name moduleIds from the list you are given.
- If the request would need a mechanic that does not exist anywhere yet, assign it to the module whose responsibility is closest and say what to add.

Return JSON only.`;
}

function editPlanUserPrompt(design: GameDesignDoc, modules: GameModule[], instruction: string): string {
  return [
    `GAME: ${design.title} — ${design.pitch}`,
    `WIN: ${design.progression.winCondition}`,
    `LOSE: ${design.progression.loseCondition}`,
    "",
    "MODULES:",
    ...modules.map((m) => {
      const plan = design.modules.find((p) => p.id === m.id);
      return `  - ${m.id} (${m.role}): ${plan?.brief ?? "(no brief)"}\n    provides: ${m.provides.join(", ") || "(none)"}`;
    }),
    "",
    `PLAYER REQUEST: ${instruction}`,
    "",
    "Plan the edits.",
  ].join("\n");
}

export type ForgeEditResult =
  | { ok: true; spec: GameSpec; build: GameBuild; edited: string[]; summary?: string }
  | { ok: false; reason: string; fallbackToFullBuild: boolean };

/**
 * Applies a player's change request by patching the modules it touches.
 *
 * This is the difference between a game a creator can converge on and a slot
 * machine: the previous pipeline regenerated the entire game for every wish,
 * so no amount of feedback accumulated.
 */
export async function editForgeBuild(
  prompt: string,
  spec: GameSpec,
  instruction: string,
  opts: { localeGroup?: RuntimeLocaleGroup; trace?: RunTraceRecorder } = {},
): Promise<ForgeEditResult> {
  const stored = spec.forgeBuild;
  if (!stored || !Array.isArray(stored.modules) || !stored.modules.length) {
    return { ok: false, reason: "forge_build_absent", fallbackToFullBuild: true };
  }
  const designParsed = GameDesignDocSchema.safeParse(stored.design);
  if (!designParsed.success) {
    return { ok: false, reason: "forge_design_unreadable", fallbackToFullBuild: true };
  }

  await loadRuntimeConfig();
  const localeGroup = opts.localeGroup ?? (await runtimeLocaleGroupForCurrentRequest());
  const design = designParsed.data;
  let modules = stored.modules as GameModule[];
  const route = resolveGameModelRoute({ prompt, localeGroup });
  if (!route.models.length) return { ok: false, reason: "forge_edit_model_missing", fallbackToFullBuild: false };

  const startedAt = new Date().toISOString();
  const planStarted = Date.now();
  const plan = await llmJson({
    model: route.models[0]!,
    scene: route.scene,
    localeGroup,
    strictSceneModel: true,
    system: editPlanSystemPrompt(),
    user: editPlanUserPrompt(design, modules, instruction),
    temperature: 0.25,
    mode: "json_schema",
    jsonSchema: EDIT_PLAN_SCHEMA,
    maxTokens: 2_048,
    timeoutMs: 90_000,
  });
  if (!plan.ok) return { ok: false, reason: `forge_edit_plan_failed:${plan.error ?? "model_failed"}`, fallbackToFullBuild: false };

  const raw = plan.raw as { edits?: Array<{ moduleId?: string; change?: string }>; summary?: string };
  const known = new Set(modules.map((m) => m.id));
  const edits = (raw.edits ?? []).filter((e) => e && typeof e.moduleId === "string" && typeof e.change === "string" && known.has(e.moduleId));
  if (!edits.length) return { ok: false, reason: "forge_edit_plan_empty", fallbackToFullBuild: false };

  opts.trace?.note("forge_edit_planned", { edits: edits.map((e) => e.moduleId), summary: raw.summary });

  const editStarted = Date.now();
  const results = await Promise.all(edits.map(async (edit) => {
    const modulePlan = design.modules.find((p) => p.id === edit.moduleId);
    const current = modules.find((m) => m.id === edit.moduleId);
    if (!modulePlan || !current) return null;
    return generateModule(design, modulePlan, route.models, route.scene, localeGroup, {
      previous: current.source,
      findings: [{
        severity: "major",
        moduleId: edit.moduleId!,
        code: "owner_request",
        message: `The game's owner asked for this change: ${edit.change}. Keep everything else in this module working exactly as it does now.`,
      }],
    });
  }));

  const edited: string[] = [];
  for (const r of results) {
    if (!r || !r.ok) continue;
    modules = modules.map((m) => (m.id === r.module.id ? r.module : m));
    edited.push(r.module.id);
  }
  if (!edited.length) return { ok: false, reason: "forge_edit_no_module_changed", fallbackToFullBuild: false };

  const assembled = assembleGame(design, modules);
  const qa = await runQaAgent(design, modules, { prompt: `${prompt}\n${instruction}`, localeGroup, staticOnly: true });

  const build: GameBuild = {
    version: 1,
    design,
    modules,
    source: assembled.source,
    qa: {
      ...qa,
      findings: [...qa.findings, ...assembled.findings],
      ok: !([...qa.findings, ...assembled.findings].some((f) => f.severity === "blocker")),
    },
    provenance: {
      startedAt,
      completedAt: new Date().toISOString(),
      passes: [
        { agent: "edit_planner", model: plan.model, changed: edits.map((e) => `plan:${e.moduleId}`), durationMs: planStarted ? Date.now() - planStarted : 0, note: raw.summary },
        { agent: "runtime_engineers", changed: edited.map((id) => `module:${id}`), durationMs: Date.now() - editStarted, note: `owner edit: ${instruction.slice(0, 120)}` },
      ],
    },
  };

  return { ok: true, spec: applyBuildToSpec(spec, build), build, edited, summary: raw.summary };
}

/** Feature flag so the legacy single-call path stays reachable for comparison. */
export function isGameForgeEnabled(): boolean {
  return PRODUCT.gameForge.enabled;
}
