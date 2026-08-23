import { prisma } from "../src/lib/prisma";
import { createCreativeProject, createCreativeRevision } from "../src/lib/creator-core/repository";
import { enqueueGenerationJob } from "../src/lib/creator-core/jobs";
import { processNextGenerationJob } from "../src/lib/creator-core/worker";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  const marker = `qa-core-${Date.now()}`;
  const project = await createCreativeProject({ ownerKey: marker, kind: "novel", title: "QA 创作内核" });
  try {
    const first = await createCreativeRevision(project.id, { cause: "user_prompt", intent: { prompt: "一盏灯" } });
    const second = await createCreativeRevision(project.id, { cause: "refine", summary: "补充世界观" });
    assert(first.sequence === 1 && second.sequence === 2, "revisions must be ordered and immutable");
    assert(second.parentRevisionId === first.id, "revision must retain parent lineage");

    const job = await enqueueGenerationJob({
      creativeProjectId: project.id,
      creativeRevisionId: second.id,
      type: "artifact_write",
      idempotencyKey: `${marker}:story-bible`,
      payload: { artifact: { kind: "story_bible", mediaType: "json", content: { characters: [{ name: "灯灵" }] } } },
    });
    const duplicate = await enqueueGenerationJob({
      creativeProjectId: project.id,
      creativeRevisionId: second.id,
      type: "artifact_write",
      idempotencyKey: `${marker}:story-bible`,
      payload: { artifact: { kind: "story_bible", mediaType: "json", content: { ignored: true } } },
    });
    assert(job.id === duplicate.id, "idempotency key must return the original job");

    const processed = await processNextGenerationJob("qa-worker");
    assert(processed?.status === "completed", "artifact job must execute, not merely acknowledge");
    const saved = await prisma.creativeArtifact.findUnique({ where: { id: processed.outputArtifactId } });
    assert(saved?.kind === "story_bible" && saved.creativeRevisionId === second.id, "artifact must preserve revision lineage");
    console.log("[OK] qa-creator-core");
  } finally {
    await prisma.creativeProject.delete({ where: { id: project.id } });
  }
}

void main().finally(() => prisma.$disconnect());
