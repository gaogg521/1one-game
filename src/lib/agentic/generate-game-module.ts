import type { GameSpec } from "@/lib/game-spec";
import {
  buildFallbackAgenticModule,
  parseAgenticModule,
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
import { buildDebugSkillRepairHints, runDebugSkillPipeline, shouldSkipTemplateFirstForPrompt } from "@/lib/opengame-skills";
import { maybeVerifyAgenticModuleInBrowser } from "@/lib/opengame-skills/browser-bench-generate";
import { isOpenGameBrowserBenchRequired } from "@/lib/opengame-skills/browser-bench-env";
import { probeOpenGameCli, runOpenGameCliHeadless } from "@/lib/opengame-skills/opengame-cli";
import {
  bridgeOpenGameCliWorkDir,
  isOpenGameCliBridgeEnabled,
} from "@/lib/opengame-skills/opengame-cli-bridge";
import { resolveAgenticPlayRoute, stampAgenticPlayRoute, stripAgenticModuleForDedicatedRoute } from "@/lib/opengame-skills/play-route";
import { llmJson, getActiveProvider } from "@/lib/llm";
import { resolveGameModelRoute } from "@/lib/game-model-route";
import type { RunTraceRecorder } from "@/lib/orchestration/run-trace";
import { PRODUCT } from "@/lib/product-config";

export type GenerateAgenticModuleResult =
  | {
      ok: true;
      module: AgenticGameModule;
      source: "llm" | "fallback" | "template_first" | "opengame_cli";
      lastReason?: string;
    }
  | { ok: false; reason: string };

const REPAIR_ATTEMPTS = 2;

/** OpenGame Debug Skill：proactive + runnable 闭环最大轮次（含 LLM repair） */
const DEBUG_SKILL_MAX_ROUNDS = 3;

function passesDebugSkill(mod: AgenticGameModule): { ok: true } | { ok: false; reason: string; hints: string[] } {
  const pipeline = runDebugSkillPipeline(mod);
  if (pipeline.ok) return { ok: true };
  const hints = buildDebugSkillRepairHints(pipeline.checks);
  return { ok: false, reason: `${pipeline.stage}:${pipeline.reason}`, hints };
}

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
  orch?: RunTraceRecorder,
): Promise<GenerateAgenticModuleResult> {
  if (process.env.E2E_AGENTIC_FALLBACK_ONLY === "1") {
    const mod = buildFallbackAgenticModule(spec.title, spec);
    orch?.note("agentic_gen_result", { source: "fallback", reason: "E2E_AGENTIC_FALLBACK_ONLY" });
    return { ok: true, module: mod, source: "fallback" };
  }

  const templateFirst = PRODUCT.game.agenticTemplateFirst;
  const skipTemplateFirst = shouldSkipTemplateFirstForPrompt(prompt, spec);

  if (process.env.OPENGAME_CLI === "1" && skipTemplateFirst) {
    const probe = await probeOpenGameCli();
    const cliRun = await runOpenGameCliHeadless(prompt, { runId: spec.title });
    orch?.note("opengame_cli_spike", {
      probeAvailable: probe.available,
      probeError: probe.error ?? null,
      ok: cliRun.ok,
      skipped: cliRun.skipped,
      dryRun: !cliRun.skipped && "dryRun" in cliRun ? cliRun.dryRun : false,
      exitCode: !cliRun.skipped && "exitCode" in cliRun ? cliRun.exitCode : null,
      durationMs: !cliRun.skipped && "durationMs" in cliRun ? cliRun.durationMs : null,
      workDir: !cliRun.skipped && "workDir" in cliRun ? cliRun.workDir : null,
      error:
        cliRun.skipped
          ? cliRun.reason
          : !cliRun.ok && "error" in cliRun
            ? cliRun.error
            : null,
    });

    if (
      isOpenGameCliBridgeEnabled() &&
      !cliRun.skipped &&
      cliRun.ok &&
      "workDir" in cliRun &&
      !cliRun.dryRun
    ) {
      const bridge = bridgeOpenGameCliWorkDir(cliRun.workDir);
      orch?.note("opengame_cli_bridge", {
        ok: bridge.ok,
        reason: bridge.ok ? null : bridge.reason,
        strategy: bridge.ok ? bridge.strategy : null,
        files: bridge.files,
        entry: bridge.ok ? bridge.entry : null,
      });
      if (bridge.ok) {
        const debug = passesDebugSkill(bridge.module);
        if (debug.ok) {
          const bench = await maybeVerifyAgenticModuleInBrowser(prompt, spec, bridge.module);
          orch?.note("agentic_browser_bench", {
            ok: bench.benchOk,
            skipped: bench.benchSkipped,
            source: "opengame_cli",
          });
          orch?.note("agentic_gen_result", {
            source: "opengame_cli",
            strategy: bridge.strategy,
            files: bridge.files,
          });
          return {
            ok: true,
            module: bench.module,
            source: "opengame_cli",
            lastReason: bridge.strategy,
          };
        }
        orch?.note("opengame_cli_bridge", {
          ok: false,
          reason: debug.reason,
          debugStage: "debug_skill",
        });
      }
    }
  }

  if (
    !skipTemplateFirst &&
    templateFirst.includes(spec.templateId) &&
    process.env.AGENTIC_FORCE_LLM !== "1"
  ) {
    const mod = buildTemplateFallbackModule(spec);
    const debug = passesDebugSkill(mod);
    if (debug.ok) {
      orch?.note("agentic_gen_result", { source: "template_first", skipTemplateFirst });
      return { ok: true, module: mod, source: "template_first", lastReason: "template_first" };
    }
  }

  const gameRoute = resolveGameModelRoute({ prompt });
  const models = gameRoute.models;
  if (!models.length || !getActiveProvider()) {
    orch?.note("agentic_gen_result", { source: "fallback", reason: "no_llm" });
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
          scene: gameRoute.scene,
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

        let debugRound = 0;
        let candidate = mod;
        let debugFail: ReturnType<typeof passesDebugSkill> = passesDebugSkill(candidate);
        while (!debugFail.ok && debugRound < DEBUG_SKILL_MAX_ROUNDS) {
          lastReason = debugFail.reason;
          lastSource = candidate.source;
          logAgenticProgress(model, attempt, `debug_skill(${lastReason}) round=${debugRound}`);
          if (debugRound >= DEBUG_SKILL_MAX_ROUNDS - 1 || attempt >= limits.maxRepairs) break;
          const repairUser = buildAgenticRepairPrompt(
            prompt,
            spec,
            candidate.source,
            lastReason,
            debugFail.hints,
          );
          try {
            const repairResult = await llmJson({
              model,
              system,
              user: repairUser,
              temperature: 0.32,
              mode: "json_object",
              timeoutMs: limits.repairTimeoutMs,
            });
            if (!repairResult.ok) break;
            const repaired = parseLlmModule(repairResult.raw);
            if (!repaired) break;
            candidate = repaired;
            lastSource = candidate.source;
            debugFail = passesDebugSkill(candidate);
          } catch {
            break;
          }
          debugRound += 1;
        }

        if (!debugFail.ok) {
          lastReason = debugFail.reason;
          logAgenticProgress(model, attempt, `debug_skill_fail: ${lastReason}`);
          continue;
        }

        const runnable = validateAgenticRunnable(candidate);
        if (!runnable.ok) {
          lastReason = runnable.reason;
          logAgenticProgress(model, attempt, `runnable_fail: ${lastReason}`);
          continue;
        }

        logAgenticProgress(model, attempt, "ok");
        const bench = await maybeVerifyAgenticModuleInBrowser(prompt, spec, candidate);
        orch?.note("agentic_browser_bench", {
          ok: bench.benchOk,
          skipped: bench.benchSkipped,
        });
        if (!bench.benchOk && isOpenGameBrowserBenchRequired()) {
          lastReason = "browser_bench_failed";
          continue;
        }
        orch?.note("agentic_gen_result", { source: "llm", debugRounds: debugRound, llmAttempt: attempt });
        return { ok: true, module: bench.module, source: "llm" };
      } catch {
        lastReason = "llm_error";
      }
    }
  }

  orch?.note("agentic_gen_result", { source: "fallback", lastReason });
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

