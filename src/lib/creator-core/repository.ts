import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CreatorQualityReport } from "@/lib/creator-workflow";
import {
  CreativeArtifactInputSchema,
  CreativeProjectInputSchema,
  CreativeRevisionInputSchema,
  type CreativeArtifactInput,
  type CreativeProjectInput,
  type CreativeRevisionInput,
} from "@/lib/creator-core/types";

function stringify(value: unknown): string | undefined {
  return value === undefined ? undefined : JSON.stringify(value);
}

function artifactHash(input: CreativeArtifactInput): string {
  if (input.contentHash) return input.contentHash;
  const value = input.textContent ?? stringify(input.content) ?? input.storageUri ?? "";
  return createHash("sha256").update(value).digest("hex");
}

function parseJson(value: string | null): unknown | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export async function createCreativeProject(input: CreativeProjectInput) {
  const parsed = CreativeProjectInputSchema.parse(input);
  return prisma.creativeProject.create({ data: parsed });
}

/** One shadow project per legacy work while product lines migrate without downtime. */
export async function ensureLegacyCreativeProject(input: Omit<CreativeProjectInput, "visibility" | "legacyType" | "legacyId"> & {
  visibility?: "private" | "pending_review" | "public" | "hidden";
  legacyType: string;
  legacyId: string;
}) {
  const parsed = CreativeProjectInputSchema.parse(input);
  return prisma.creativeProject.upsert({
    where: {
      legacyType_legacyId: {
        legacyType: parsed.legacyType!,
        legacyId: parsed.legacyId!,
      },
    },
    create: parsed,
    update: { title: parsed.title, ownerKey: parsed.ownerKey },
  });
}

/** Creates an immutable revision; retries only the sequence collision caused by concurrent authors/jobs. */
export async function createCreativeRevision(
  creativeProjectId: string,
  input: CreativeRevisionInput,
) {
  const parsed = CreativeRevisionInputSchema.parse(input);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const latest = await prisma.creativeRevision.findFirst({
      where: { creativeProjectId },
      orderBy: { sequence: "desc" },
      select: { id: true, sequence: true },
    });
    try {
      return await prisma.creativeRevision.create({
        data: {
          creativeProjectId,
          sequence: (latest?.sequence ?? 0) + 1,
          parentRevisionId: parsed.parentRevisionId ?? latest?.id,
          cause: parsed.cause,
          status: "preparing",
          intentJson: stringify(parsed.intent),
          summary: parsed.summary,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
  throw new Error("creative_revision_sequence_conflict");
}

export async function createCreativeArtifact(input: {
  creativeProjectId: string;
  creativeRevisionId?: string;
  artifact: CreativeArtifactInput;
}) {
  const artifact = CreativeArtifactInputSchema.parse(input.artifact);
  return prisma.creativeArtifact.create({
    data: {
      creativeProjectId: input.creativeProjectId,
      creativeRevisionId: input.creativeRevisionId,
      kind: artifact.kind,
      mediaType: artifact.mediaType,
      contentJson: stringify(artifact.content),
      textContent: artifact.textContent,
      storageUri: artifact.storageUri,
      contentHash: artifactHash(artifact),
      provider: artifact.provider,
      sourceArtifactId: artifact.sourceArtifactId,
      metadataJson: stringify(artifact.metadata),
    },
  });
}

/** Stores the exact quality decision used for a revision, independently of report artifacts. */
export async function recordCreativeEvaluation(input: {
  creativeProjectId: string;
  creativeRevisionId?: string;
  evaluator?: "deterministic_quality" | "human_review" | "playtest";
  report: CreatorQualityReport;
}) {
  return prisma.creativeEvaluation.create({
    data: {
      creativeProjectId: input.creativeProjectId,
      creativeRevisionId: input.creativeRevisionId,
      evaluator: input.evaluator ?? "deterministic_quality",
      verdict: input.report.verdict,
      // Some shared report producers type score as optional; persist a stable
      // numeric audit field even when a legacy producer omits it.
      score: Math.round(input.report.score ?? 0),
      evidenceJson: JSON.stringify(input.report.evidence),
      reportJson: JSON.stringify(input.report),
    },
  });
}

export async function finalizeCreativeRevision(creativeRevisionId: string, summary?: string) {
  return prisma.creativeRevision.update({
    where: { id: creativeRevisionId },
    data: { status: "ready", finalizedAt: new Date(), ...(summary ? { summary } : {}) },
  });
}

/**
 * The migration read-model for a legacy work. It exposes only the latest
 * immutable revision, so creator screens never accidentally compose assets
 * from different saves.
 */
export async function getLegacyCreativeProjectSnapshot(input: {
  ownerKey: string;
  legacyType: string;
  legacyId: string;
}) {
  const project = await prisma.creativeProject.findUnique({
    where: { legacyType_legacyId: { legacyType: input.legacyType, legacyId: input.legacyId } },
    select: {
      id: true,
      kind: true,
      title: true,
      visibility: true,
      acceptedRevisionId: true,
      updatedAt: true,
      ownerKey: true,
      evaluations: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { verdict: true, score: true, evidenceJson: true, createdAt: true },
      },
      publications: {
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { action: true, visibility: true, decision: true, qualityVerdict: true, qualityScore: true, createdAt: true },
      },
      revisions: {
        orderBy: { sequence: "desc" },
        take: 1,
        select: {
          id: true,
          sequence: true,
          cause: true,
          status: true,
          summary: true,
          finalizedAt: true,
          artifacts: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              kind: true,
              mediaType: true,
              textContent: true,
              contentJson: true,
              metadataJson: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });
  if (!project || project.ownerKey !== input.ownerKey) return null;

  const revision = project.revisions[0];
  return {
    project: {
      id: project.id,
      kind: project.kind,
      title: project.title,
      visibility: project.visibility,
      acceptedRevisionId: project.acceptedRevisionId,
      updatedAt: project.updatedAt,
      evaluation: project.evaluations[0]
        ? {
            verdict: project.evaluations[0].verdict,
            score: project.evaluations[0].score,
            evidence: parseJson(project.evaluations[0].evidenceJson),
            createdAt: project.evaluations[0].createdAt,
          }
        : null,
      publications: project.publications,
    },
    revision: revision
      ? {
          id: revision.id,
          sequence: revision.sequence,
          cause: revision.cause,
          status: revision.status,
          summary: revision.summary,
          finalizedAt: revision.finalizedAt,
          artifacts: revision.artifacts.map((artifact) => ({
            id: artifact.id,
            kind: artifact.kind,
            mediaType: artifact.mediaType,
            textContent: artifact.textContent,
            content: parseJson(artifact.contentJson),
            metadata: parseJson(artifact.metadataJson),
            createdAt: artifact.createdAt,
          })),
        }
      : null,
  };
}
