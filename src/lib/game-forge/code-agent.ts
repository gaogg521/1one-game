import { llmJson } from "@/lib/llm";
import { PRODUCT } from "@/lib/product-config";
import { resolveGameModelRoute } from "@/lib/game-model-route";
import type { RuntimeLocaleGroup } from "@/lib/runtime-providers";
import { GAME_FORGE_SDK_REFERENCE } from "@/lib/game-forge/sdk-reference";
import { auditSdkUsage, checkBalanced, checkSyntax, scanForbidden } from "@/lib/game-forge/assemble";
import type { GameDesignDoc, GameModule, ModulePlan, QaFinding } from "@/lib/game-forge/types";

/**
 * Code agents.
 *
 * One agent per module. Each completion carries the whole module budget rather
 * than sharing a single ceiling with the entire game, and modules that do not
 * depend on each other are generated concurrently.
 */

const MODULE_SCHEMA = {
  name: "game_module",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["source"],
    properties: { source: { type: "string", minLength: 40 } },
  },
} as const;

function designSummary(design: GameDesignDoc): string {
  return [
    `TITLE: ${design.title}`,
    `PITCH: ${design.pitch}`,
    `GENRE: ${design.genre}`,
    `STAGE: ${design.stage.width}x${design.stage.height} ${design.stage.orientation}, background ${design.stage.background}`,
    `CORE LOOP:\n${design.coreLoop.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}`,
    `CONTROLS:\n${design.controls.map((c) => `  - ${c.action}: desktop=${c.desktop} touch=${c.touch}`).join("\n")}`,
    `MECHANICS:\n${design.mechanics.map((m) => `  - ${m.id}: ${m.summary} (observable: ${m.observable})`).join("\n")}`,
    `WIN: ${design.progression.winCondition}`,
    `LOSE: ${design.progression.loseCondition}`,
    `BEATS:\n${design.progression.beats.map((b) => `  - ${(b.at * 100).toFixed(0)}%: ${b.label} — ${b.change}`).join("\n")}`,
    `GAME FEEL:\n${design.gameFeel.map((s) => `  - ${s}`).join("\n")}`,
    `CONFIG SHAPE — G.config has EXACTLY this nested shape, nothing else. Read every tuning value through these exact dotted paths (e.g. cfg.player.jumpVelocity), never a flattened top-level field (never cfg.jumpVelocity):\n${design.configShape.map((p) => `  - cfg.${p}`).join("\n") || "  - (no config module in this plan)"}`,
    `AUDIO CUES:\n${design.audio.cues.map((c) => `  - on ${c.event} play g.audio.sfx('${c.sfx}')`).join("\n") || "  - choose sensible cues from the SDK list"}`,
    `ASSET KEYS available on ctx.assets (any may be undefined; g.assets.image falls back):\n${design.assets.map((a) => `  - ctx.assets.${a.key} (${a.kind}): ${a.prompt}`).join("\n")}`,
  ].join("\n");
}

/**
 * Renders one provided name. A name with a declared signature is callable and
 * shown with its exact parameter list; a name without one is a DATA value and
 * must be shown as such, or a consumer will call it and crash with
 * "G.x is not a function".
 */
function signatureLine(plan: ModulePlan, name: string): string {
  const sig = plan.signatures.find((s) => s.name === name);
  return sig ? `G.${sig.name}(${sig.params.join(", ")})` : `G.${name}  (data value — read its fields, never call it)`;
}

function moduleContract(design: GameDesignDoc, plan: ModulePlan): string {
  const others = design.modules.filter((m) => m.id !== plan.id);
  const requiredSignatures = plan.requires
    .map((name) => {
      const owner = design.modules.find((m) => m.provides.includes(name));
      return owner ? { name, owner: owner.id, line: signatureLine(owner, name) } : null;
    })
    .filter((x): x is { name: string; owner: string; line: string } => x !== null);
  return [
    `THIS MODULE: ${plan.id} (role ${plan.role})`,
    `BRIEF: ${plan.brief}`,
    `IT MUST ASSIGN (call EXACTLY with this parameter order, no more no fewer args):`,
    plan.provides.length ? plan.provides.map((p) => `  - ${signatureLine(plan, p)}`).join("\n") : "  (nothing beyond its brief)",
    `IT MAY CALL (defined by a sibling — you MUST match this exact signature, do not reorder or add/drop arguments):`,
    requiredSignatures.length ? requiredSignatures.map((s) => `  - ${s.line}  [from module ${s.owner}]`).join("\n") : "  (only G.config and ctx)",
    "",
    "SIBLING MODULES built in parallel by other agents — call into them, do not reimplement them:",
    ...others.map((m) => `  - ${m.id} (${m.role}): ${m.brief.slice(0, 200)}\n    provides: ${m.provides.map((p) => signatureLine(m, p)).join(", ") || "(nothing)"}`),
  ].join("\n");
}

