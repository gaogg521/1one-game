import { llmJson } from "@/lib/llm";
import { getGameModelCascade } from "@/lib/game-model-route";
import type { GameArtDirection } from "@/lib/game-art-direction";
import type { RuntimeLocaleGroup } from "@/lib/runtime-providers";

export type GameVisualReview = {
  passed: boolean;
  score: number;
  blockers: string[];
  revisionInstructions: string[];
  screenshotBytes: number;
};

/**
 * Findings the reviewer may raise. A closed list is what makes the verdict
 * actionable: the polish loop keys off these exact codes, and a free-text
 * complaint from a model would otherwise be unroutable.
 */
const REVIEW_CODES = [
  "player_too_small",
  "runtime_letterboxed",
  "runtime_sprite_actor_missing",
  "art_direction_mismatch",
  "hud_unreadable",
  "low_contrast_subject",
] as const;

const REVIEW_SCHEMA = {
  name: "game_visual_review",
  strict: false,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["passed", "score", "blockers", "revisionInstructions"],
    properties: {
      passed: { type: "boolean" },
      score: { type: "integer", minimum: 0, maximum: 100 },
      blockers: { type: "array", maxItems: 6, items: { type: "string", enum: [...REVIEW_CODES] } },
      revisionInstructions: { type: "array", maxItems: 6, items: { type: "string" } },
    },
  },
} as const;

function systemPrompt(): string {
  return `You are the art director reviewing a screenshot of a finished browser game, taken on a 393x852 phone in portrait.

Judge only what the picture shows. Do not speculate about code, and do not review taste or theme quality — you are checking whether this reads as a finished game on a phone.

Report a blocker only when the screenshot clearly shows it:
- player_too_small: the protagonist is too small to track comfortably on a phone (well under a tenth of the screen's shorter side).
- runtime_letterboxed: large empty bands at the top and bottom, or left and right, because the play area does not fill the screen.
- runtime_sprite_actor_missing: the actors are bare rectangles, circles or untextured blocks rather than drawn artwork.
- art_direction_mismatch: the frame clearly contradicts the stated art direction below.
- hud_unreadable: score, lives or timer are clipped, overlapping, or unreadable against the background.
- low_contrast_subject: the protagonist or the hazards do not separate from the background.

A loading screen, a title card or an end card is not a gameplay frame: if the screenshot shows one, pass with a score of 60 and no blockers rather than guessing.

score is 0-100 for how finished this looks on a phone. passed is false only when you reported at least one blocker.
For each blocker, add one concrete revisionInstruction in the same language as the art direction, naming what to change.

Return JSON only.`;
}

/**
 * Reviews the real delivered frame. Returns null when no vision model is
 * routable or the call does not come back: an art review that cannot run must
 * leave the build alone rather than invent a verdict about it.
 */
export async function reviewGameVisuals(params: {
  screenshot: Buffer | null;
  artDirection: GameArtDirection;
  title: string;
  localeGroup?: RuntimeLocaleGroup;
  timeoutMs?: number;
}): Promise<GameVisualReview | null> {
  const { screenshot, artDirection } = params;
  if (!screenshot?.length) {
    console.error("[visual-review] skipped reason=no_frame");
    return null;
  }
  const models = getGameModelCascade("vision", params.localeGroup);
  if (!models.length) {
    console.error("[visual-review] skipped reason=no_vision_model_routed");
    return null;
  }

  const user = [
    `Game: ${params.title}`,
    `Art direction: ${artDirection.visualLanguage}`,
    `Camera: ${artDirection.camera}`,
    `Composition: ${artDirection.sceneComposition}`,
    artDirection.creatorIntent ? `Creator request: ${artDirection.creatorIntent}` : "",
    "",
    "Review the attached screenshot against the checklist.",
  ]
    .filter(Boolean)
    .join("\n");
  const dataUrl = `data:image/png;base64,${screenshot.toString("base64")}`;

  let lastReason = "no_attempt";
  for (const model of models.slice(0, 2)) {
    const startedAt = Date.now();
    const result = await llmJson({
      model,
      scene: "game_vision",
      localeGroup: params.localeGroup,
      system: systemPrompt(),
      user,
      images: [dataUrl],
      temperature: 0.1,
      mode: "json_schema",
      jsonSchema: REVIEW_SCHEMA,
      singleModeOnly: true,
      maxTokens: 1_024,
      /*
       * Measured in production: the routed vision model was cancelled by this
       * app's own AbortSignal at exactly 60002ms on a real screenshot, so every
       * review reported "unavailable" and no art finding could ever be raised.
       * Reading an image costs more than the short-reply budget assumed.
       */
      timeoutMs: params.timeoutMs ?? 120_000,
    }).catch((error) => {
      lastReason = error instanceof Error ? error.message : "threw";
      return null;
    });
    if (!result?.ok || !result.raw || typeof result.raw !== "object") {
      if (result && !result.ok) lastReason = result.error ?? "model_failed";
      else if (result) lastReason = "reply_not_an_object";
      // Swallowing this is how the platform ended up with an art review that
      // nobody could tell was silent. Say which model failed and why.
      console.error(`[visual-review] model=${model} ok=false reason=${lastReason.slice(0, 160)} ms=${Date.now() - startedAt}`);
      continue;
    }

    const raw = result.raw as { passed?: unknown; score?: unknown; blockers?: unknown; revisionInstructions?: unknown };
    const allowed = new Set<string>(REVIEW_CODES);
    const blockers = Array.isArray(raw.blockers)
      ? [...new Set(raw.blockers.filter((code): code is string => typeof code === "string" && allowed.has(code)))]
      : [];
    const instructions = Array.isArray(raw.revisionInstructions)
      ? raw.revisionInstructions.filter((line): line is string => typeof line === "string" && line.trim().length > 0).slice(0, 6).map((line) => line.slice(0, 300))
      : [];
    const score = typeof raw.score === "number" && Number.isFinite(raw.score) ? Math.max(0, Math.min(100, Math.round(raw.score))) : 0;
    return {
      // A model that reports a blocker has not passed, whatever it put in the
      // boolean. Keeping those two in sync is what the polish loop reads.
      passed: blockers.length === 0 && raw.passed !== false,
      score,
      blockers,
      revisionInstructions: instructions,
      screenshotBytes: screenshot.length,
    };
  }
  console.error(`[visual-review] unavailable models=${models.length} reason=${lastReason.slice(0, 160)}`);
  return null;
}
