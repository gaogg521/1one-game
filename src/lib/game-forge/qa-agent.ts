import { llmJson } from "@/lib/llm";
import { PRODUCT } from "@/lib/product-config";
import { resolveGameModelRoute } from "@/lib/game-model-route";
import type { RuntimeLocaleGroup } from "@/lib/runtime-providers";
import { auditSdkUsage, checkBalanced, checkSyntax, scanForbidden, stripCommentsAndStrings } from "@/lib/game-forge/assemble";
import { checkRoleContract } from "@/lib/game-forge/code-agent";
import type { GameDesignDoc, GameModule, QaFinding, QaReport } from "@/lib/game-forge/types";

/**
 * QA agent.
 *
 * Two independent sources of truth, deliberately kept apart:
 *  - deterministic checks over executable code, which predict crashes;
 *  - a model review, which judges whether the design was actually built.
 *
 * Neither invents evidence. `observed` stays false until a real engine has
 * executed the build, and the report says so.
 */

// auditSdkUsage lives in assemble.ts: code-agent.ts calls it during its own
// repair-attempt loop, and putting it there (instead of here) avoids a
// circular import between this file and code-agent.ts. Re-exported here so
// existing callers of qa-agent's auditSdkUsage keep working unchanged.
export { auditSdkUsage };

