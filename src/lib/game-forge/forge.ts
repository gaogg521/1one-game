import { PRODUCT } from "@/lib/product-config";
import { resolveGameModelRoute } from "@/lib/game-model-route";
import { loadRuntimeConfig } from "@/lib/runtime-config";
import { runtimeLocaleGroupForCurrentRequest } from "@/lib/runtime-locale-routing";
import type { RuntimeLocaleGroup } from "@/lib/runtime-providers";
import type { RunTraceRecorder } from "@/lib/orchestration/run-trace";
import { runDesignAgent } from "@/lib/game-forge/design-agent";
import { generateModule, runCodeAgents } from "@/lib/game-forge/code-agent";
import { runQaAgent } from "@/lib/game-forge/qa-agent";
import { assembleGame } from "@/lib/game-forge/assemble";
import type { GameBuild, GameDesignDoc, GameModule, QaFinding, QaReport } from "@/lib/game-forge/types";

/**
 * GameForge orchestrator.
 *
 * Every pass here makes a real model call and mutates a real deliverable. That
 * is the difference from the previous "six agents" layer, which was a pure
 * function labelling ledger rows with role names.
 */

type Pass = GameBuild["provenance"]["passes"][number];

export type ForgeOptions = {
  prompt: string;
  title?: string;
  brief?: string | null;
  winScore?: number;
  localeGroup?: RuntimeLocaleGroup;
  trace?: RunTraceRecorder;
  /** Progress callback for durable job heartbeats. */
  onProgress?: (stage: string, detail: string, percent: number) => void | Promise<void>;
  /** Skip the model QA review; deterministic checks still run. */
  staticQaOnly?: boolean;
};

export type ForgeResult =
  | { ok: true; build: GameBuild }
  | { ok: false; reason: string; partial?: { design?: GameDesignDoc; modules?: GameModule[] } };

function blockingFindings(report: QaReport): QaFinding[] {
  return report.findings.filter((f) => f.severity === "blocker" || f.severity === "major");
}

