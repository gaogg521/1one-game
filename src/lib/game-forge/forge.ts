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
import { runRuntimeProbe } from "@/lib/game-forge/runtime-probe";
import type { GameBuild, GameDesignDoc, GameModule, QaFinding, QaReport } from "@/lib/game-forge/types";

/**
 * GameForge orchestrator.
 *
 * Every pass here makes a real model call and mutates a real deliverable. That
 * is the difference from the previous "six agents" layer, which was a pure
 * function labelling ledger rows with role names.
 */

type Pass = GameBuild["provenance"]["passes"][number];

/** Shape mirrors ProgressMilestone; kept structural so forge stays UI-agnostic. */
export type ForgeMilestone = {
  kind: "design" | "module" | "art" | "qa" | "repair" | "ready";
  label: string;
  atMs: number;
  imageUrl?: string;
  data?: Record<string, unknown>;
};

export type ForgeOptions = {
  prompt: string;
  title?: string;
  brief?: string | null;
  winScore?: number;
  localeGroup?: RuntimeLocaleGroup;
  trace?: RunTraceRecorder;
  /**
   * Progress callback for durable job heartbeats.
   *
   * `milestone` carries the artefact just produced, so a creator watching a
   * multi-minute build sees the design document, each finished module and each
   * rendered image appear as they happen rather than a moving percentage.
   */
  onProgress?: (stage: string, detail: string, percent: number, milestone?: ForgeMilestone) => void | Promise<void>;
  /** Skip the model QA review; deterministic checks still run. */
  staticQaOnly?: boolean;
  /**
   * Boot the assembled build in a headless browser and fold what it actually
   * does into QA. Off by default so a deployment without playwright still
   * builds; on, it is the only thing that can set `observed`.
   */
  runtimeProbe?: boolean;
  /** Asset urls the probe should serve to the build (absolute or data URIs). */
  probeAssets?: Record<string, string>;
  /**
   * Art generation for the design's declared slots. Invoked as soon as the
   * design lands and awaited at the very end: art depends only on the design,
   * never on the code, so running it after the code agents added its full
   * duration to what a creator waits through for no reason.
   */
  generateArt?: (
    design: GameDesignDoc,
    onSlotDone: (slot: { key: string; kind: string; url: string | null; done: number; total: number }) => void,
  ) => Promise<{ generated: number; failed: number; durationMs: number }>;
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
  const runStartedAt = Date.now();
  const progress = async (stage: string, detail: string, percent: number, milestone?: Omit<ForgeMilestone, "atMs">) => {
    options.trace?.note(`forge_${stage}`, { detail, percent });
    if (options.onProgress) {
      await options.onProgress(stage, detail, percent, milestone ? { ...milestone, atMs: Date.now() - runStartedAt } : undefined);
    }
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
  await progress("design", `design ready: ${design.design.title}`, 18, {
    kind: "design",
    label: `设计完成：${design.design.title}`,
    data: {
      title: design.design.title,
      pitch: design.design.pitch,
      genre: design.design.genre,
      mechanics: design.design.mechanics.map((m) => m.summary),
      winCondition: design.design.progression.winCondition,
      loseCondition: design.design.progression.loseCondition,
      controls: design.design.controls.map((c) => `${c.action}：${c.touch}`),
      assetCount: design.design.assets.length,
      moduleCount: design.design.modules.length,
    },
  });

  /* ----------------------------------------------------------- art (‖) -- */
  // Started here, awaited at the end. Art and code share only the design, so
  // overlapping them removes the entire art duration from the creator's wait.
  const artStarted = Date.now();
  const artPromise = options.generateArt
    ? options.generateArt(design.design, (slot) => {
        void progress("art", `art: ${slot.key}`, 30, {
          kind: "art",
          label: slot.url ? `美术完成：${slot.key}` : `美术失败：${slot.key}`,
          imageUrl: slot.url ?? undefined,
          data: { key: slot.key, kind: slot.kind, done: slot.done, total: slot.total },
        });
      }).catch((e: unknown) => {
        options.trace?.note("forge_art_failed", { reason: (e as Error).message });
        return null;
      })
    : null;

  /* ---------------------------------------------------------------- code -- */
  await progress("code", `${design.design.modules.length} code agents building modules (art running in parallel)`, 26);
  const code = await runCodeAgents(design.design, {
    prompt: options.prompt,
    localeGroup,
    onModuleDone: (info) => {
      void progress("code", `module ${info.done}/${info.total}: ${info.id}`, 26 + Math.round((info.done / info.total) * 26), {
        kind: "module",
        label: info.ok ? `模块完成：${info.id}（${info.chars} 字符）` : `模块失败：${info.id}`,
        data: { id: info.id, role: info.role, ok: info.ok, chars: info.chars, done: info.done, total: info.total },
      });
    },
  });
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

  /**
   * A hole in the module set is the most expensive failure this pipeline can
   * ship. Every sibling was written against a contract that promised the
   * missing module's names, so each of them reads a `G.<name>` that now
   * belongs to nobody, defends against it, and no-ops -- one dead agent turns
   * into a dozen findings and a game that runs and does nothing.
   *
   * Modules are independent, so the whole gap refills in one parallel wave.
   * That is cheap next to letting the repair loop discover the consequences
   * one finding at a time.
   */
  const routeForRetry = resolveGameModelRoute({ prompt: options.prompt, localeGroup });
  const missingPlans = design.design.modules.filter((p) => !modules.some((m) => m.id === p.id));
  if (missingPlans.length && routeForRetry.models.length) {
    await progress("code", `retrying ${missingPlans.length} module(s) that failed`, 54);
    const retryStarted = Date.now();
    const retried = await Promise.all(
      missingPlans.map((plan) => generateModule(design.design, plan, routeForRetry.models, routeForRetry.scene, localeGroup)),
    );
    const recovered = retried.filter((r) => r.ok).map((r) => r.module);
    if (recovered.length) modules = [...modules, ...recovered];
    passes.push({
      agent: "runtime_engineers",
      changed: recovered.map((m) => `module:${m.id}`),
      durationMs: Date.now() - retryStarted,
      note: `retry wave: recovered ${recovered.length}/${missingPlans.length} (${missingPlans.map((p) => p.id).join(", ")})`,
    });
  }

  const missingMain = !modules.some((m) => m.role === "main");
  if (missingMain) {
    return { ok: false, reason: "forge_main_module_missing", partial: { design: design.design, modules } };
  }

  /* ------------------------------------------------------------ assemble -- */
  let assembled = assembleGame(design.design, modules);

  /* ------------------------------------------------------------------ qa -- */
  /**
   * One audit = deterministic checks + optional model review +, when the
   * static side is clean, a real browser boot.
   *
   * The probe used to run once at the very end, after repair. That made it a
   * report rather than a control: a build the probe found inert or unbootable
   * shipped exactly as-is, because nothing downstream could act on the
   * finding. Auditing this way puts observed behaviour inside the repair loop,
   * so "it does not boot" and "nothing responds to input" are repairable like
   * any other blocker -- and a repair that breaks the running build is caught
   * by the same rollback that guards the static blockers.
   *
   * The probe is skipped while static blockers remain: a build that cannot
   * parse is already known-broken, and booting it costs seconds to learn
   * nothing new.
   */
  const probeEnabled = options.runtimeProbe ?? PRODUCT.gameForge.runtimeProbe;
  // Bound once: TS drops the union narrowing on `design` inside the closure.
  const doc = design.design;

  /**
   * The model review runs once, on the first audit.
   *
   * Measured on a build that needed two repair rounds: the first review found
   * 6 findings including 3 blockers in 56s and was worth every second; the two
   * that followed each burned their whole 60s budget and returned nothing,
   * 120s of a 573s build spent learning zero. That is not bad luck -- a repair
   * round is a targeted fix for named findings, and whether it worked is a
   * question the deterministic audit and a real browser answer directly. The
   * model's contribution is judgement about the design as a whole, which does
   * not change between rounds.
   */
  let reviewSpent = false;

  async function auditBuild(mods: GameModule[], source: string, label: string): Promise<QaReport> {
    const started = Date.now();
    const staticOnly = options.staticQaOnly || reviewSpent;
    let report = await runQaAgent(doc, mods, { prompt: options.prompt, localeGroup, staticOnly });
    reviewSpent = true;
    report = mergeAssemblyFindings(report, assembled.findings);
    passes.push({
      agent: "qa_agent",
      changed: ["qa_report"],
      durationMs: Date.now() - started,
      note: `${label}: ${report.findings.length} findings, ${report.findings.filter((f) => f.severity === "blocker").length} blockers${staticOnly ? " (deterministic only)" : ""}`,
    });

    if (!probeEnabled) return report;
    if (report.findings.some((f) => f.severity === "blocker")) {
      return { ...report, evidence: [...report.evidence, "probe:skipped=static blockers first"] };
    }

    await progress("probe", "booting the build in a real browser", 78);
    const probeStarted = Date.now();
    const probe = await runRuntimeProbe(
      { version: 1, design: doc, modules: mods, source, qa: report, provenance: { startedAt, completedAt: new Date().toISOString(), passes } },
      { assets: options.probeAssets },
    );
    passes.push({
      agent: "runtime_probe",
      changed: ["qa_report"],
      durationMs: Date.now() - probeStarted,
      note: probe.observed
        ? `${label}: booted=${probe.booted} frames=${probe.frames} errors=${probe.errors.length} findings=${probe.findings.length}`
        : `${label}: not observed: ${probe.unavailable}`,
    });
    if (!probe.observed) {
      return { ...report, evidence: [...report.evidence, `probe:unavailable=${probe.unavailable ?? "unknown"}`] };
    }
    const merged = [...report.findings, ...probe.findings];
    return {
      ...report,
      observed: true,
      findings: merged,
      ok: !merged.some((f) => f.severity === "blocker"),
      evidence: [
        ...report.evidence,
        `probe:booted=${probe.booted}`,
        `probe:firstFrameMs=${probe.firstFrameMs ?? "none"}`,
        `probe:frames=${probe.frames}`,
        `probe:entities=${probe.maxEntities}`,
        `probe:scoreAfterInput=${probe.scoreAfterInput ?? "none"}`,
        `probe:ended=${probe.ended ? (probe.ended.won ? "won" : "lost") : "none"}`,
        `probe:errors=${probe.errors.length}`,
      ],
    };
  }

  await progress("qa", "qa agent auditing the build", 58);
  let qa = await auditBuild(modules, assembled.source, "initial");

  /* -------------------------------------------------------------- repair -- */
  const route = routeForRetry;
  for (let round = 0; round < cfg.maxRepairRounds; round += 1) {
    const actionable = blockingFindings(qa);
    if (!actionable.length) break;

    const byModule = new Map<string, QaFinding[]>();
    for (const f of actionable) {
      const targets = f.moduleId === "assembled" ? pickRepairTargets(modules, f) : [f.moduleId];
      for (const target of targets) {
        if (!target) continue;
        const list = byModule.get(target) ?? [];
        list.push(f);
        byModule.set(target, list);
      }
    }
    if (!byModule.size) break;

    await progress("repair", `repair round ${round + 1}: ${byModule.size} module(s)`, 62 + round * 10);
    const repairStarted = Date.now();
    const targets = [...byModule.entries()];
    const results = await Promise.all(targets.map(async ([moduleId, findings]) => {
      const plan = design.design.modules.find((p) => p.id === moduleId);
      const current = modules.find((m) => m.id === moduleId);
      if (!plan || !current) return null;
      return generateModule(design.design, plan, route.models, route.scene, localeGroup, {
        previous: current.source,
        findings,
        siblings: modules.filter((module) => module.id !== moduleId),
      });
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
    qa = await auditBuild(modules, assembled.source, `after repair round ${round + 1}`);
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
  if (artPromise) {
    await progress("art", "waiting for any art still generating", 88);
    // generateArt is injected by the caller, so the forge cannot assume it
    // honours a budget of its own. The build's delivery time is the forge's
    // responsibility: art that has not landed by now is art the game ships
    // without, and the runtime draws placeholders for the missing slots.
    const artLeftMs = Math.max(1_000, PRODUCT.gameForge.artBudgetMs - (Date.now() - artStarted));
    const art = await Promise.race([
      artPromise,
      // unref so an abandoned timer never holds a CLI process open.
      new Promise<null>((resolve) => setTimeout(() => resolve(null), artLeftMs).unref?.()),
    ]);
    passes.push(
      art
        ? {
            agent: "art_agent",
            changed: [`art:${art.generated} slot(s)`],
            durationMs: art.durationMs,
            note: `${art.generated} generated, ${art.failed} failed (ran in parallel with code; wall-clock overlap ${Math.max(0, Date.now() - artStarted - art.durationMs)}ms saved)`,
          }
        : {
            agent: "art_agent",
            changed: [],
            durationMs: Date.now() - artStarted,
            note: `art abandoned after ${Math.round((Date.now() - artStarted) / 1000)}s: the build ships with placeholder slots rather than making the creator wait`,
          },
    );
  }

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
function pickRepairTargets(modules: GameModule[], finding: QaFinding): string[] {
  const main = modules.find((m) => m.role === "main");
  const systems = modules.filter((m) => m.role === "system");
  if (finding.code === "duplicate_hud") return [main?.id ?? systems.find((m) => /hud|ui/i.test(m.id))?.id].filter((id): id is string => Boolean(id));
  if (finding.code === "score_state_split" || finding.code === "lives_state_split") {
    const field = finding.code === "score_state_split" ? "score" : "lives";
    const relevant = modules.filter((module) => {
      if (module.role === "config") return false;
      const code = module.source;
      return new RegExp(`\\b(?:G\\s*\\.\\s*state|state)\\s*\\.\\s*${field}\\b`).test(code)
        || (field === "score" ? /\bg\s*\.\s*addScore\s*\(/.test(code) : /\bg\s*\.\s*loseLife\s*\(/.test(code));
    });
    return relevant.map((module) => module.id);
  }
  if (finding.code === "sdk_time_manually_advanced") {
    return modules.filter((module) => /\bg\s*\.\s*state\s*\.\s*time\s*(?:\+\+|--|\+=|-=|=\s*g\s*\.\s*state\s*\.\s*time\s*[+-])/.test(module.source)).map((module) => module.id);
  }
  if (finding.code === "invincibility_never_expires") {
    const target = systems.find((module) => /player|control|collision|damage/i.test(module.id));
    return [target?.id ?? main?.id].filter((id): id is string => Boolean(id));
  }
  const byCode: Record<string, (m: GameModule) => boolean> = {
    no_hud: (m) => /hud|ui|interface/i.test(m.id),
    no_juice: (m) => /render|draw|fx|effect/i.test(m.id),
    silent_build: (m) => /audio|sound|player|combat/i.test(m.id),
    no_artwork: (m) => /render|draw|entit|sprite/i.test(m.id),
    no_touch_input: (m) => /input|player|control/i.test(m.id),
    no_win_path: (m) => /progress|score|rule|level/i.test(m.id),
    no_lose_path: (m) => /progress|score|rule|level|collision/i.test(m.id),
    required_asset_unused: (m) => /render|draw|entit|sprite/i.test(m.id),
    collectible_not_visible: (m) => /entit|collect|spawn|render|draw/i.test(m.id),
    collectible_spawn_outside_viewport: (m) => /spawn|entit|collect/i.test(m.id),
    player_not_visible: (m) => /player|control|render|draw/i.test(m.id),
    player_input_no_visible_response: (m) => /player|control|input/i.test(m.id),
  };
  const match = byCode[finding.code];
  if (match) {
    const hit = systems.find(match);
    if (hit) return [hit.id];
  }

  // A runtime error names the thing that broke: "G.tickSpawns is not a
  // function", "cannot read properties of undefined (reading 'x')" on
  // G.player. Repairing the module that owns that name beats repairing main
  // by default, which is how a repair round ends up rewriting the one module
  // that was working.
  if (finding.code === "runtime_error") {
    const named = Array.from(finding.message.matchAll(/G\.([A-Za-z][A-Za-z0-9_]{0,40})/g)).map((m) => m[1]!);
    for (const name of named) {
      const owner = modules.find((m) => m.provides.includes(name));
      if (owner) return [owner.id];
    }
  }
  const fallback = main?.id ?? systems[0]?.id;
  return fallback ? [fallback] : [];
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
