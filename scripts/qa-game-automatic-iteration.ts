import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { mirrorGameToCreatorCore } from "@/lib/creator-core/game-bridge";
import { evaluateAndPersistGameDistribution } from "@/lib/game-distribution-loop";
import { processNextGenerationJob } from "@/lib/creator-core/worker";
import { prepareGameSpecForPersist } from "@/lib/spec-patch";

async function main() {
  process.env.E2E_REFINE_STUB = "1";
  const ownerKey = `qa-auto-iteration-${Date.now()}`;
  const prompt = "触屏躲避游戏，第一分钟要有明确反馈和成长";
  const spec = prepareGameSpecForPersist(undefined, prompt);
  const project = await prisma.project.create({ data: {
    ownerKey,
    title: spec.title,
    prompt,
    specJson: JSON.stringify(spec),
    status: "ready",
    visibility: "public",
  } });
  let coreProjectId: string | undefined;
  try {
    const core = await mirrorGameToCreatorCore({ project });
    coreProjectId = core.creativeProjectId;
    await prisma.gameplayEvent.createMany({ data: Array.from({ length: 20 }, (_, index) => {
      const sessionId = `qa-weak-${index}`;
      return [
        { projectId: project.id, creativeRevisionId: core.creativeRevisionId, templateId: spec.templateId, sessionId, event: "start", elapsedMs: 0 },
        ...(index < 8 ? [{ projectId: project.id, creativeRevisionId: core.creativeRevisionId, templateId: spec.templateId, sessionId, event: "first_action", elapsedMs: 1_000 }] : []),
        { projectId: project.id, creativeRevisionId: core.creativeRevisionId, templateId: spec.templateId, sessionId, event: "end", elapsedMs: index < 10 ? 7_000 : 20_000, won: false },
      ];
    }).flat() });
    const decision = await evaluateAndPersistGameDistribution({ projectId: project.id, creativeRevisionId: core.creativeRevisionId });
    assert.equal(decision?.decision, "iterate");
    const iterationJob = await prisma.generationJob.findUnique({ where: { idempotencyKey: `game-iteration:${core.creativeRevisionId}` } });
    assert(iterationJob, "an iterate decision must enqueue an executable revision job");
    const processed = await processNextGenerationJob("qa-auto-iteration-worker");
    assert.equal(processed?.id, iterationJob.id);
    assert.equal(processed?.status, "completed");
    const child = await prisma.creativeRevision.findFirst({ where: { creativeProjectId: core.creativeProjectId, parentRevisionId: core.creativeRevisionId } });
    assert(child, "iteration must create a child immutable revision");
    assert.equal(child.status, "preparing", "the revised version must pass production again before becoming ready");
    const result = await prisma.creativeArtifact.findFirst({ where: { creativeRevisionId: child.id, kind: "game_iteration_result" } });
    assert(result?.contentJson?.includes(core.creativeRevisionId), "the revision must retain its measured source and reason");
    const production = await prisma.generationJob.findFirst({ where: { creativeRevisionId: child.id, type: "game_production" } });
    assert.equal(production?.status, "queued", "the actual revised deliverable must re-enter the full production pipeline");
    console.log("[OK] qa-game-automatic-iteration: weak cohort -> LLM patch job -> child revision -> production queue");
  } finally {
    await prisma.project.delete({ where: { id: project.id } }).catch(() => undefined);
    if (coreProjectId) await prisma.creativeProject.delete({ where: { id: coreProjectId } }).catch(() => undefined);
  }
}

void main().finally(() => prisma.$disconnect());