/** Phase A：dedicated 路由对 Template fallback 跑 Debug Skill proactive/runnable 门禁 */
export function lintDedicatedRouteDebugSkill(spec: GameSpec) {
  return runDebugSkillPipeline(buildTemplateFallbackModule(spec));
}

export async function attachAgenticModuleIfEnabled(
  prompt: string,
  spec: GameSpec,
  enabled = isAgenticModuleEnabled(),
  orch?: RunTraceRecorder,
): Promise<GameSpec> {
  if (!enabled) return stampAgenticPlayRoute(prompt, spec);

  const route = resolveAgenticPlayRoute(prompt, spec, { respectPersisted: false });
  orch?.note("agentic_attach_route", { route, templateId: spec.templateId });

  if (route === "dedicated") {
    orch?.note("agentic_attach_skipped", { reason: "dedicated_route" });
    return stripAgenticModuleForDedicatedRoute({ ...spec, agenticPlayRoute: "dedicated" });
  }

  const stamped: GameSpec = { ...spec, agenticPlayRoute: "agentic" };
  const r = await generateAgenticGameModule(prompt, stamped, orch);
  orch?.note("agentic_attach_result", {
    ok: r.ok,
    source: r.ok ? r.source : null,
    lastReason: r.ok ? r.lastReason ?? null : r.reason,
  });
  if (!r.ok) return stamped;
  return { ...stamped, agenticModule: r.module };
}
