import { prisma } from "../src/lib/prisma";
import { withGenerationJobContext } from "../src/lib/generation-job-context";
import { writeProviderUsage } from "../src/lib/provider-usage";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  const marker = `qa-provider-${Date.now()}`;
  try {
    await withGenerationJobContext(`job-${marker}`, async () => writeProviderUsage({
      modality: "llm",
      provider: "openai_compatible",
      model: marker,
      operation: "json",
      status: "succeeded",
      durationMs: 1234,
      outputUnits: 42,
    }));
    const row = await prisma.providerUsageEvent.findFirst({ where: { model: marker } });
    assert(row, "provider usage must persist an event");
    assert(row.modality === "llm" && row.status === "succeeded", "ledger must retain safe lifecycle metadata");
    assert(row.durationMs === 1234 && row.outputUnits === 42, "ledger must retain measured duration and units");
    assert(row.generationJobId === `job-${marker}`, "worker context must correlate ledger rows to the generation job");
    assert(!Object.keys(row).some((key) => /prompt|content|secret|token|response/i.test(key)), "ledger schema must not expose creator content or credentials");
    console.log("[OK] qa-provider-usage");
  } finally {
    await prisma.providerUsageEvent.deleteMany({ where: { model: marker } });
  }
}

void main().finally(() => prisma.$disconnect());
