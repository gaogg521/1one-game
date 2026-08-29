import type { Project } from "@prisma/client";
import { assessGameCreatorQuality } from "@/lib/creator-quality";
import { parseStoredCreativeBrief } from "@/lib/project-creative-brief-db";
import { parseGameSpec } from "@/lib/game-spec";
import { buildGameDesignGraphs } from "@/lib/creator-core/game-design-graph";
import { evaluateGameDeliveryReadiness } from "@/lib/game-delivery-readiness";
import { evaluateGameVerticalSlice } from "@/lib/game-vertical-slice";
import { buildGameProductionPipelineReport } from "@/lib/game-production-pipeline";
import { buildGameEditSchema } from "@/lib/game-edit-schema";
import {
  createCreativeArtifact,
  createCreativeRevision,
  ensureLegacyCreativeProject,
  finalizeCreativeRevision,
  recordCreativeEvaluation,
} from "@/lib/creator-core/repository";

export type GameCoreMirror = { creativeProjectId: string; creativeRevisionId: string };

/** Mirrors a playable game design as an immutable, owner-addressable Core revision. */
export async function mirrorGameToCreatorCore(input: {
  project: Pick<Project, "id" | "ownerKey" | "title" | "prompt" | "specJson" | "status" | "visibility" | "coverPath" | "creativeBriefJson">;
  cause?: "generate" | "refine" | "import";
  deferFinalization?: boolean;
}): Promise<GameCoreMirror> {
  const spec = parseGameSpec(JSON.parse(input.project.specJson));
  const brief = parseStoredCreativeBrief(input.project.creativeBriefJson);
  const quality = assessGameCreatorQuality(spec, brief).report;
  const deliveryReadiness = evaluateGameDeliveryReadiness(spec);
  const { sceneGraph, behaviorGraph } = buildGameDesignGraphs(spec);
  const productionPipeline = buildGameProductionPipelineReport({
    spec,
    verticalSlice: evaluateGameVerticalSlice(spec),
    delivery: deliveryReadiness,
    sceneCount: sceneGraph.scenes.length,
    behaviorNodeCount: behaviorGraph.nodes.length,
  });
  const editSchema = buildGameEditSchema(spec);
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
  await createCreativeArtifact({
    ...revisionInput,
    artifact: {
      kind: "game_edit_schema",
      mediaType: "json",
      content: editSchema,
      metadata: { templateId: spec.templateId, runtimeStrategy: editSchema.runtimeStrategy, controls: editSchema.controls.length },
    },
  });
  await createCreativeArtifact({
    ...revisionInput,
    artifact: {
      kind: "game_production_pipeline",
      mediaType: "report",
      content: productionPipeline,
      metadata: { templateId: spec.templateId, verdict: productionPipeline.preflightVerdict },
    },
  });
  await createCreativeArtifact({
    ...revisionInput,
    artifact: {
      kind: "game_balance_simulation",
      mediaType: "report",
      content: deliveryReadiness.balance,
      metadata: { templateId: spec.templateId, verdict: deliveryReadiness.balance.verdict, passRate: deliveryReadiness.balance.passRate },
    },
  });
  await createCreativeArtifact({
    ...revisionInput,
    artifact: {
      kind: "game_delivery_contract",
      mediaType: "json",
      content: spec.production?.delivery ?? null,
      metadata: { templateId: spec.templateId, targetDevice: spec.production?.delivery?.targetDevice ?? "unknown" },
    },
  });
  await createCreativeArtifact({
    ...revisionInput,
    artifact: {
      kind: "game_delivery_preflight",
      mediaType: "report",
      content: deliveryReadiness,
      metadata: { templateId: spec.templateId, verdict: deliveryReadiness.verdict, score: deliveryReadiness.score },
    },
  });
  await createCreativeArtifact({
    ...revisionInput,
    artifact: { kind: "scene_graph", mediaType: "json", content: sceneGraph, metadata: { templateId: spec.templateId } },
  });
  await createCreativeArtifact({
    ...revisionInput,
    artifact: { kind: "behavior_graph", mediaType: "json", content: behaviorGraph, metadata: { templateId: spec.templateId } },
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
  await recordCreativeEvaluation({
    creativeProjectId: project.id,
    creativeRevisionId: revision.id,
    report: quality,
  });
  if (!input.deferFinalization) await finalizeCreativeRevision(revision.id);
  return { creativeProjectId: project.id, creativeRevisionId: revision.id };
}
