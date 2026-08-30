import type { GameSpec } from "@/lib/game-spec";

export type GamePlayabilityContract = {
  version: 1;
  templateId: GameSpec["templateId"];
  target: "mobile_h5";
  primaryLoop: string;
  requiredInputs: string[];
  requiredOutcomes: ["start", "first_action", "core_loop", "end", "retry"];
  minReactionWindowMs: number;
  requiresRuntimeAssets: boolean;
};

/**
 * Product-level acceptance contract.  It sits above individual Phaser scenes:
 * a template cannot be admitted to playtest merely because it can mount a canvas.
 */
export function buildGamePlayabilityContract(spec: GameSpec): GamePlayabilityContract {
  if (spec.templateId === "endless-runner") {
    return {
      version: 1, templateId: spec.templateId, target: "mobile_h5",
      primaryLoop: "auto_forward + lane_evade + jump_or_slide + collect",
      requiredInputs: ["swipe_left", "swipe_right", "swipe_up", "swipe_down"],
      requiredOutcomes: ["start", "first_action", "core_loop", "end", "retry"],
      minReactionWindowMs: 900,
      requiresRuntimeAssets: true,
    };
  }
  if (spec.templateId === "douDizhu") {
    return {
      version: 1, templateId: spec.templateId, target: "mobile_h5",
      primaryLoop: "bid + select_cards + hint_or_play + ai_turn",
      requiredInputs: ["tap_bid", "tap_card", "tap_hint", "tap_play", "tap_pass"],
      requiredOutcomes: ["start", "first_action", "core_loop", "end", "retry"],
      minReactionWindowMs: 1200,
      requiresRuntimeAssets: true,
    };
  }
  if (spec.templateId === "survivor" || spec.templateId === "shooter") {
    return {
      version: 1, templateId: spec.templateId, target: "mobile_h5",
      primaryLoop: "move + attack + upgrade + survive",
      requiredInputs: ["drag_move", "tap_upgrade"],
      requiredOutcomes: ["start", "first_action", "core_loop", "end", "retry"],
      minReactionWindowMs: 700,
      requiresRuntimeAssets: true,
    };
  }
  return {
    version: 1, templateId: spec.templateId, target: "mobile_h5",
    primaryLoop: "template_specific_core_loop",
    requiredInputs: ["touch_primary"],
    requiredOutcomes: ["start", "first_action", "core_loop", "end", "retry"],
    minReactionWindowMs: 600,
    requiresRuntimeAssets: true,
  };
}
