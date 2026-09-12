import { z } from "zod";

/**
 * GameForge build artifacts.
 *
 * A game is produced as a set of modules rather than one blob. That is what
 * structurally lifts the output ceiling: a single JSON completion caps the
 * whole game, whereas N module completions each get the full budget and can be
 * generated in parallel and repaired individually.
 */

/** Slot vocabulary the art pipeline can fill. Far wider than the legacy five. */
export const ASSET_SLOT_KINDS = [
  "background",
  "player",
  "enemy",
  "enemy_alt",
  "boss",
  "collectible",
  "power",
  "projectile",
  "obstacle",
  "platform",
  "prop",
  "tile",
  "ui_icon",
] as const;

export const AssetSlotSchema = z.object({
  /** Stable key the runtime reads from `ctx.assets`. */
  key: z.string().min(1).max(40),
  kind: z.enum(ASSET_SLOT_KINDS),
  /** What the image must depict, written for an image model. */
  prompt: z.string().min(8).max(600),
  /** Placeholder tint if generation fails. */
  color: z.string().min(4).max(24).optional(),
  /** Rendered footprint in virtual units, used for composition guidance. */
  width: z.number().int().min(8).max(2048).optional(),
  height: z.number().int().min(8).max(2048).optional(),
  required: z.boolean().default(false),
});
export type AssetSlot = z.infer<typeof AssetSlotSchema>;

export const MODULE_ROLES = ["config", "system", "main"] as const;

/**
 * The exact call convention for one CALLABLE `provides` entry: its name and
 * parameter list, in order. Independent code agents only ever see this
 * contract, not each other's source, so an unstated parameter order is exactly
 * how the same name ends up called two different ways by two different modules.
 *
 * Data values exposed on `G` (config objects, shared state) are listed in
 * `provides` but must NOT appear here: a signature reads as "this is callable",
 * and a consumer that sees `G.config()` will call it and crash on
 * "G.config is not a function".
 */
export const FunctionSignatureSchema = z.object({
  name: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,40}$/),
  params: z.array(z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]{0,20}$/)).max(6).default([]),
});
export type FunctionSignature = z.infer<typeof FunctionSignatureSchema>;

export const ModulePlanSchema = z.object({
  /** Identifier, lowercase snake. Becomes the assembled function name. */
  id: z.string().regex(/^[a-z][a-z0-9_]{1,28}$/),
  role: z.enum(MODULE_ROLES),
  /** One paragraph telling the code agent exactly what to build. */
  brief: z.string().min(20).max(1200),
  /** Names this module assigns onto the shared `G` namespace. */
  provides: z.array(z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,40}$/)).max(24).default([]),
  /** Names from `G` this module reads. Drives the dependency layering. */
  requires: z.array(z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,40}$/)).max(24).default([]),
  /** Exact (name, params) for every entry in `provides`, in the same order. */
  signatures: z.array(FunctionSignatureSchema).max(24).default([]),
});
export type ModulePlan = z.infer<typeof ModulePlanSchema>;

