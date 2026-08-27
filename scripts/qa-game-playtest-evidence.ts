import { prisma } from "../src/lib/prisma";
import { mirrorGameToCreatorCore } from "../src/lib/creator-core/game-bridge";
import { persistFirstMinutePlaytestEvidence, persistFirstMinutePlaytestEvidenceWithRetry, persistGameDeliveryPlaytestEvidence } from "../src/lib/game-playtest-evidence";
import { prepareGameSpecForPersist } from "../src/lib/spec-patch";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  const marker = `qa-playtest-${Date.now()}`;
  const prompt = "在霓虹街道躲开无人机，坚持一分钟";
  const spec = prepareGameSpecForPersist(undefined, prompt);
  const project = await prisma.project.create({
    data: {
      ownerKey: marker,
      title: spec.title,
      prompt,
      specJson: JSON.stringify(spec),
      status: "ready",
      visibility: "hidden",
    },
  });
  let coreId: string | undefined;
  try {
    const core = await mirrorGameToCreatorCore({ project });
    coreId = core.creativeProjectId;
    const event = {
      projectId: project.id,
      creativeRevisionId: core.creativeRevisionId,
      templateId: spec.templateId,
      event: "first_minute" as const,
      sessionId: `qa-session-${Date.now()}`,
      elapsedMs: 60_000,
      activeMs: 60_000,
      actionCount: 4,
      deviceClass: "mobile" as const,
      orientation: "portrait" as const,
      touchCapable: true,
      verticalSliceScore: 88,
    };
    const result = await persistFirstMinutePlaytestEvidence(event);
    assert(result === "recorded", "first real-minute event must create revision evidence");
    const duplicate = await persistFirstMinutePlaytestEvidenceWithRetry(event);
    assert(duplicate === "already_recorded", "same revision must not write duplicate playtest evidence");
    const wrongRevision = await persistFirstMinutePlaytestEvidence({ ...event, creativeRevisionId: "not-the-played-revision" });
    assert(wrongRevision === "not_applicable", "evidence must never drift to the latest revision when the played revision is unknown");

    const artifact = await prisma.creativeArtifact.findFirst({
      where: { creativeRevisionId: core.creativeRevisionId, kind: "game_playtest_first_minute" },
    });
    const evaluation = await prisma.creativeEvaluation.findFirst({
      where: { creativeRevisionId: core.creativeRevisionId, evaluator: "playtest" },
    });
    assert(artifact?.contentJson?.includes("first_minute"), "playtest artifact must record runtime event type");
    assert(artifact?.idempotencyKey === `game_playtest_first_minute:${core.creativeRevisionId}`, "playtest artifact must have a database idempotency key");
    assert(!artifact?.contentJson?.includes("session"), "playtest artifact must not retain session identifiers");
    assert(evaluation?.evidenceJson.includes("playtest:first_minute_observed"), "playtest evaluation must expose observed runtime proof");
    assert(!evaluation?.evidenceJson.includes(marker), "playtest evaluation must not retain owner or session-like identifiers");
    await prisma.gameplayEvent.createMany({ data: [
      { projectId: project.id, creativeRevisionId: core.creativeRevisionId, templateId: spec.templateId, event: "first_action", sessionId: event.sessionId, elapsedMs: 500, deviceClass: "mobile", orientation: "portrait", touchCapable: true },
      { projectId: project.id, creativeRevisionId: core.creativeRevisionId, templateId: spec.templateId, event: "first_minute", sessionId: event.sessionId, elapsedMs: 60_000, activeMs: 60_000, actionCount: 4, deviceClass: "mobile", orientation: "portrait", touchCapable: true },
      { projectId: project.id, creativeRevisionId: core.creativeRevisionId, templateId: spec.templateId, event: "end", sessionId: event.sessionId, elapsedMs: 62_000, score: 120, won: true, deviceClass: "mobile", orientation: "portrait", touchCapable: true },
    ] });
    const delivery = await persistGameDeliveryPlaytestEvidence({ ...event, event: "end" });
    assert(delivery === "recorded", "mobile foreground minute plus explicit outcome must create delivery evidence");
    const deliveryArtifact = await prisma.creativeArtifact.findFirst({
      where: { creativeRevisionId: core.creativeRevisionId, kind: "game_playtest_delivery" },
    });
    assert(deliveryArtifact?.contentJson?.includes('"deviceClass":"mobile"'), "delivery evidence must prove the mobile H5 class");
    assert(!deliveryArtifact?.contentJson?.includes(event.sessionId), "delivery artifact must not retain the random session id");
    console.log("[OK] qa-game-playtest-evidence");
  } finally {
    await prisma.project.delete({ where: { id: project.id } });
    if (coreId) await prisma.creativeProject.delete({ where: { id: coreId } });
  }
}

void main().finally(() => prisma.$disconnect());
