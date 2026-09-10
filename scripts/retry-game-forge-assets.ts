/** Explicitly retry only missing Forge art slots for one existing project. */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { runForgeAssetAgent } from "@/lib/game-forge/asset-agent";
import { loadRuntimeConfig } from "@/lib/runtime-config";
import type { GameBuild } from "@/lib/game-forge/types";

async function main() {
  assert.equal(process.env.RETRY_GAME_FORGE_ASSETS, "1", "Explicit opt-in required");
  const projectId = process.env.QA_PROJECT_ID;
  assert.ok(projectId, "QA_PROJECT_ID required");
  await loadRuntimeConfig();
  const db = new PrismaClient();
  try {
    const project = await db.creativeProject.findFirst({ where: { legacyId: projectId } });
    assert.ok(project, "Creative project not found");
    const revision = await db.creativeRevision.findFirst({ where: { creativeProjectId: project.id, status: "ready" }, orderBy: { sequence: "desc" } });
    assert.ok(revision, "Ready revision not found");
    const artifact = await db.creativeArtifact.findFirst({ where: { creativeRevisionId: revision.id, kind: "game_runtime_source" } });
    assert.ok(artifact?.contentJson, "Runtime source not found");
    const spec = JSON.parse(artifact.contentJson) as { forgeBuild?: GameBuild };
    assert.ok(spec.forgeBuild?.design, "Forge design not found");
    const result = await runForgeAssetAgent(projectId, spec.forgeBuild.design, { concurrency: 1 });
    console.log(JSON.stringify({ projectId, revisionId: revision.id, generated: result.generated, failed: result.failed, results: result.results }));
    if (result.failed) process.exitCode = 1;
  } finally { await db.$disconnect(); }
}
void main();
