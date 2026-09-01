import type { GameSpec } from "@/lib/game-spec";
import { parseAgenticModule, validateAgenticSource, type AgenticGameModule } from "@/lib/agentic/game-module";
import { AGENTIC_MODULE_JSON_SCHEMA, buildAgenticRepairPrompt, buildAgenticSystemPrompt, buildAgenticUserPrompt } from "@/lib/agentic/agentic-prompts";
import { evaluateAgenticVisualContract } from "@/lib/agentic/agentic-visual-contract";
import { evaluateAgenticMechanicsContract } from "@/lib/agentic/agentic-mechanics-contract";
import { llmJson, getActiveProvider } from "@/lib/llm";
import { resolveGameModelRoute } from "@/lib/game-model-route";
import { runtimeLocaleGroupForCurrentRequest } from "@/lib/runtime-locale-routing";
import type { RunTraceRecorder } from "@/lib/orchestration/run-trace";

export type GenerateAgenticModuleResult =
  | { ok: true; module: AgenticGameModule; source: "llm"; lastReason?: string; execution: { provider: string; model: string; startedAt: string; completedAt: string } }
  | { ok: false; reason: string };

/** Model-only generation. A failure remains a failure: no template or generic fallback exists. */
export async function generateAgenticGameModule(prompt: string, spec: GameSpec, orch?: RunTraceRecorder, options?: { bounded?: boolean; requireLlm?: boolean }): Promise<GenerateAgenticModuleResult> {
  const localeGroup = await runtimeLocaleGroupForCurrentRequest();
  const route = resolveGameModelRoute({ prompt, localeGroup });
  if (!getActiveProvider() || !route.models.length) return { ok: false, reason: "runtime_engineer_model_missing" };
  const attempts = options?.bounded ? 2 : 4;
  let lastReason = "model_empty";
  let previous = "";
  for (const model of route.models.slice(0, 2)) for (let attempt = 0; attempt < attempts; attempt += 1) {
    const startedAt = new Date().toISOString();
    const result = await llmJson({ model, scene: route.scene, localeGroup, system: buildAgenticSystemPrompt(), user: attempt === 0 ? buildAgenticUserPrompt(prompt, spec) : buildAgenticRepairPrompt(prompt, spec, previous, lastReason), temperature: attempt === 0 ? 0.48 : 0.22, mode: "json_schema", jsonSchema: AGENTIC_MODULE_JSON_SCHEMA, timeoutMs: attempt === 0 ? 100_000 : 70_000 });
    if (!result.ok) { lastReason = result.error ?? "model_failed"; continue; }
    const raw = result.raw as { source?: unknown; entry?: unknown };
    previous = typeof raw.source === "string" ? raw.source : "";
    const safety = validateAgenticSource(previous);
    const module = parseAgenticModule({ version: 2, source: previous, entry: raw.entry });
    if (!safety.ok || !module) { lastReason = safety.ok ? "module_parse_failed" : safety.reason; continue; }
    const visual = evaluateAgenticVisualContract(spec, module);
    const mechanics = evaluateAgenticMechanicsContract(prompt, spec, module);
    orch?.note("independent_runtime_contract", { visual, mechanics, attempt, model });
    if (!visual.ok || !mechanics.ok) { lastReason = [...visual.blockers, ...mechanics.blockers].join(",") || "runtime_contract_failed"; continue; }
    const execution = { provider: result.provider, model: result.model, startedAt, completedAt: new Date().toISOString() };
    orch?.note("independent_runtime_generated", { source: "llm", attempt, execution });
    return { ok: true, module, source: "llm", execution };
  }
  orch?.note("independent_runtime_rejected", { reason: lastReason });
  return { ok: false, reason: `independent_runtime_generation_failed:${lastReason}` };
}

export function isAgenticModuleEnabled(): boolean { return true; }
export function lintDedicatedRouteDebugSkill(spec: GameSpec) { return { ok: Boolean(spec.agenticModule), stage: "independent_runtime", reason: spec.agenticModule ? undefined : "independent_runtime_missing" }; }
export async function attachAgenticModuleIfEnabled(prompt: string, spec: GameSpec, enabled = true, orch?: RunTraceRecorder): Promise<GameSpec> {
  if (!enabled) return spec;
  const result = await generateAgenticGameModule(prompt, spec, orch);
  if (!result.ok) { orch?.note("independent_runtime_attach_failed", { reason: result.reason }); return spec; }
  return { ...spec, agenticModule: result.module };
}