export async function forgeGame(options: ForgeOptions): Promise<ForgeResult> {
  // Durable workers boot in a fresh process; hydrate the encrypted routing
  // config before any agent resolves a model.
  await loadRuntimeConfig();
  const localeGroup = options.localeGroup ?? (await runtimeLocaleGroupForCurrentRequest());
  const cfg = PRODUCT.gameForge;
  const startedAt = new Date().toISOString();
  const passes: Pass[] = [];
  const progress = async (stage: string, detail: string, percent: number) => {
    options.trace?.note(`forge_${stage}`, { detail, percent });
    if (options.onProgress) await options.onProgress(stage, detail, percent);
  };

  /* ------------------------------------------------------------- design -- */
  await progress("design", "design director is writing the build document", 8);
  const designStarted = Date.now();
  const design = await runDesignAgent(options.prompt, {
    title: options.title,
    brief: options.brief,
    winScore: options.winScore,
    localeGroup,
  });
  if (!design.ok) {
    options.trace?.note("forge_design_failed", { reason: design.reason });
    return { ok: false, reason: design.reason };
  }
  passes.push({
    agent: "design_director",
    model: design.model,
    changed: ["game_design_doc"],
    durationMs: Date.now() - designStarted,
    note: `${design.design.modules.length} modules, ${design.design.mechanics.length} mechanics, ${design.design.assets.length} asset slots`,
  });

  /* ---------------------------------------------------------------- code -- */
  await progress("code", `${design.design.modules.length} code agents building modules`, 26);
  const code = await runCodeAgents(design.design, { prompt: options.prompt, localeGroup });
  if (!code.modules.length) {
    return { ok: false, reason: `forge_no_modules:${code.failures.map((f) => f.reason).join(",") || "unknown"}`, partial: { design: design.design } };
  }
  passes.push({
    agent: "runtime_engineers",
    model: code.modules[0]?.model,
    changed: code.modules.map((m) => `module:${m.id}`),
    durationMs: code.durationMs,
    note: code.failures.length ? `${code.failures.length} module(s) failed: ${code.failures.map((f) => `${f.moduleId}(${f.reason})`).join(", ")}` : "all modules generated",
  });

  let modules = code.modules;
  const missingMain = !modules.some((m) => m.role === "main");
  if (missingMain) {
    return { ok: false, reason: "forge_main_module_missing", partial: { design: design.design, modules } };
  }

  /* ------------------------------------------------------------ assemble -- */
  let assembled = assembleGame(design.design, modules);

  /* ------------------------------------------------------------------ qa -- */
  await progress("qa", "qa agent auditing the build", 58);
  let qaStarted = Date.now();
  let qa = await runQaAgent(design.design, modules, { prompt: options.prompt, localeGroup, staticOnly: options.staticQaOnly });
  qa = mergeAssemblyFindings(qa, assembled.findings);
  passes.push({
    agent: "qa_agent",
    changed: ["qa_report"],
    durationMs: Date.now() - qaStarted,
    note: `${qa.findings.length} findings, ${qa.findings.filter((f) => f.severity === "blocker").length} blockers`,
  });

  /* -------------------------------------------------------------- repair -- */
  const route = resolveGameModelRoute({ prompt: options.prompt, localeGroup });
  for (let round = 0; round < cfg.maxRepairRounds; round += 1) {
    const actionable = blockingFindings(qa);
    if (!actionable.length) break;

    const byModule = new Map<string, QaFinding[]>();
    for (const f of actionable) {
      const target = f.moduleId === "assembled" ? pickRepairTarget(modules, f) : f.moduleId;
      if (!target) continue;
      const list = byModule.get(target) ?? [];
      list.push(f);
      byModule.set(target, list);
    }
    if (!byModule.size) break;

    await progress("repair", `repair round ${round + 1}: ${byModule.size} module(s)`, 62 + round * 10);
    const repairStarted = Date.now();
    const targets = [...byModule.entries()];
    const results = await Promise.all(targets.map(async ([moduleId, findings]) => {
      const plan = design.design.modules.find((p) => p.id === moduleId);
      const current = modules.find((m) => m.id === moduleId);
      if (!plan || !current) return null;
      return generateModule(design.design, plan, route.models, route.scene, localeGroup, { previous: current.source, findings });
    }));

    // A repair round can make the build worse: it rewrites whole modules, so
    // fixing a "major" can regress something that already worked. Keep the
    // pre-round state and roll back if the blocker count goes up.
    const priorModules = modules;
    const priorAssembled = assembled;
    const priorQa = qa;
    const priorBlockers = qa.findings.filter((f) => f.severity === "blocker").length;

    const repaired: string[] = [];
    for (const r of results) {
      if (!r || !r.ok) continue;
      modules = modules.map((m) => (m.id === r.module.id ? r.module : m));
      repaired.push(r.module.id);
    }
    if (!repaired.length) break;

    assembled = assembleGame(design.design, modules);
    qaStarted = Date.now();
    qa = await runQaAgent(design.design, modules, { prompt: options.prompt, localeGroup, staticOnly: options.staticQaOnly });
    qa = mergeAssemblyFindings(qa, assembled.findings);
    const nextBlockers = qa.findings.filter((f) => f.severity === "blocker").length;

    if (nextBlockers > priorBlockers) {
      modules = priorModules;
      assembled = priorAssembled;
      qa = priorQa;
      passes.push({
        agent: "repair_agent",
        changed: [],
        durationMs: Date.now() - repairStarted,
        note: `round ${round + 1} rolled back: repairing ${repaired.join(", ")} raised blockers ${priorBlockers} -> ${nextBlockers}, keeping the previous build`,
      });
      break;
    }

    passes.push({
      agent: "repair_agent",
      changed: repaired.map((id) => `module:${id}`),
      durationMs: Date.now() - repairStarted,
      note: `round ${round + 1} repaired ${repaired.join(", ")}; ${nextBlockers} blockers remain`,
    });
    // Nothing blocking left: stop before a cosmetic round can regress it.
    if (nextBlockers === 0) break;
  }

  /* ------------------------------------------------------- final assembly -- */
  await progress("assemble", "assembling the runnable build", 92);
  const build: GameBuild = {
    version: 1,
    design: design.design,
    modules,
    source: assembled.source,
    qa,
    provenance: { startedAt, completedAt: new Date().toISOString(), passes },
  };

  if (!qa.ok) {
    options.trace?.note("forge_completed_with_blockers", {
      blockers: qa.findings.filter((f) => f.severity === "blocker").map((f) => `${f.moduleId}:${f.code}`),
    });
  }
  return { ok: true, build };
}

/**
 * A whole-build finding has to be repaired somewhere. Route it to the module
 * whose declared responsibility covers it, defaulting to main.
 */
function pickRepairTarget(modules: GameModule[], finding: QaFinding): string | null {
  const main = modules.find((m) => m.role === "main");
  const systems = modules.filter((m) => m.role === "system");
  const byCode: Record<string, (m: GameModule) => boolean> = {
    no_hud: (m) => /hud|ui|interface/i.test(m.id),
    no_juice: (m) => /render|draw|fx|effect/i.test(m.id),
    silent_build: (m) => /audio|sound|player|combat/i.test(m.id),
    no_artwork: (m) => /render|draw|entit|sprite/i.test(m.id),
    no_touch_input: (m) => /input|player|control/i.test(m.id),
    no_win_path: (m) => /progress|score|rule|level/i.test(m.id),
    no_lose_path: (m) => /progress|score|rule|level|collision/i.test(m.id),
    required_asset_unused: (m) => /render|draw|entit|sprite/i.test(m.id),
  };
  const match = byCode[finding.code];
  if (match) {
    const hit = systems.find(match);
    if (hit) return hit.id;
  }
  return main?.id ?? systems[0]?.id ?? null;
}

function mergeAssemblyFindings(report: QaReport, findings: QaFinding[]): QaReport {
  if (!findings.length) return report;
  const merged = [...report.findings];
  for (const f of findings) {
    if (!merged.some((e) => e.moduleId === f.moduleId && e.code === f.code)) merged.push(f);
  }
  return {
    ...report,
    findings: merged,
    ok: !merged.some((f) => f.severity === "blocker"),
    evidence: [...report.evidence, `assembly:findings=${findings.length}`],
  };
}
