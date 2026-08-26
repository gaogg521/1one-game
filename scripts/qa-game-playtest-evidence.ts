import { prisma } from "../src/lib/prisma";
import { mirrorGameToCreatorCore } from "../src/lib/creator-core/game-bridge";
import { persistFirstMinutePlaytestEvidence } from "../src/lib/game-playtest-evidence";
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
      templateId: spec.templateId,
      event: "first_minute" as const,
      elapsedMs: 60_000,
      verticalSliceScore: 88,
    };
    const result = await persistFirstMinutePlaytestEvidence(event);
    assert(result === "recorded", "first real-minute event must create revision evidence");
    const duplicate = await persistFirstMinutePlaytestEvidence(event);
    assert(duplicate === "already_recorded", "same revision must not write duplicate playtest evidence");

    const artifact = await prisma.creativeArtifact.findFirst({
      where: { creativeRevisionId: core.creativeRevisionId, kind: "game_playtest_first_minute" },
    });
    const evaluation = await prisma.creativeEvaluation.findFirst({
      where: { creativeRevisionId: core.creativeRevisionId, evaluator: "playtest" },
    });
    assert(artifact?.contentJson?.includes("first_minute"), "playtest artifact must record runtime event type");
    assert(!artifact?.contentJson?.includes("session"), "playtest artifact must not retain session identifiers");
    assert(evaluation?.evidenceJson.includes("playtest:first_minute_observed"), "playtest evaluation must expose observed runtime proof");
    assert(!evaluation?.evidenceJson.includes(marker), "playtest evaluation must not retain owner or session-like identifiers");
    console.log("[OK] qa-game-playtest-evidence");
  } finally {
    await prisma.project.delete({ where: { id: project.id } });
    if (coreId) await prisma.creativeProject.delete({ where: { id: coreId } });
  }
}

void main().finally(() => prisma.$disconnect());