/** Whole-build facts a player would immediately notice. */
export function auditBuildShape(design: GameDesignDoc, modules: GameModule[]): QaFinding[] {
  const findings: QaFinding[] = [];
  const code = stripCommentsAndStrings(modules.map((m) => m.source).join("\n"));

  if (!/\bg\s*\.\s*(?:win|finish)\s*\(/.test(code)) {
    findings.push({ severity: "blocker", moduleId: "assembled", code: "no_win_path", message: `nothing calls g.win(); the win condition "${design.progression.winCondition}" is unreachable` });
  }
  if (!/\bg\s*\.\s*(?:lose|loseLife|finish)\s*\(/.test(code)) {
    findings.push({ severity: "blocker", moduleId: "assembled", code: "no_lose_path", message: `nothing calls g.lose() or g.loseLife(); the lose condition "${design.progression.loseCondition}" is unreachable` });
  }
  if (!/\bg\s*\.\s*assets\s*\.\s*image\s*\(/.test(code)) {
    findings.push({ severity: "major", moduleId: "assembled", code: "no_artwork", message: "the build never calls g.assets.image, so the generated artwork is unused and every actor is a bare shape" });
  }
  if (!/\baudio\s*\.\s*sfx\s*\(/.test(code)) {
    findings.push({ severity: "major", moduleId: "assembled", code: "silent_build", message: "no sound effects are triggered; the game will play silently" });
  }
  const touchAware = /\binput\s*\.\s*(?:axis|pointer|swipe|stick|button|touch)\b/.test(code);
  if (!touchAware) {
    findings.push({ severity: "blocker", moduleId: "assembled", code: "no_touch_input", message: "the build reads no pointer, swipe, stick or axis input; it cannot be played on a phone" });
  }
  if (!/\bfx\s*\.\s*(?:burst|shake|popText|flash|trail)\s*\(/.test(code)) {
    findings.push({ severity: "minor", moduleId: "assembled", code: "no_juice", message: "no particles, shake or floating text; impacts will read as flat" });
  }
  if (!/\bui\s*\.\s*(?:hud|hint|banner|progress)\s*\(/.test(code)) {
    findings.push({ severity: "major", moduleId: "assembled", code: "no_hud", message: "nothing renders a HUD or a first-frame hint; the player is not told what to do" });
  }

  const declaredKeys = design.assets.map((a) => a.key);
  const unusedRequired = design.assets
    .filter((a) => a.required && !new RegExp(`ctx\\s*\\.\\s*assets\\s*\\.\\s*${a.key}\\b`).test(code))
    .map((a) => a.key);
  if (unusedRequired.length) {
    findings.push({ severity: "major", moduleId: "assembled", code: "required_asset_unused", message: `required asset slots never read: ${unusedRequired.join(", ")} (declared: ${declaredKeys.join(", ")})` });
  }

  return findings;
}

const REVIEW_SCHEMA = {
  name: "qa_review",
  strict: false,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["findings"],
    properties: {
      findings: {
        type: "array", maxItems: 14,
        items: {
          type: "object", additionalProperties: false,
          required: ["severity", "moduleId", "code", "message"],
          properties: {
            severity: { type: "string", enum: ["blocker", "major", "minor"] },
            moduleId: { type: "string" },
            code: { type: "string" },
            message: { type: "string" },
          },
        },
      },
    },
  },
} as const;

function reviewSystemPrompt(): string {
  return `You are the QA engineer for a browser game studio. You read a design document and the code that was written from it, and you report only defects you can point at in the code.

Judge these, in order:
1. Does each mechanic in the design actually exist in the code as running behaviour? A name in a comment, a variable called after it, or a constant that is never read is NOT an implementation. Report it as a blocker if the mechanic is central and absent.
2. Is the win condition reachable by playing, and the lose condition reachable by playing badly? Trace it.
3. Would the first frame tell a new player what to do, and does the first input do something visible?
4. Is the loop 30-90 seconds, with the difficulty beats the design promised?
5. Are there crashes waiting: reading a property of something that can be undefined, iterating an array while removing from it, dividing by a value that can be zero, using an entity after it was killed.

## What is already in scope (never report these as undefined)

You are shown module bodies in isolation, but they are assembled into one file
before they run:

    function mountGame(root, ctx) {
      var G = { ctx: ctx, ... };
      function MOD_<id>(G, g) { <module body> }   // config modules get (G) only
      var g = GameForge.create(root, { ...G.config });
      MOD_<id>(G, g); ...
      G.main(g);
    }

So inside every module body these identifiers are always bound by the
enclosing scope: "ctx" (with ctx.assets.<key>, ctx.title, ctx.winScore,
ctx.finish), "G" (the shared namespace), and "g" (the engine handle; not
available in a config module). A module reading ctx.assets or calling a
sibling through G is correct, not a missing reference.

Rules:
- Report a defect only when you can name the module and the specific code that is wrong or missing. No style opinions, no speculation, no "consider adding".
- moduleId must be one of the module ids given to you, or "assembled".
- If the build is sound, return an empty findings array. Do not invent problems to look thorough.

Return JSON only, in exactly this shape:
{"findings": [{"severity": "blocker" | "major" | "minor", "moduleId": "<one of the module ids, or assembled>", "code": "<short_snake_case_code>", "message": "<what is wrong and where>"}]}
A sound build is {"findings": []}.`;
}

function reviewUserPrompt(design: GameDesignDoc, modules: GameModule[]): string {
  return [
    "DESIGN DOCUMENT",
    `Title: ${design.title}`,
    `Pitch: ${design.pitch}`,
    `Core loop:\n${design.coreLoop.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}`,
    `Mechanics that must be implemented:\n${design.mechanics.map((m) => `  - ${m.id}: ${m.summary}\n    observable: ${m.observable}`).join("\n")}`,
    `Win: ${design.progression.winCondition}`,
    `Lose: ${design.progression.loseCondition}`,
    `Controls:\n${design.controls.map((c) => `  - ${c.action}: desktop=${c.desktop} touch=${c.touch}`).join("\n")}`,
    "",
    "MODULES AS BUILT",
    ...modules.map((m) => `\n--- module ${m.id} (${m.role}) ---\n${m.source.slice(0, 14_000)}`),
    "",
    "Report the defects.",
  ].join("\n");
}

export type QaAgentOptions = {
  prompt: string;
  localeGroup?: RuntimeLocaleGroup;
  /** Skip the model review when a caller only needs deterministic facts. */
  staticOnly?: boolean;
  /** Force the model review even when the deterministic audit found nothing. */
  alwaysReview?: boolean;
};

/**
 * Counts the top-level (comma-separated) arguments in a call whose "("
 * starts at `openParenIndex`. Returns null if the parens never balance
 * (truncated source — `checkBalanced` already reports that separately).
 */
function countCallArgs(code: string, openParenIndex: number): number | null {
  let depth = 0;
  let commas = 0;
  let sawContent = false;
  for (let i = openParenIndex; i < code.length; i += 1) {
    const ch = code[i]!;
    if (ch === "(" || ch === "[" || ch === "{") depth += 1;
    else if (ch === ")" || ch === "]" || ch === "}") {
      depth -= 1;
      if (depth === 0) return sawContent ? commas + 1 : 0;
    } else if (depth === 1 && ch === "," ) commas += 1;
    else if (!/\s/.test(ch)) sawContent = true;
  }
  return null;
}

/**
 * Cross-checks every call to a declared `provides` name against its declared
 * parameter count. Independent code agents only ever see a name string for a
 * sibling unless the design gave it a signature — this is the deterministic
 * half of the fix: it catches a caller that passes the wrong number of
 * arguments to a cross-module function, the exact shape of bug that let
 * modules silently disagree on a calling convention.
 */
export function auditCallSignatures(design: GameDesignDoc, modules: GameModule[]): QaFinding[] {
  const sigByName = new Map<string, { params: string[]; owner: string }>();
  /** Provided names with no signature: data on G, not callables. */
  const dataByName = new Map<string, string>();
  for (const plan of design.modules) {
    const signed = new Set((plan.signatures ?? []).map((s) => s.name));
    for (const sig of plan.signatures ?? []) {
      if (!sigByName.has(sig.name)) sigByName.set(sig.name, { params: sig.params, owner: plan.id });
    }
    for (const name of plan.provides ?? []) {
      if (!signed.has(name) && !dataByName.has(name)) dataByName.set(name, plan.id);
    }
  }

  const findings: QaFinding[] = [];

  // Calling a data value is an immediate first-frame TypeError, and it is what
  // happens whenever the plan lets `config` look callable.
  for (const mod of modules) {
    const code = stripCommentsAndStrings(mod.source);
    for (const [name, owner] of dataByName) {
      const called = new RegExp(`G\\s*\\.\\s*${name}\\s*\\(`).test(code);
      if (!called) continue;
      findings.push({
        severity: "blocker",
        moduleId: mod.id,
        code: "data_called_as_function",
        message: `calls G.${name}(...) but ${owner} exposes G.${name} as a data value, not a function — read its fields (G.${name}.someField) instead; calling it throws "G.${name} is not a function" on the first frame`,
      });
    }
  }

  if (!sigByName.size) return findings;
  for (const mod of modules) {
    const code = stripCommentsAndStrings(mod.source);
    for (const [name, sig] of sigByName) {
      const re = new RegExp(`G\\s*\\.\\s*${name}\\s*\\(`, "g");
      let m: RegExpExecArray | null = re.exec(code);
      while (m) {
        const openParen = m.index + m[0].length - 1;
        const argCount = countCallArgs(code, openParen);
        if (argCount !== null && argCount !== sig.params.length) {
          findings.push({
            severity: "blocker",
            moduleId: mod.id,
            code: "signature_mismatch",
            message: `calls G.${name}(...) with ${argCount} argument(s), but ${sig.owner} declared it as G.${name}(${sig.params.join(", ")}) — ${sig.params.length} argument(s). Positional arguments will not line up.`,
          });
        }
        m = re.exec(code);
      }
    }
  }
  return findings;
}

/**
 * Cross-checks config reads against the design's declared `configShape`.
 * Every declared path is namespaced (e.g. "player.jumpVelocity"): a module
 * reading `cfg.jumpVelocity` directly — the leaf name with the namespace
 * dropped — is the config-era counterpart of a call-signature mismatch, and
 * it fails silently instead of crashing, which is exactly what made it hard
 * to spot before this check existed.
 */
export function auditConfigPaths(design: GameDesignDoc, modules: GameModule[]): QaFinding[] {
  const shape = design.configShape ?? [];
  if (!shape.length) return [];
  const namespaces = new Set(shape.map((p) => p.split(".")[0]!));
  const leafOwner = new Map<string, string>(); // leaf name -> full declared path
  for (const path of shape) {
    const leaf = path.split(".").pop()!;
    if (!leafOwner.has(leaf)) leafOwner.set(leaf, path);
  }

  const findings: QaFinding[] = [];
  for (const mod of modules) {
    if (mod.role === "config") continue; // the config module defines the shape, it doesn't consume it
    const code = stripCommentsAndStrings(mod.source);
    const re = /\bcfg\s*\.\s*([A-Za-z_$][\w$]*)/g;
    const flaggedHere = new Set<string>();
    let m: RegExpExecArray | null = re.exec(code);
    while (m) {
      const name = m[1]!;
      if (!namespaces.has(name) && leafOwner.has(name) && !flaggedHere.has(name)) {
        flaggedHere.add(name);
        findings.push({
          severity: "blocker",
          moduleId: mod.id,
          code: "config_path_flattened",
          message: `reads cfg.${name} directly, but the design declares it nested as cfg.${leafOwner.get(name)}. Read through the full path — a flattened read silently gets undefined and falls back to a hardcoded default instead of the configured value.`,
        });
      }
      m = re.exec(code);
    }
  }
  return findings;
}

/** Names the assembler itself puts on G, so they are never "undeclared". */
const ASSEMBLER_PROVIDED = new Set(["ctx", "design", "g", "config", "main"]);

/**
 * Flags reads of a `G.<name>` that no module in the plan provides.
 *
 * This is the mirror image of the signature check, and it catches a failure
 * that is invisible to every other audit: an observed build had both
 * `updatePlayer` and `checkCollisions` open with
 * `var player = G.player; if (!player) return;` while nothing ever assigned
 * `G.player`. The code parsed, ran, threw nothing, drew a frame — and both
 * core systems returned immediately on every tick, so the game did nothing at
 * all. A silent no-op is worse than a crash, because QA sees a green build.
 */
export function auditSharedStateReads(design: GameDesignDoc, modules: GameModule[]): QaFinding[] {
  const provided = new Set<string>(ASSEMBLER_PROVIDED);
  for (const plan of design.modules) for (const name of plan.provides ?? []) provided.add(name);
  // A module may also assign onto G directly without declaring it in the plan;
  // that is untidy but not a defect, so treat it as provided.
  for (const mod of modules) {
    const assignRe = /\bG\s*\.\s*([A-Za-z_$][\w$]*)\s*=/g;
    let m: RegExpExecArray | null = assignRe.exec(stripCommentsAndStrings(mod.source));
    while (m) { provided.add(m[1]!); m = assignRe.exec(stripCommentsAndStrings(mod.source)); }
  }

  const findings: QaFinding[] = [];
  for (const mod of modules) {
    const code = stripCommentsAndStrings(mod.source);
    const readRe = /\bG\s*\.\s*([A-Za-z_$][\w$]*)/g;
    const flagged = new Set<string>();
    let m: RegExpExecArray | null = readRe.exec(code);
    while (m) {
      const name = m[1]!;
      if (!provided.has(name) && !flagged.has(name)) {
        flagged.add(name);
        findings.push({
          severity: "blocker",
          moduleId: mod.id,
          code: "undeclared_shared_state",
          message: `reads G.${name}, but no module provides or assigns it — it is permanently undefined. Code like "var x = G.${name}; if (!x) return;" then makes this function a silent no-op on every frame instead of failing loudly.`,
        });
      }
      m = readRe.exec(code);
    }
  }
  return findings;
}

/** Deterministic pass only. Cheap, and safe to run inside unit tests. */
export function auditStatic(design: GameDesignDoc, modules: GameModule[]): QaFinding[] {
  const findings: QaFinding[] = [];
  for (const m of modules) {
    findings.push(...scanForbidden(m.id, m.source));
    findings.push(...checkBalanced(m.id, m.source));
    findings.push(...checkSyntax(m.id, m.source, m.role));
    findings.push(...auditSdkUsage(m.id, m.source));
    const plan = design.modules.find((p) => p.id === m.id);
    if (plan) findings.push(...checkRoleContract(plan, m.source));
  }
  findings.push(...auditBuildShape(design, modules));
  findings.push(...auditCallSignatures(design, modules));
  findings.push(...auditConfigPaths(design, modules));
  findings.push(...auditSharedStateReads(design, modules));
  return findings;
}

export async function runQaAgent(
  design: GameDesignDoc,
  modules: GameModule[],
  opts: QaAgentOptions,
): Promise<QaReport> {
  const findings = auditStatic(design, modules);
  const evidence: string[] = [
    `static:modules=${modules.length}`,
    `static:findings=${findings.length}`,
    `static:blockers=${findings.filter((f) => f.severity === "blocker").length}`,
  ];

  // The model review costs ~30s. When the deterministic audit is completely
  // clean it has historically had nothing to add, and a creator waiting on a
  // build feels that half-minute — so spend it only when something already
  // looks wrong, or when the caller explicitly asks for a full review.
  // Only a blocker or a major is worth 60s of a creator's wait. Observed: a
  // build whose sole findings were two "unknown_sfx" minors spent a full
  // review budget and learned nothing -- the review is there to judge whether
  // the game is any good, not to re-read a cosmetic note the audit already
  // wrote down precisely.
  const deterministicClean = !findings.some((f) => f.severity === "blocker" || f.severity === "major");
  if (deterministicClean && !opts.alwaysReview) {
    evidence.push(`review:skipped=no_blocking_findings(${findings.length} minor)`);
  } else if (!opts.staticOnly) {
    const route = resolveGameModelRoute({ prompt: opts.prompt, localeGroup: opts.localeGroup });
    if (route.models.length) {
      const result = await llmJson({
        model: route.models[0]!,
        scene: route.scene,
        localeGroup: opts.localeGroup,
        strictSceneModel: true,
        system: reviewSystemPrompt(),
        user: reviewUserPrompt(design, modules),
        temperature: 0.2,
        // json_schema -- REVERTED 2026-09-07 alongside the design-agent call
        // for the same reason: this scene's production model
        // (deepseek-v4-flash-ga-260731) was measured to never terminate on
        // json_object for a real prompt from this pipeline, while json_schema
        // reliably finishes. See design-agent.ts for the isolated production
        // measurements. Not forcing singleModeOnly leaves the existing
        // dual-mode fallback available for whichever other model this scene
        // might route to.
        mode: "json_schema",
        jsonSchema: REVIEW_SCHEMA,
        maxTokens: 4_096,
        timeoutMs: PRODUCT.gameForge.reviewTimeoutMs,
      });
      if (result.ok) {
        // Without a schema to lean on, a model sometimes answers with the bare
        // array it was asked to fill. That is the same answer, differently
        // wrapped -- reading it is not the same as inventing it.
        const raw = result.raw as { findings?: unknown } | unknown[];
        const list = Array.isArray(raw) ? raw : Array.isArray((raw as { findings?: unknown }).findings) ? ((raw as { findings: unknown[] }).findings) : [];
        const knownIds = new Set([...modules.map((m) => m.id), "assembled"]);
        for (const item of list) {
          const f = item as Partial<QaFinding>;
          if (!f || typeof f.message !== "string" || typeof f.code !== "string") continue;
          findings.push({
            severity: f.severity === "blocker" || f.severity === "major" ? f.severity : "minor",
            moduleId: typeof f.moduleId === "string" && knownIds.has(f.moduleId) ? f.moduleId : "assembled",
            code: f.code.slice(0, 60),
            message: f.message.slice(0, 400),
          });
        }
        evidence.push(`review:model=${result.model}`, `review:findings=${list.length}`);
      } else {
        evidence.push(`review:unavailable=${result.error ?? "model_failed"}`);
      }
    } else {
      evidence.push("review:unavailable=model_missing");
    }
  }

  return {
    ok: !findings.some((f) => f.severity === "blocker"),
    // Nothing here executed the build. A runtime probe sets this to true.
    observed: false,
    findings,
    evidence,
  };
}
