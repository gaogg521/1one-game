import { assessNovelRehearsalReadiness } from "../src/lib/generation-rehearsal-readiness";
import { buildAdminOpsHealthReport } from "../src/lib/admin-ops-health";
import { prisma } from "../src/lib/prisma";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const route = {
  scene: "novel" as const,
  provider: { id: "qa", name: "QA provider", protocol: "openai_compatible" as const, baseUrl: "https://example.invalid/v1", apiKey: "not-a-secret", models: ["qa-model"], enabled: true },
  models: ["qa-model"],
};

async function main() {
  const missing = assessNovelRehearsalReadiness({ route: null, queuedJobs: 0, runningJobs: 0 });
  assert(missing.status === "fail" && missing.hintKey === "healthHint_novelRehearsalMissing", "missing novel route must fail preflight");

  const backlog = assessNovelRehearsalReadiness({ route, queuedJobs: 2, runningJobs: 1 });
  assert(backlog.status === "warn" && backlog.hintKey === "healthHint_novelRehearsalBacklog", "active jobs must defer rehearsal");

  const ready = assessNovelRehearsalReadiness({ route, queuedJobs: 0, runningJobs: 0 });
  assert(ready.status === "warn" && ready.hintKey === "healthHint_novelRehearsalProbe" && ready.detail.includes("qa-model"), "configured route must require an explicit live probe");
  const report = await buildAdminOpsHealthReport();
  const opsCheck = report.checks.find((check) => check.id === "novel_rehearsal");
  assert(opsCheck && ["warn", "fail"].includes(opsCheck.status), "ops health must expose a no-cost novel rehearsal preflight");
  assert(opsCheck?.actionTab === "runtime", "a rehearsal preflight that is not ready must link to its runtime remediation page");
  console.log("[OK] qa-generation-rehearsal-readiness");
}

void main().finally(() => prisma.$disconnect());