export const GameDesignDocSchema = z.object({
  title: z.string().min(1).max(80),
  /** One sentence a player would recognise the game by. */
  pitch: z.string().min(10).max(280),
  /** The genre the request actually asks for, in the model's own words. */
  genre: z.string().min(2).max(60),
  /** Virtual stage the game is authored against. */
  stage: z.object({
    // Delivery is a 393x852 phone, so an omitted stage defaults upright.
    width: z.number().int().min(320).max(1920).default(540),
    height: z.number().int().min(320).max(1920).default(960),
    orientation: z.enum(["landscape", "portrait", "either"]).default("portrait"),
    background: z.string().min(4).max(24).default("#0b1020"),
  }),
  /** The 30-90 second loop, step by step. */
  coreLoop: z.array(z.string().min(4).max(240)).min(3).max(10),
  /** Concrete verbs the player performs and the exact control for each. */
  controls: z.array(z.object({
    action: z.string().min(2).max(60),
    desktop: z.string().min(1).max(60),
    touch: z.string().min(1).max(60),
  })).min(1).max(8),
  /** Named systems that must exist in code. Drives the module plan. */
  mechanics: z.array(z.object({
    id: z.string().min(2).max(40),
    summary: z.string().min(8).max(300),
    /** How a player can observe it working — used by QA, not by codegen. */
    observable: z.string().min(6).max(200),
  })).min(2).max(12),
  progression: z.object({
    winCondition: z.string().min(6).max(240),
    loseCondition: z.string().min(6).max(240),
    /** Difficulty beats across the run, position 0..1. */
    beats: z.array(z.object({
      at: z.number().min(0).max(1),
      label: z.string().min(1).max(40),
      change: z.string().min(4).max(200),
    })).min(2).max(8),
  }),
  /** Feel notes the juice pass will act on. */
  gameFeel: z.array(z.string().min(4).max(200)).min(2).max(10),
  /**
   * Every dotted path the config module will assign onto `G.config`, e.g.
   * "player.jumpVelocity", "goals.targetShoots". Every module that reads
   * config values sees this exact list, so "the config module nests fields
   * under player/goals/run" is a stated contract instead of something each
   * code agent has to guess — a mismatch here (reading cfg.jumpVelocity when
   * the shape declares player.jumpVelocity) is the config-era counterpart of
   * an unstated function signature.
   */
  configShape: z.array(z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)+$/)).min(1).max(40).default([]),
  assets: z.array(AssetSlotSchema).min(1).max(16),
  audio: z.object({
    /** SDK sfx names mapped to the events that should trigger them. */
    cues: z.array(z.object({ event: z.string().min(2).max(60), sfx: z.string().min(2).max(24) })).max(14).default([]),
    musicMood: z.string().min(3).max(120).optional(),
  }),
  modules: z.array(ModulePlanSchema).min(2).max(9),
});
export type GameDesignDoc = z.infer<typeof GameDesignDocSchema>;

export const GameModuleSchema = z.object({
  id: z.string().min(1).max(30),
  role: z.enum(MODULE_ROLES),
  /** Function body only. Receives `(G, g)`; the config module receives `(G)`. */
  source: z.string().min(20).max(48_000),
  provides: z.array(z.string()).default([]),
  requires: z.array(z.string()).default([]),
  /** Model that produced this module, for provenance. */
  model: z.string().optional(),
});
export type GameModule = z.infer<typeof GameModuleSchema>;

export const QA_SEVERITIES = ["blocker", "major", "minor"] as const;

export const QaFindingSchema = z.object({
  severity: z.enum(QA_SEVERITIES),
  /** Module the finding belongs to, or "assembled" for whole-build issues. */
  moduleId: z.string().min(1).max(30),
  code: z.string().min(2).max(60),
  message: z.string().min(4).max(400),
});
export type QaFinding = z.infer<typeof QaFindingSchema>;

export const QaReportSchema = z.object({
  /** True only when nothing blocker-level survived. */
  ok: z.boolean(),
  /** Whether a real engine actually executed the build. */
  observed: z.boolean(),
  findings: z.array(QaFindingSchema),
  evidence: z.array(z.string()),
});
export type QaReport = z.infer<typeof QaReportSchema>;

export const GameBuildSchema = z.object({
  version: z.literal(1),
  design: GameDesignDocSchema,
  modules: z.array(GameModuleSchema).min(1),
  /** Assembled single-file runtime handed to the iframe. */
  source: z.string().min(80),
  qa: QaReportSchema,
  provenance: z.object({
    startedAt: z.string(),
    completedAt: z.string(),
    /** One entry per agent that actually changed a deliverable. */
    passes: z.array(z.object({
      agent: z.string(),
      model: z.string().optional(),
      changed: z.array(z.string()),
      durationMs: z.number(),
      note: z.string().optional(),
    })),
  }),
});
export type GameBuild = z.infer<typeof GameBuildSchema>;

/** Runtime context the host injects into the iframe. */
export type ForgeRuntimeContext = {
  title: string;
  prompt: string;
  winScore: number;
  assets: Record<string, string | undefined>;
  finish: (won: boolean, score?: number) => void;
};