function systemPrompt(): string {
  return `You are a game runtime engineer. You write ONE module of a browser game that other agents are building in parallel around you.

${GAME_FORGE_SDK_REFERENCE}

## Module contract

You output the BODY of a function. Do not write the function signature, do not wrap it in braces, do not return anything.

- A "config" module body receives (G). It only assigns G.config = { ... }.
- A "system" module body receives (G, g). g is the live GameForge engine.
- A "main" module body receives (G, g) and must assign G.main = function (g) { ... g.start({ init, update, draw, restart }); }.

G is the shared namespace. Everything you expose goes on G. Everything a sibling exposes is read from G.

CRITICAL syntax rule: expose a function by ASSIGNING it —
    G.tickSpawns = function (dt, g) { ... };
Writing "function G.tickSpawns(dt, g) { ... }" is NOT valid JavaScript. It looks
right and its braces balance, but it fails to parse, and a parse error anywhere
takes down the entire assembled game, so nothing renders at all.

CRITICAL ordering rule: modules run in dependency order, but sibling functions are late-bound. Read G.somethingFromASibling INSIDE your functions, never at the top level of your body. Top-level code in your module may only touch G.config, ctx and the engine.

CRITICAL signature rule: the prompt below lists an exact signature for everything you must assign and everything you are allowed to call. Match parameter COUNT and ORDER exactly — a sibling module was written against that exact signature and passes arguments positionally, not by name. Do not add, drop, or reorder parameters, and do not invent a call to a name that was not given a signature.

CRITICAL state rule: there are exactly two places state may live, never a third.
1. Private state only this module's own functions touch: a plain "var" at the TOP of your module body (outside any function). It survives via closure because your module body runs once at boot; every function you assign onto G that was declared in this same body can still read and write it.
2. State other modules must also read or write: a field on G itself (e.g. G.runState = {...}, then every module reads/writes G.runState.someField).
"g" (lowercase) is the fixed engine handle described above — it already has everything it will ever have. Never assign a new property onto "g" (no g.runState, no g.myFlag, no g.anything not in this reference) — the engine does not reserve space for it, other modules will not see it, and QA will reject it outright.

## Quality bar

Write the module as if it ships. Specifically:
- Use real numbers, not placeholders. Tune them so the loop feels right at 60fps.
- Use the project artwork: g.assets.image(ctx.assets.<key>, '<kind>', '<fallback color>'). Draw sprites, not bare rectangles, for anything the player reads as a character or object.
- Fire g.audio.sfx(...) on every meaningful event.
- Add juice where the design asks for it: g.fx.burst on impacts, g.fx.shake on damage, g.fx.popText on scoring, g.fx.freeze on heavy hits, tweens on UI.
- Handle the touch path. If the design says an action is a tap or a swipe, implement it from g.input, and draw its on-screen affordance.
- Guard against divide-by-zero, empty arrays and entities being killed mid-iteration.

Return JSON only: {"source": "<the function body>"}.`;
}

function userPrompt(design: GameDesignDoc, plan: ModulePlan): string {
  return [designSummary(design), "", "---", "", moduleContract(design, plan), "", "Write the body of this module now."].join("\n");
}

function repairPrompt(design: GameDesignDoc, plan: ModulePlan, previous: string, findings: QaFinding[]): string {
  return [
    userPrompt(design, plan),
    "",
    "---",
    "",
    "Your previous attempt at this module was rejected:",
    ...findings.map((f) => `  - [${f.severity}] ${f.code}: ${f.message}`),
    "",
    "Return the complete corrected body. Previous attempt:",
    previous.slice(0, 24_000),
  ].join("\n");
}

export type ModuleAgentResult =
  | { ok: true; module: GameModule; durationMs: number }
  | { ok: false; moduleId: string; reason: string; findings: QaFinding[] };

