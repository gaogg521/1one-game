import type { GameSpec } from "@/lib/game-spec";

export type CustomizationMode = "carPaint" | "pottery";

export type CustomizationBlueprint = {
  mode: CustomizationMode;
  editGoal: number;
};

export function inferCustomizationMode(opts: { prompt?: string; sampleId?: string }): CustomizationMode {
  if (opts.sampleId === "pottery-master-3d") return "pottery";
  const blob = (opts.prompt ?? "").toLowerCase();
  if (/pottery|陶|拉坯|釉|potter|陶艺|转盘/i.test(blob)) return "pottery";
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
