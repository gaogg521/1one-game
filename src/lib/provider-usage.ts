import { prisma } from "@/lib/prisma";

export type ProviderUsageInput = {
  modality: "llm" | "image";
  provider: string;
  model: string;
  operation: "json" | "text" | "image" | "image_batch";
  status: "succeeded" | "failed";
  durationMs: number;
  outputUnits?: number;
  estimatedCostMicros?: number | null;
  errorCode?: string;
};

/**
 * Best-effort financial observability. This must never change creator-facing
 * generation semantics, and intentionally accepts only metadata.
 */
export async function writeProviderUsage(input: ProviderUsageInput): Promise<void> {
  await prisma.providerUsageEvent.create({
    data: {
      modality: input.modality,
      provider: input.provider.slice(0, 48),
      model: input.model.slice(0, 160),
      operation: input.operation,
      status: input.status,
      durationMs: Math.max(0, Math.min(24 * 60 * 60 * 1000, Math.round(input.durationMs))),
      outputUnits: input.outputUnits == null ? null : Math.max(0, Math.min(10_000_000, Math.round(input.outputUnits))),
      estimatedCostMicros: input.estimatedCostMicros == null ? null : Math.max(0, Math.round(input.estimatedCostMicros)),
      errorCode: input.errorCode?.slice(0, 96),
    },
  });
}

export function recordProviderUsage(input: ProviderUsageInput): void {
  void writeProviderUsage(input).catch((error) => {
    console.warn("[provider-usage] ledger write failed", error instanceof Error ? error.message : String(error));
  });
}
