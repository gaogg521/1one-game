/** Paid jobs are never created here; measures a small durable write beside a running game. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { enqueueGenerationJob } from "@/lib/creator-core/jobs";
async function main() {
  if (process.env.QA_PROD_QUEUE_SLOTS !== "1") throw new Error("Explicit production QA opt-in required");
  const running = await prisma.generationJob.findFirst({ where: { type: "game_production", status: "running", leaseExpiresAt: { gt: new Date() } }, select: { id: true } });
  assert.ok(running, "Run this while the fresh production game is generating");
  const marker = `qa-queue-slot-${Date.now()}`;
  const project = await prisma.creativeProject.create({ data: { kind: "game", ownerKey: marker, title: marker } });
  try {
    const job = await enqueueGenerationJob({ creativeProjectId: project.id, type: "artifact_write", payload: { artifact: { kind: "queue_slot_probe", mediaType: "json", content: { probe: true } } } });
    const started = Date.now();
    let status = "queued";
    while (Date.now() - started < 60_000) {
      const current = await prisma.generationJob.findUniqueOrThrow({ where: { id: job.id } });
      status = current.status;
      if (status === "completed" || status === "failed") break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    const report = { longJobId: running.id, shortJobId: job.id, status, elapsedMs: Date.now() - started, longJobStillRunning: (await prisma.generationJob.findUnique({ where: { id: running.id } }))?.status === "running" };
    await fs.mkdir("qa-output/queue-slots", { recursive: true });
    await fs.writeFile("qa-output/queue-slots/REPORT.json", JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
    assert.equal(status, "completed");
    assert.equal(report.longJobStillRunning, true, "The long game should still be running when the short task completes");
  } finally {
    await prisma.creativeProject.deleteMany({ where: { id: project.id, ownerKey: marker } });
    await prisma.$disconnect();
  }
}
void main();
