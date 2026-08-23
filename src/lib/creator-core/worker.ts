import { ArtifactWritePayloadSchema } from "@/lib/creator-core/types";
import { createCreativeArtifact } from "@/lib/creator-core/repository";
import {
  claimGenerationJob,
  completeGenerationJob,
  failGenerationJob,
} from "@/lib/creator-core/jobs";

/**
 * Durable-job execution boundary. New job types are added here only after
 * their payload schema and idempotency behavior have an integration test.
 */
export async function processNextGenerationJob(workerId: string) {
  const job = await claimGenerationJob(workerId);
  if (!job) return null;
  try {
    if (job.type !== "artifact_write") {
      throw new Error(`unsupported_generation_job:${job.type}`);
    }
    const payload = ArtifactWritePayloadSchema.parse(JSON.parse(job.payloadJson));
    const artifact = await createCreativeArtifact({
      creativeProjectId: job.creativeProjectId,
      creativeRevisionId: job.creativeRevisionId ?? undefined,
      artifact: payload.artifact,
    });
    await completeGenerationJob(job.id, artifact.id);
    return { id: job.id, type: job.type, status: "completed" as const, outputArtifactId: artifact.id };
  } catch (error) {
    const failed = await failGenerationJob(job.id, error);
    return { id: job.id, type: job.type, status: failed.status as "retrying" | "failed" };
  }
}
