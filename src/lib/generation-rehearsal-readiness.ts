import type { ResolvedSceneRoute } from "@/lib/runtime-providers";

export type GenerationRehearsalReadiness = {
  status: "ok" | "warn" | "fail";
  detail: string;
  hintKey?: "healthHint_novelRehearsalMissing" | "healthHint_novelRehearsalProbe" | "healthHint_novelRehearsalBacklog";
};

/**
 * A no-cost production rehearsal preflight. It never probes a model or reads
 * a secret: it only confirms the effective novel route selected by runtime
 * configuration and highlights queued work that a rehearsal could contend with.
 */
export function assessNovelRehearsalReadiness(input: {
  route: ResolvedSceneRoute | null;
  queuedJobs: number;
  runningJobs: number;
}): GenerationRehearsalReadiness {
  if (!input.route || input.route.models.length === 0) {
    return {
      status: "fail",
      detail: "novel_route_missing",
      hintKey: "healthHint_novelRehearsalMissing",
    };
  }
  if (input.queuedJobs + input.runningJobs > 0) {
    return {
      status: "warn",
      detail: `${input.route.provider.name} · ${input.route.models[0]} · ${input.queuedJobs} queued / ${input.runningJobs} running`,
      hintKey: "healthHint_novelRehearsalBacklog",
    };
  }
  return {
    status: "warn",
    detail: `${input.route.provider.name} · ${input.route.models[0]} · configured`,
    hintKey: "healthHint_novelRehearsalProbe",
  };
}