async function generateModule(
  design: GameDesignDoc,
  plan: ModulePlan,
  models: string[],
  scene: ReturnType<typeof resolveGameModelRoute>["scene"],
  localeGroup?: RuntimeLocaleGroup,
  seed?: { previous: string; findings: QaFinding[] },
): Promise<ModuleAgentResult> {
  const cfg = PRODUCT.gameForge;
  const startedAt = Date.now();
  let previous = seed?.previous ?? "";
  let findings: QaFinding[] = seed?.findings ?? [];
  let lastReason = seed ? "module_repair_pending" : "module_empty";

  for (const model of models.slice(0, 2)) {
    for (let attempt = 0; attempt < cfg.moduleAttempts; attempt += 1) {
      const isRepair = attempt > 0 || Boolean(previous);
      const result = await llmJson({
        model,
        scene,
        localeGroup,
        strictSceneModel: true,
        system: systemPrompt(),
        user: isRepair ? repairPrompt(design, plan, previous, findings) : userPrompt(design, plan),
        temperature: attempt === 0 ? 0.45 : 0.24,
        mode: "json_schema",
        jsonSchema: MODULE_SCHEMA,
        maxTokens: cfg.moduleMaxTokens,
        timeoutMs: cfg.moduleTimeoutMs,
      });
      if (!result.ok) { lastReason = result.error ?? "module_model_failed"; continue; }
      const raw = result.raw as { source?: unknown };
      const source = typeof raw.source === "string" ? raw.source : "";
      if (source.trim().length < 40) { lastReason = "module_source_too_short"; continue; }
      previous = source;

      // The narrower checks alone (forbidden patterns, balance, role contract)
      // used to let a module through even when it still hallucinated an SDK
      // member — that member would surface again in the outer QA pass a full
      // round later, which is why repairs used to plateau on the same finding
      // for two rounds. Auditing SDK usage here means a repair attempt is
      // rejected and retried within its OWN attempt budget instead of being
      // accepted and waiting for the next round to notice.
      findings = [...scanForbidden(plan.id, source), ...checkBalanced(plan.id, source), ...checkSyntax(plan.id, source, plan.role), ...auditSdkUsage(plan.id, source)];
      findings.push(...checkRoleContract(plan, source));
      const blockers = findings.filter((f) => f.severity === "blocker");
      if (blockers.length) { lastReason = blockers.map((b) => b.code).join(","); continue; }

      return {
        ok: true,
        durationMs: Date.now() - startedAt,
        module: {
          id: plan.id,
          role: plan.role,
          source,
          provides: plan.provides,
          requires: plan.requires,
          model: result.model,
        },
      };
    }
  }
  return { ok: false, moduleId: plan.id, reason: lastReason, findings };
}

/** Each role owes the assembler a specific assignment. */
export function checkRoleContract(plan: ModulePlan, source: string): QaFinding[] {
  const out: QaFinding[] = [];
  if (plan.role === "config" && !/\bG\s*\.\s*config\s*=/.test(source)) {
    out.push({ severity: "blocker", moduleId: plan.id, code: "config_unassigned", message: "a config module must assign G.config = { ... }" });
  }
  if (plan.role === "main" && !/\bG\s*\.\s*main\s*=/.test(source)) {
    out.push({ severity: "blocker", moduleId: plan.id, code: "main_unassigned", message: "a main module must assign G.main = function (g) { ... }" });
  }
  if (plan.role === "main" && !/\bg\s*\.\s*start\s*\(/.test(source)) {
    out.push({ severity: "blocker", moduleId: plan.id, code: "start_missing", message: "the main module must call g.start({ init, update, draw })" });
  }
  for (const name of plan.provides) {
    const re = new RegExp(`\\bG\\s*\\.\\s*${name}\\s*=`);
    if (!re.test(source)) {
      out.push({ severity: "major", moduleId: plan.id, code: "provide_missing", message: `the plan promises G.${name} but the module never assigns it` });
    }
  }
  return out;
}

/** Runs a list of tasks with a bounded number in flight. */
async function pooled<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let cursor = 0;
  const workers = new Array(Math.max(1, Math.min(limit, items.length))).fill(0).map(async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      out[index] = await fn(items[index]!);
    }
  });
  await Promise.all(workers);
  return out;
}

export type CodeAgentResult = {
  modules: GameModule[];
  failures: Array<{ moduleId: string; reason: string }>;
  durationMs: number;
};

/**
 * Generates every module of the build.
 *
 * Three waves: config, then all systems concurrently, then main. Systems can
 * run together because cross-module references are late-bound through G, so
 * only top-level ordering matters and the assembler owns that.
 */
export async function runCodeAgents(
  design: GameDesignDoc,
  opts: { prompt: string; localeGroup?: RuntimeLocaleGroup } ,
): Promise<CodeAgentResult> {
  const route = resolveGameModelRoute({ prompt: opts.prompt, localeGroup: opts.localeGroup });
  const startedAt = Date.now();
  const modules: GameModule[] = [];
  const failures: Array<{ moduleId: string; reason: string }> = [];
  if (!route.models.length) {
    return { modules, failures: [{ moduleId: "*", reason: "code_agent_model_missing" }], durationMs: 0 };
  }

  const run = (plan: ModulePlan) => generateModule(design, plan, route.models, route.scene, opts.localeGroup);
  const collect = (results: ModuleAgentResult[]) => {
    for (const r of results) {
      if (r.ok) modules.push(r.module);
      else failures.push({ moduleId: r.moduleId, reason: r.reason });
    }
  };

  const configPlans = design.modules.filter((m) => m.role === "config");
  const systemPlans = design.modules.filter((m) => m.role === "system");
  const mainPlans = design.modules.filter((m) => m.role === "main");

  collect(await pooled(configPlans, 1, run));
  collect(await pooled(systemPlans, PRODUCT.gameForge.moduleConcurrency, run));
  collect(await pooled(mainPlans, 1, run));

  return { modules, failures, durationMs: Date.now() - startedAt };
}

export { generateModule, systemPrompt as buildModuleSystemPrompt, userPrompt as buildModuleUserPrompt, repairPrompt as buildModuleRepairPrompt };
