import type { CreationMode } from "@/lib/product-ia";
import { inferCreationMode } from "@/lib/product-ia";
import { resolveSampleIntentFromPrompt } from "@/lib/sample-create-prefill";

export type StartIntakeHint =
  | {
      kind: "sample_parity";
      sampleTitle: string;
      variantId: string;
      samplePlayPath: string;
    }
  | {
      kind: "inferred_mode";
      mode: CreationMode;
    };

/** /start 统一入口：样品 prompt 优先走游戏 parity，否则按关键词推断载体 */
export function resolveStartIntake(prompt: string): {
  mode: CreationMode;
  hint: StartIntakeHint | null;
} {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return { mode: "game", hint: null };
  }

  const sample = resolveSampleIntentFromPrompt(trimmed);
  if (sample) {
    return {
      mode: "game",
      hint: {
        kind: "sample_parity",
        sampleTitle: sample.sampleTitle,
        variantId: sample.variantId,
        samplePlayPath: sample.samplePlayPath,
      },
    };
  }

  const mode = inferCreationMode(trimmed);
  return { mode, hint: { kind: "inferred_mode", mode } };
}
