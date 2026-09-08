import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { claimGenerationJob, completeGenerationJob, enqueueGenerationJob, failGenerationJob, renewGenerationJobLease, heartbeatGenerationJob } from "@/lib/creator-core/jobs";
import { writeProductionArtifact } from "@/lib/creator-core/repository";

async function main() {
  assert.match(process.env.DATABASE_URL ?? "", /qa-generation-leases/, "Run only against an isolated QA database");
  const a = await prisma.creativeProject.create({ data: { ownerKey: "qa", kind: "game", title: "a" } });
  const b = await prisma.creativeProject.create({ data: { ownerKey: "qa", kind: "game", title: "b" } });
  const make = (project: string) => enqueueGenerationJob({ creativeProjectId: project, type: "artifact_write", payload: {} });
  try {
    const first = await make(a.id), same = await make(a.id), other = await make(b.id);
    assert.equal((await claimGenerationJob("one", 90_000, first.id))?.id, first.id);
    assert.equal(await claimGenerationJob("same", 90_000, same.id), null);
    assert.equal((await claimGenerationJob("two", 90_000, other.id))?.id, other.id);
    assert.equal(await claimGenerationJob("three"), null);
    await prisma.generationJob.update({ where: { id: first.id }, data: { leaseExpiresAt: new Date(0), attempts: 3 } });
    assert.equal(await claimGenerationJob("exhausted", 90_000, first.id), null);
    assert.equal((await prisma.generationJob.findUniqueOrThrow({ where: { id: first.id } })).status, "failed");
    const reclaimed = await claimGenerationJob("new", 90_000, same.id);
    assert.equal(reclaimed?.attempts, 1);
    assert.equal(await renewGenerationJobLease(same.id, "old"), false);
    await assert.rejects(completeGenerationJob(same.id, undefined, "old"));
    await assert.rejects(failGenerationJob(same.id, "old", { workerId: "old" }));
    await heartbeatGenerationJob(same.id, "new", { percent: 50, stage: "assets" });
    assert.equal(await renewGenerationJobLease(same.id, "new"), true);
    assert.match((await prisma.generationJob.findUniqueOrThrow({ where: { id: same.id } })).progressJson!, /assets/);
    await prisma.generationJob.update({ where: { id: same.id }, data: { attempts: 3 } });
    assert.equal((await failGenerationJob(same.id, "again", { retry: true, workerId: "new" })).status, "failed");
    const revision = await prisma.creativeRevision.create({ data: { creativeProjectId: a.id, sequence: 1, cause: "generate", status: "generating" } });
    const proofJob = await enqueueGenerationJob({ creativeProjectId: a.id, creativeRevisionId: revision.id, type: "game_production", payload: {} });
    await claimGenerationJob("proof", 90_000, proofJob.id);
    const input = { creativeProjectId: a.id, creativeRevisionId: revision.id, idempotencyKey: `proof:${revision.id}`, artifact: { kind: "game_runtime_validation", mediaType: "report" as const, content: { status: "failed", sourceHash: "old" } } };
    await writeProductionArtifact(input, proofJob.id, "proof");
    const fresh = await writeProductionArtifact({ ...input, artifact: { ...input.artifact, content: { status: "passed", sourceHash: "new" } } }, proofJob.id, "proof");
    assert.equal(JSON.parse(fresh.contentJson!).sourceHash, "new");
    await prisma.creativeRevision.update({ where: { id: revision.id }, data: { status: "ready" } });
    await assert.rejects(writeProductionArtifact(input, proofJob.id, "proof"), /not_generating/);
    console.log("[OK] bounded global concurrency, project exclusion, exhausted lease, stale-owner fencing, stage-preserving renewal, forced retry cap");
  } finally {
    await prisma.creativeProject.deleteMany({ where: { id: { in: [a.id, b.id] } } });
    await prisma.$disconnect();
  }
}
void main();
