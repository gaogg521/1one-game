import type { GameSpec } from "@/lib/game-spec";

export type CustomizationMode = "carPaint" | "pottery";

export type CustomizationBlueprint = {
  mode: CustomizationMode;
  editGoal: number;
};

export function inferCustomizationMode(opts: { prompt?: string; sampleId?: string }): CustomizationMode {
  void opts.sampleId;
  const blob = (opts.prompt ?? "").toLowerCase();
  if (/pottery|陶|拉坯|釉|potter/i.test(blob)) return "pottery";
  return "carPaint";
}

export function buildCustomizationBlueprint(opts: {
  prompt?: string;
  spec?: GameSpec;
  sampleId?: string;
}): CustomizationBlueprint {
  const mode = inferCustomizationMode({ prompt: opts.prompt, sampleId: opts.sampleId });
  return { mode, editGoal: mode === "pottery" ? 6 : 5 };
}
