import { prisma } from "@/lib/prisma";
import { loadRuntimeConfig, type ProviderPricingRule } from "@/lib/runtime-config";
import { currentGenerationJobId } from "@/lib/generation-job-context";

export type ProviderUsageInput = {
  modality: "llm" | "image" | "audio";
  provider: string;
  model: string;
  operation: "json" | "text" | "image" | "image_batch" | "audio";
  status: "succeeded" | "failed";
  durationMs: number;
  outputUnits?: number;
  estimatedCostMicros?: number | null;
  errorCode?: string;
  generationJobId?: string;
};

function matchingPriceRule(input: ProviderUsageInput, rules: ProviderPricingRule[]): ProviderPricingRule | null {
  const provider = input.provider.trim().toLowerCase();
  const model = input.model.trim().toLowerCase();
  let best: ProviderPricingRule | null = null;
  let bestScore = -1;
  for (const rule of rules) {
    if (rule.modality !== input.modality || rule.operation !== input.operation) continue;
    if (rule.provider !== "*" && rule.provider !== provider) continue;
    if (rule.model !== "*" && rule.model !== model) continue;
    const score = (rule.provider === "*" ? 0 : 2) + (rule.model === "*" ? 0 : 1);
    if (score > bestScore) {
      best = rule;
      bestScore = score;
    }
  }
  return best;
}

export async function resolveEstimatedProviderCost(input: ProviderUsageInput): Promise<number | null> {
  if (input.estimatedCostMicros != null) return Math.max(0, Math.round(input.estimatedCostMicros));
  const runtime = await loadRuntimeConfig();
  return matchingPriceRule(input, runtime.dbPayload.providerPricing ?? [])?.estimatedCostMicros ?? null;
}

/**
 * Best-effort financial observability. This must never change creator-facing
 * generation semantics, and intentionally accepts only metadata.
 */
export async function writeProviderUsage(input: ProviderUsageInput): Promise<void> {
  const estimatedCostMicros = await resolveEstimatedProviderCost(input);
  await prisma.providerUsageEvent.create({
    data: {
      modality: input.modality,
      provider: input.provider.slice(0, 48),
      model: input.model.slice(0, 160),
      operation: input.operation,
      status: input.status,
      durationMs: Math.max(0, Math.min(24 * 60 * 60 * 1000, Math.round(input.durationMs))),
      outputUnits: input.outputUnits == null ? null : Math.max(0, Math.min(10_000_000, Math.round(input.outputUnits))),
      estimatedCostMicros,
      errorCode: input.errorCode?.slice(0, 96),
      generationJobId: input.generationJobId ?? currentGenerationJobId(),
    },
  });
}

export function recordProviderUsage(input: ProviderUsageInput): void {
  void writeProviderUsage(input).catch((error) => {
    console.warn("[provider-usage] ledger write failed", error instanceof Error ? error.message : String(error));
  });
}
