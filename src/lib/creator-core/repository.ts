import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
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

export async function finalizeCreativeRevision(creativeRevisionId: string, summary?: string) {
  return prisma.creativeRevision.update({
    where: { id: creativeRevisionId },
    data: { status: "ready", finalizedAt: new Date(), ...(summary ? { summary } : {}) },
  });
}
