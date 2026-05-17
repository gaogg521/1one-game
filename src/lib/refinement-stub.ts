import type { GameSpec } from "@/lib/game-spec";
import { finalizePatchedSpec } from "@/lib/spec-patch";
import type { RefineMode } from "@/lib/refinement-types";

/** Playwright / CI：无 LLM 时的确定性精炼结果（勿在生产开启）。 */
export function isRefinementStubEnabled(): boolean {
  return process.env.E2E_REFINE_STUB === "1";
}

export function refineSpecWithStub(params: {
  mode: RefineMode;
  spec: GameSpec;
  instruction: string;
  currentPrompt: string;
}): { spec: GameSpec; mergedPrompt: string } {
  const tag = params.instruction.trim().slice(0, 24) || "e2e";
  if (params.mode === "patch") {
    const next: GameSpec = {
      ...params.spec,
      title: `${params.spec.title}·${tag}`.slice(0, 80),
    };
    const mergedPrompt = `${params.currentPrompt}\n\n【后续修改】${params.instruction}`.trim().slice(0, 4000);
    return {
      spec: finalizePatchedSpec(params.instruction, next),
      mergedPrompt,
    };
  }

  const next: GameSpec = {
    ...params.spec,
    labels: {
      ...params.spec.labels,
      subtitle: `[regen:${tag}] ${params.spec.labels.subtitle ?? ""}`.trim().slice(0, 120),
    },
  };
  const mergedPrompt = `${params.currentPrompt}\n\n【迭代指令】${params.instruction}`.trim().slice(0, 4000);
  return {
    spec: finalizePatchedSpec(params.instruction, next),
    mergedPrompt,
  };
}
