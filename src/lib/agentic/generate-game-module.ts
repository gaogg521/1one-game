import type { GameSpec } from "@/lib/game-spec";
import {
  buildFallbackAgenticModule,
  parseAgenticModule,
  shouldUseDedicatedSceneForTemplateFirst,
  validateAgenticSource,
  type AgenticGameModule,
} from "@/lib/agentic/game-module";
import { buildTemplateFallbackModule } from "@/lib/agentic/template-fallback-modules";
import {
  buildAgenticRepairPrompt,
  buildAgenticSystemPrompt,
  buildAgenticUserPrompt,
} from "@/lib/agentic/agentic-prompts";
import { validateAgenticRunnable } from "@/lib/agentic/agentic-runnable";
import { llmJson, getActiveProvider, getProviderModelCascade } from "@/lib/llm";
import { PRODUCT } from "@/lib/product-config";

export type GenerateAgenticModuleResult =
  | { ok: true; module: AgenticGameModule; source: "llm" | "fallback" | "template_first"; lastReason?: string }
  | { ok: false; reason: string };

const REPAIR_ATTEMPTS = 2;

function agenticGenLimits() {
  const fast = process.env.AGENTIC_LLM_FAST === "1";
  return {
    fast,
    maxModels: fast ? 1 : 2,
    maxRepairs: fast ? 1 : REPAIR_ATTEMPTS,
    timeoutMs: fast ? 75_000 : PRODUCT.game.agenticTimeoutMs,
    repairTimeoutMs: fast ? 55_000 : PRODUCT.game.agenticRepairTimeoutMs,
  };
}

function logAgenticProgress(model: string, attempt: number, msg: string) {
  if (process.env.AGENTIC_GEN_VERBOSE === "1" || process.env.AGENTIC_LLM_FAST === "1") {
    console.log(`[agentic] ${model} try=${attempt} ${msg}`);
  }
}

function parseLlmModule(raw: unknown): AgenticGameModule | null {
  const o = raw as { source?: string; entry?: string };
  const source = typeof o?.source === "string" ? o.source : "";
  const entry = typeof o?.entry === "string" ? o.entry : "createGame";
  const check = validateAgenticSource(source);
  if (!check.ok) return null;
  return parseAgenticModule({ version: 1, source, entry });
}

/** Phase 3 + Astrocade repair：LLM → 校验 → 沙箱 runnable → repair → template fallback */
export async function generateAgenticGameModule(
  prompt: string,
  spec: GameSpec,
): Promise<GenerateAgenticModuleResult> {
  if (process.env.E2E_AGENTIC_FALLBACK_ONLY === "1") {
    return { ok: true, module: buildFallbackAgenticModule(spec.title, spec), source: "fallback" };
  }

  const templateFirst = PRODUCT.game.agenticTemplateFirst;
  if (
    templateFirst.includes(spec.templateId) &&
    process.env.AGENTIC_FORCE_LLM !== "1"
  ) {
    const mod = buildTemplateFallbackModule(spec);
    const run = validateAgenticRunnable(mod);
    if (run.ok) {
      return { ok: true, module: mod, source: "template_first", lastReason: "template_first" };
    }
  }

  const models = getProviderModelCascade();
  if (!models.length || !getActiveProvider()) {
    return { ok: true, module: buildFallbackAgenticModule(spec.title, spec), source: "fallback" };
  }

  const system = buildAgenticSystemPrompt();
  let lastSource = "";
  let lastReason = "invalid";
  const limits = agenticGenLimits();

  for (const model of models.slice(0, limits.maxModels)) {
    for (let attempt = 0; attempt <= limits.maxRepairs; attempt += 1) {
      logAgenticProgress(model, attempt, attempt === 0 ? "generate" : `repair(${lastReason})`);
      const user =
        attempt === 0
          ? buildAgenticUserPrompt(prompt, spec)
          : buildAgenticRepairPrompt(prompt, spec, lastSource, lastReason);

      try {
        const result = await llmJson({
          model,
          system,
          user,
          temperature: attempt === 0 ? 0.52 : 0.35,
          mode: "json_object",
          timeoutMs: attempt === 0 ? limits.timeoutMs : limits.repairTimeoutMs,
        });
        if (!result.ok) {
          lastReason = result.error ?? "llm_empty";
          logAgenticProgress(model, attempt, `llm_fail: ${lastReason}`);
          continue;
        }

        const source =
          typeof (result.raw as { source?: string })?.source === "string"
            ? (result.raw as { source: string }).source
            : "";
        lastSource = source;

        const forbidden = validateAgenticSource(source);
        if (!forbidden.ok) {
          lastReason = forbidden.reason;
          continue;
        }

        const mod = parseLlmModule(result.raw);
        if (!mod) {
          lastReason = "parse_failed";
          continue;
        }

        const runnable = validateAgenticRunnable(mod);
        if (!runnable.ok) {
          lastReason = runnable.reason;
          logAgenticProgress(model, attempt, `runnable_fail: ${lastReason}`);
          continue;
        }

        logAgenticProgress(model, attempt, "ok");
        return { ok: true, module: mod, source: "llm" };
      } catch {
        lastReason = "llm_error";
      }
    }
  }

  return {
    ok: true,
    module: buildFallbackAgenticModule(spec.title, spec),
    source: "fallback",
    lastReason,
  };
}

export function isAgenticModuleEnabled(): boolean {
  return PRODUCT.game.agenticModuleEnabled;
}

export async function attachAgenticModuleIfEnabled(
  prompt: string,
  spec: GameSpec,
  enabled = isAgenticModuleEnabled(),
): Promise<GameSpec> {
  if (!enabled) return spec;
  if (shouldUseDedicatedSceneForTemplateFirst(spec)) {
    return spec;
  }
  const r = await generateAgenticGameModule(prompt, spec);
  if (!r.ok) return spec;
  return { ...spec, agenticModule: r.module };
}
