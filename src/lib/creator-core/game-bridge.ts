import type { Project } from "@prisma/client";
import { assessGameCreatorQuality } from "@/lib/creator-quality";
import { parseStoredCreativeBrief } from "@/lib/project-creative-brief-db";
import { parseGameSpec } from "@/lib/game-spec";
import {
  createCreativeArtifact,
  createCreativeRevision,
  ensureLegacyCreativeProject,
  finalizeCreativeRevision,
} from "@/lib/creator-core/repository";

export type GameCoreMirror = { creativeProjectId: string; creativeRevisionId: string };

/** Mirrors a playable game design as an immutable, owner-addressable Core revision. */
export async function mirrorGameToCreatorCore(input: {
  project: Pick<Project, "id" | "ownerKey" | "title" | "prompt" | "specJson" | "status" | "visibility" | "coverPath" | "creativeBriefJson">;
  cause?: "generate" | "refine" | "import";
}): Promise<GameCoreMirror> {
  const spec = parseGameSpec(JSON.parse(input.project.specJson));
  const brief = parseStoredCreativeBrief(input.project.creativeBriefJson);
  const quality = assessGameCreatorQuality(spec, brief).report;
  const project = await ensureLegacyCreativeProject({
    ownerKey: input.project.ownerKey,
    kind: "game",
    title: input.project.title,
    legacyType: "project",
    legacyId: input.project.id,
  });
  const revision = await createCreativeRevision(project.id, {
    cause: input.cause ?? "generate",
    intent: {
      prompt: input.project.prompt,
      legacyProjectId: input.project.id,
      status: input.project.status,
      visibility: input.project.visibility,
      templateId: spec.templateId,
    },
    summary: `${spec.templateId} · ${quality.score}/100 · ${quality.verdict}`,
  });
  const revisionInput = { creativeProjectId: project.id, creativeRevisionId: revision.id };
  await createCreativeArtifact({
    ...revisionInput,
    artifact: { kind: "game_spec", mediaType: "json", content: spec, metadata: { templateId: spec.templateId } },
  });
  if (brief) {
    await createCreativeArtifact({
      ...revisionInput,
      artifact: { kind: "creative_brief", mediaType: "json", content: brief },
    });
  }
  await createCreativeArtifact({
    ...revisionInput,
    artifact: { kind: "evaluation", mediaType: "report", content: quality },
  });
  await createCreativeArtifact({
    ...revisionInput,
    artifact: {
      kind: "playable_route",
      mediaType: "json",
      content: { templateId: spec.templateId, route: spec.agenticPlayRoute ?? "dedicated", coverPath: input.project.coverPath },
    },
  });
  await finalizeCreativeRevision(revision.id);
  return { creativeProjectId: project.id, creativeRevisionId: revision.id };
}
