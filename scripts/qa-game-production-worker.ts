import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { mirrorGameToCreatorCore } from "@/lib/creator-core/game-bridge";
import { createCreativeArtifact } from "@/lib/creator-core/repository";
import { enqueueGenerationJob } from "@/lib/creator-core/jobs";
import { processNextGenerationJob } from "@/lib/creator-core/worker";
import { prepareGameSpecForPersist } from "@/lib/spec-patch";

async function main() {
  const ownerKey = `qa-production-worker-${Date.now()}`;
  const spec = prepareGameSpecForPersist(undefined, "霓虹飞船突破机械舰队并击败终局 Boss");
  const project = await prisma.project.create({
    data: { ownerKey, title: spec.title, prompt: "霓虹飞船突破机械舰队并击败终局 Boss", specJson: JSON.stringify(spec), status: "ready", visibility: "hidden" },
  });
  let coreProjectId: string | undefined;
  try {
    const core = await mirrorGameToCreatorCore({ project, deferFinalization: true });
    coreProjectId = core.creativeProjectId;
    const before = await prisma.creativeRevision.findUniqueOrThrow({ where: { id: core.creativeRevisionId } });
    assert.equal(before.status, "preparing", "a new candidate must not be ready before production executes");
    await createCreativeArtifact({
      creativeProjectId: core.creativeProjectId,
      creativeRevisionId: core.creativeRevisionId,
      idempotencyKey: `asset_manifest:${core.creativeRevisionId}`,
      artifact: {
        kind: "asset_manifest",
        mediaType: "json",
        content: {
          backgroundUrl: "/game-bg/qa.webp",
          sprites: [{ kind: "player", url: "/game-sprites/qa/player.webp" }, { kind: "hazard", url: "/game-sprites/qa/hazard.webp" }],
          manifest: { slots: [{ slot: "background", url: "/game-bg/qa.webp" }, { slot: "player", url: "/game-sprites/qa/player.webp" }, { slot: "enemy", url: "/game-sprites/qa/hazard.webp" }] },
        },
      },
    });
    await createCreativeArtifact({
      creativeProjectId: core.creativeProjectId,
      creativeRevisionId: core.creativeRevisionId,
      idempotencyKey: `bgm_notes:${core.creativeRevisionId}`,
      artifact: { kind: "bgm_notes", mediaType: "json", content: { bpm: 120, notes: [{ at: 0, duration: 0.25, frequency: 220 }] } },
    });
    const job = await enqueueGenerationJob({
      creativeProjectId: core.creativeProjectId,
      creativeRevisionId: core.creativeRevisionId,
      type: "game_production",
      idempotencyKey: `qa-production:${core.creativeRevisionId}`,
      payload: { projectId: project.id, ownerKey, spec, brief: null, uiLocale: "zh-Hans" },
    });
    const sessionId = `qa-session-${Date.now()}`;
    await prisma.gameplayEvent.createMany({
      data: [
        { projectId: project.id, creativeRevisionId: core.creativeRevisionId, templateId: spec.templateId, event: "first_action", sessionId, elapsedMs: 500, deviceClass: "mobile", orientation: "portrait", touchCapable: true },
        { projectId: project.id, creativeRevisionId: core.creativeRevisionId, templateId: spec.templateId, event: "first_minute", sessionId, elapsedMs: 60_500, activeMs: 60_000, actionCount: 12, deviceClass: "mobile", orientation: "portrait", touchCapable: true },
        { projectId: project.id, creativeRevisionId: core.creativeRevisionId, templateId: spec.templateId, event: "end", sessionId, elapsedMs: 68_000, score: 4, won: false, deviceClass: "mobile", orientation: "portrait", touchCapable: true },
      ],
    });
    const processed = await processNextGenerationJob("qa-production-worker");
    assert.equal(processed?.id, job.id);
    assert.equal(processed?.status, "completed");
    const revision = await prisma.creativeRevision.findUniqueOrThrow({ where: { id: core.creativeRevisionId } });
    assert.equal(revision.status, "ready", "only a promoted candidate may become ready");
    const artifacts = await prisma.creativeArtifact.findMany({ where: { creativeRevisionId: core.creativeRevisionId } });
    for (const kind of ["game_design_directive", "gameplay_revision", "art_direction_pack", "ux_interaction_contract", "runtime_build_manifest", "automated_playtest_preflight", "game_production_run", "game_production_candidate"]) {
      assert.ok(artifacts.some((artifact) => artifact.kind === kind), `${kind} must be durable`);
    }
    const candidate = artifacts.find((artifact) => artifact.kind === "game_production_candidate");
    assert.equal(JSON.parse(candidate?.contentJson ?? "{}").decision, "ready_for_playtest");
    assert.ok(artifacts.some((artifact) => artifact.kind === "game_playtest_delivery"), "worker must reconcile real telemetry observed before candidate promotion");
    const playtest = artifacts.find((artifact) => artifact.kind === "game_playtest_delivery");
    assert.equal(JSON.parse(playtest?.contentJson ?? "{}").outcome, "lost", "reconciled evidence must retain the observed outcome");
    console.log("[OK] qa-game-production-worker: preparing -> six-pass production -> ready-for-playtest is durable");
  } finally {
    await prisma.project.delete({ where: { id: project.id } }).catch(() => undefined);
    if (coreProjectId) await prisma.creativeProject.delete({ where: { id: coreProjectId } }).catch(() => undefined);
  }
}

void main().finally(() => prisma.$disconnect());
