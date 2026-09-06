import { llmJson } from "@/lib/llm";
import { PRODUCT } from "@/lib/product-config";
import { resolveGameModelRoute } from "@/lib/game-model-route";
import type { RuntimeLocaleGroup } from "@/lib/runtime-providers";
import { GameDesignDocSchema, type GameDesignDoc } from "@/lib/game-forge/types";

/**
 * Design agent.
 *
 * Owns what the game IS. Its output is the only brief the code agents see, so
 * everything the request implies has to survive into this document — the old
 * pipeline lost it by handing the code model seven scalar fields.
 */

const DESIGN_SCHEMA = {
  name: "game_design_doc",
  strict: false,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["title", "pitch", "genre", "stage", "coreLoop", "controls", "mechanics", "progression", "gameFeel", "configShape", "assets", "audio", "modules"],
    properties: {
      title: { type: "string" },
      pitch: { type: "string" },
      genre: { type: "string" },
      stage: {
        type: "object",
        additionalProperties: false,
        required: ["width", "height", "orientation", "background"],
        properties: {
          width: { type: "integer" },
          height: { type: "integer" },
          orientation: { type: "string", enum: ["landscape", "portrait", "either"] },
          background: { type: "string" },
        },
      },
      coreLoop: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 10 },
      controls: {
        type: "array", minItems: 1, maxItems: 8,
        items: {
          type: "object", additionalProperties: false,
          required: ["action", "desktop", "touch"],
          properties: { action: { type: "string" }, desktop: { type: "string" }, touch: { type: "string" } },
        },
      },
      mechanics: {
        type: "array", minItems: 2, maxItems: 12,
        items: {
          type: "object", additionalProperties: false,
          required: ["id", "summary", "observable"],
          properties: { id: { type: "string" }, summary: { type: "string" }, observable: { type: "string" } },
        },
      },
      progression: {
        type: "object", additionalProperties: false,
        required: ["winCondition", "loseCondition", "beats"],
        properties: {
          winCondition: { type: "string" },
          loseCondition: { type: "string" },
          beats: {
            type: "array", minItems: 2, maxItems: 8,
            items: {
              type: "object", additionalProperties: false,
              required: ["at", "label", "change"],
              properties: { at: { type: "number" }, label: { type: "string" }, change: { type: "string" } },
            },
          },
        },
      },
      gameFeel: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 10 },
      configShape: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 40 },
      assets: {
        type: "array", minItems: 1, maxItems: 16,
        items: {
          type: "object", additionalProperties: false,
          required: ["key", "kind", "prompt", "required"],
          properties: {
            key: { type: "string" },
            kind: { type: "string", enum: ["background", "player", "enemy", "enemy_alt", "boss", "collectible", "power", "projectile", "obstacle", "platform", "prop", "tile", "ui_icon"] },
            prompt: { type: "string" },
            color: { type: "string" },
            width: { type: "integer" },
            height: { type: "integer" },
            required: { type: "boolean" },
          },
        },
      },
      audio: {
        type: "object", additionalProperties: false,
        required: ["cues"],
        properties: {
          cues: {
            type: "array", maxItems: 14,
            items: { type: "object", additionalProperties: false, required: ["event", "sfx"], properties: { event: { type: "string" }, sfx: { type: "string" } } },
          },
          musicMood: { type: "string" },
        },
      },
      modules: {
        type: "array", minItems: 2, maxItems: 9,
        items: {
          type: "object", additionalProperties: false,
          required: ["id", "role", "brief", "provides", "requires", "signatures"],
          properties: {
            id: { type: "string" },
            role: { type: "string", enum: ["config", "system", "main"] },
            brief: { type: "string" },
            provides: { type: "array", items: { type: "string" } },
            requires: { type: "array", items: { type: "string" } },
            signatures: {
              type: "array",
              items: {
                type: "object", additionalProperties: false,
                required: ["name", "params"],
                properties: {
                  name: { type: "string" },
                  params: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

function systemPrompt(): string {
  return `You are the design director of a browser game studio. You turn one player request into a build-ready design document that specialist code agents implement without asking further questions.

The runtime is a 2D canvas engine that already provides: the game loop, a DPI-correct scaled canvas, unified keyboard/mouse/touch input with an automatic on-screen stick, procedural sound effects, particles, screen shake, tweens, an entity pool with circle collision, a HUD and a win/lose end card. Design for that engine. Do not design around 3D, physics engines, networking, servers, save files or asset formats it does not have.

Rules that decide whether the build succeeds:

1. Be specific to THIS request. Name the actual subject matter in the title, the mechanics and the asset prompts. A generic arena, a click counter or a reskinned dodge-the-blocks is a failure.
2. Every mechanic must be implementable in canvas 2D and observable by a player within 90 seconds. Give each one an "observable" describing what a tester would see on screen.
3. The game must be winnable AND losable in 30-90 seconds. State both conditions concretely with numbers.
4. Controls must work on a phone. Every action needs a touch binding: virtual stick, tap, swipe, hold, or an on-screen button.
5. Asset slots: request only what the game actually draws, 4-12 slots is typical. Write each prompt for an image generator — subject, style, view angle, transparent background for actors. Mark "required" only for slots the game cannot read as intended without.

## Exact field formats (violating these fails validation, not taste)

- stage.background: a CSS color only, e.g. "#0b1020" or "#132a4a" — 24 characters max. Never a scene description; describe the scene in the asset prompt for the background slot instead.
- progression.beats[].at: a fraction of the run's total duration, strictly between 0 and 1 (0.3 means "30% of the way through the run"). Never a raw second count, never above 1.
- modules[].provides and modules[].requires: valid JavaScript identifiers only — ASCII letters, digits and underscore, starting with a letter, max 40 characters. Never Chinese characters, spaces, hyphens or dots. Example: "spawnGuard", "trapCollision", "playerJump".
- configShape: every dotted path the config module will assign onto G.config, e.g. "player.jumpVelocity", "goals.targetShoots", "run.duration". Every path needs at least one dot — group related numbers under a shared top-level namespace (player.*, goals.*, run.*, enemy.*, ...), never a flat top-level field. This is the ONLY place config nesting is decided; every module that reads config is shown this exact list and must use these exact paths, so an inconsistent or flat config is what causes tuning values to silently not apply.
- Every other free-text field (title, pitch, mechanics, control labels, hints) is written in the player's own language from the request; only the identifiers above must stay ASCII.

## The module plan

You must split the implementation into 4-7 modules. This is the most important part of the document: each module is written by a separate agent that sees only the shared design and its own brief, so the briefs must be unambiguous and non-overlapping.

- Exactly one module has role "config": it assigns G.config (stage size, tuning numbers, colors, balance constants). No behaviour.
- Exactly one module has role "main": it assigns G.main = function (g) { ... g.start({ init, update, draw, restart }) }. It wires the other modules together and owns the frame callbacks.
- The rest have role "system": entities, spawning, player control, enemy AI, collision resolution, scoring, level progression, rendering helpers, HUD.
- "provides" lists the names a module assigns onto the shared G object. "requires" lists the names it reads. Keep this graph acyclic: config provides, systems build on config, main consumes everything.
- Name things concretely for this game (G.spawnWave, G.updateHooks, G.drawTrack), not abstractly (G.helpers, G.utils).
- "signatures" is mandatory and is the single most important field for making independent agents interoperate: for EVERY entry in "provides", give its exact parameter list, in call order, using short conventional names — "g" for the engine handle, "dt" for delta time, plain nouns for game objects ("player", "trap", "state"). Every module that calls a sibling's function will be shown this exact signature and told to match it exactly; a module that defines a function must also follow the parameter order it declared here. Fix the convention once, here, rather than leaving each agent to guess: engine-consuming functions take (g, ...) or (..., g) — pick one order and use it for every signature in this design; state-mutating functions take the piece of state they change first.

Return JSON only.`;
}

function userPrompt(prompt: string, hints: { title?: string; brief?: string | null; winScore?: number }): string {
  const lines = [
    `Player request (verbatim, in the player's own language): ${prompt}`,
  ];
  if (hints.title) lines.push(`Working title from the draft stage: ${hints.title}`);
  if (hints.brief) lines.push(`Creative brief already produced for this request:\n${hints.brief.slice(0, 4000)}`);
  if (hints.winScore) lines.push(`Draft target score: ${hints.winScore}`);
  lines.push(
    "",
    "Write the design document. Honour the request literally: if it names a subject, a setting, a control scheme, a number of rounds, an enemy type or a progression rule, that detail must appear in the mechanics and in the module briefs.",
    "Text shown to the player (title, HUD labels, banners) must be in the same language as the request.",
  );
  return lines.join("\n");
}

/**
 * A schema-validation failure almost always means the content was right and
 * a handful of fields used the wrong format (a sentence where a hex color was
 * expected, a fraction above 1, a non-ASCII identifier). Feeding the exact
 * violations back gets a fast model to a valid document in one more round,
 * instead of burning the whole attempt budget on a completely different,
 * slower model that has no idea what went wrong.
 */
function designRepairPrompt(
  prompt: string,
  hints: { title?: string; brief?: string | null; winScore?: number },
  previousRaw: unknown,
  issues: Array<{ path: (string | number)[]; message: string }>,
): string {
  return [
    userPrompt(prompt, hints),
    "",
    "---",
    "",
    "Your previous document failed validation on these exact fields:",
    ...issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`),
    "",
    "Fix only those fields; keep everything else. Return the complete corrected document, not a diff.",
    "Previous document:",
    JSON.stringify(previousRaw).slice(0, 6_000),
  ].join("\n");
}

export type DesignAgentResult =
  | { ok: true; design: GameDesignDoc; model: string; durationMs: number }
  | { ok: false; reason: string };

export async function runDesignAgent(
  prompt: string,
  hints: { title?: string; brief?: string | null; winScore?: number; localeGroup?: RuntimeLocaleGroup } = {},
): Promise<DesignAgentResult> {
  const route = resolveGameModelRoute({ prompt, localeGroup: hints.localeGroup });
  if (!route.models.length) return { ok: false, reason: "design_agent_model_missing" };
  const cfg = PRODUCT.gameForge;
  const startedAt = Date.now();
  let lastReason = "design_empty";

  const verbose = process.env.FORGE_DEBUG === "1";
  for (const model of route.models.slice(0, 2)) {
    let repairUser: string | null = null;
    // One repair round per model: a validation failure is almost always a
    // format slip in an otherwise-good document, so it's worth a fast retry
    // on the SAME model before spending a full timeout on a different one.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const attemptStarted = Date.now();
      const result = await llmJson({
        model,
        scene: route.scene,
        localeGroup: hints.localeGroup,
        strictSceneModel: true,
        system: systemPrompt(),
        user: repairUser ?? userPrompt(prompt, hints),
        temperature: attempt === 0 ? 0.62 : 0.3,
        mode: "json_schema",
        jsonSchema: DESIGN_SCHEMA,
        maxTokens: cfg.designMaxTokens,
        timeoutMs: cfg.designTimeoutMs,
      });
      if (verbose) console.error(`[forge-debug] design model=${model} attempt=${attempt} scene=${route.scene} elapsed=${Date.now() - attemptStarted}ms ok=${result.ok} ${result.ok ? "" : `error=${result.error}`}`);
      if (!result.ok) { lastReason = result.error ?? "design_model_failed"; break; }
      const parsed = GameDesignDocSchema.safeParse(result.raw);
      if (!parsed.success) {
        const issues = parsed.error.issues.slice(0, 8).map((i) => ({ path: i.path as (string | number)[], message: i.message }));
        lastReason = `design_schema_invalid:${issues.slice(0, 3).map((i) => i.path.join(".")).join("|")}`;
        if (verbose) console.error(`[forge-debug] design model=${model} schema invalid: ${JSON.stringify(issues)}`);
        if (attempt === 0) { repairUser = designRepairPrompt(prompt, hints, result.raw, issues); continue; }
        break;
      }
      const design = normalizeDesign(parsed.data);
      const shape = validateModulePlan(design);
      if (!shape.ok) {
        lastReason = shape.reason;
        if (verbose) console.error(`[forge-debug] design model=${model} plan invalid: ${shape.reason}`);
        if (attempt === 0) { repairUser = designRepairPrompt(prompt, hints, result.raw, [{ path: ["modules"], message: shape.reason }]); continue; }
        break;
      }
      return { ok: true, design, model: result.model, durationMs: Date.now() - startedAt };
    }
  }
  return { ok: false, reason: `design_agent_failed:${lastReason}` };
}

/** A plan that cannot assemble is worse than no plan, so check it here. */
function validateModulePlan(design: GameDesignDoc): { ok: true } | { ok: false; reason: string } {
  const configs = design.modules.filter((m) => m.role === "config");
  const mains = design.modules.filter((m) => m.role === "main");
  if (configs.length !== 1) return { ok: false, reason: `design_plan_config_count:${configs.length}` };
  if (mains.length !== 1) return { ok: false, reason: `design_plan_main_count:${mains.length}` };
  const ids = new Set(design.modules.map((m) => m.id));
  if (ids.size !== design.modules.length) return { ok: false, reason: "design_plan_duplicate_ids" };
  for (const m of design.modules) {
    const signatureNames = new Set(m.signatures.map((s) => s.name));
    const missing = m.provides.filter((p) => !signatureNames.has(p));
    if (missing.length) return { ok: false, reason: `design_plan_signature_missing:${m.id}:${missing.join(",")}` };
  }
  return { ok: true };
}

/** Clamps a design into what the runtime can actually honour. */
function normalizeDesign(design: GameDesignDoc): GameDesignDoc {
  const stage = { ...design.stage };
  if (stage.orientation === "portrait") {
    if (stage.width > stage.height) { const w = stage.width; stage.width = stage.height; stage.height = w; }
  } else if (stage.orientation === "landscape") {
    if (stage.height > stage.width) { const h = stage.height; stage.height = stage.width; stage.width = h; }
  }
  // A background slot always exists so the runtime never renders onto bare colour.
  const assets = design.assets.some((a) => a.kind === "background")
    ? design.assets
    : [...design.assets, { key: "background", kind: "background" as const, prompt: `Wide establishing background for ${design.title}: ${design.pitch}`, required: false }];
  return { ...design, stage, assets };
}
