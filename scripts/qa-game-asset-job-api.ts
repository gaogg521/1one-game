import fs from "node:fs/promises";
import path from "node:path";
import { OWNER_COOKIE } from "../src/lib/constants";
import { prisma } from "../src/lib/prisma";
import { prepareGameSpecForPersist } from "../src/lib/spec-patch";
import { repoPublicPath } from "../src/lib/public-path";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const baseUrl = process.env.QA_BASE_URL?.trim() || "http://127.0.0.1:8888";

async function main() {
  const ownerKey = `qa-game-asset-job-${Date.now()}`;
  const spec = prepareGameSpecForPersist(undefined, "霓虹飞船突破机械舰队并击败终局 Boss");
  let projectId: string | undefined;
  let coreProjectId: string | undefined;
  try {
    const headers = { "Content-Type": "application/json", Cookie: `${OWNER_COOKIE}=${ownerKey}` };
    const createdResponse = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers,
      body: JSON.stringify({ prompt: "霓虹飞船突破机械舰队并击败终局 Boss", spec }),
    });
    const created = (await createdResponse.json()) as {
      project?: { id?: string };
      core?: { creativeProjectId?: string; creativeRevisionId?: string };
      assetJob?: { id?: string; status?: string };
    };
    assert(createdResponse.ok && created.project?.id, "game create API must return a project");
    assert(created.core?.creativeProjectId && created.core.creativeRevisionId, "game create API must create a Core revision");
    assert(created.assetJob?.id && created.assetJob.status === "queued", "game create must enqueue a durable asset job");
    projectId = created.project.id;
    coreProjectId = created.core.creativeProjectId;

    const queuedDetailResponse = await fetch(`${baseUrl}/api/projects/${projectId}`, { headers: { Cookie: `${OWNER_COOKIE}=${ownerKey}` } });
    const queuedDetail = (await queuedDetailResponse.json()) as { assetJob?: { id?: string; status?: string } };
    assert(queuedDetailResponse.ok && queuedDetail.assetJob?.id === created.assetJob.id, "owner detail must expose only its active asset job");

    const spriteDir = repoPublicPath("game-sprites", projectId);
    await fs.mkdir(spriteDir, { recursive: true });
    await fs.mkdir(repoPublicPath("game-bg"), { recursive: true });
    await Promise.all([
      fs.writeFile(repoPublicPath("game-bg", `${projectId}.png`), "qa"),
      ...["player", "hazard", "gem", "power", "boss"].flatMap((kind) => [
        fs.writeFile(path.join(spriteDir, `${kind}.png`), "qa"),
        fs.writeFile(path.join(spriteDir, `${kind}.svg`), "<svg viewBox=\"0 0 1 1\"/>"),
      ]),
    ]);

    const processedResponse = await fetch(`${baseUrl}/api/jobs/worker`, {
      method: "POST",
      headers: { "x-worker-id": "qa-game-assets-worker" },
    });
    const processed = (await processedResponse.json()) as { processed?: boolean; job?: { id?: string; status?: string; outputArtifactId?: string } };
    assert(processedResponse.ok && processed.processed, "worker must claim a queued game asset job");
    assert(processed.job?.id === created.assetJob.id && processed.job.status === "completed", "worker must complete the requested game asset job");
    assert(processed.job.outputArtifactId, "game asset job must retain its manifest artifact");

    const statusResponse = await fetch(`${baseUrl}/api/jobs/${created.assetJob.id}`, {
      headers: { Cookie: `${OWNER_COOKIE}=${ownerKey}` },
    });
    const status = (await statusResponse.json()) as { status?: string; progress?: { percent?: number } };
    assert(statusResponse.ok && status.status === "completed" && status.progress?.percent === 100, "owner must see durable asset completion");

    const detailResponse = await fetch(`${baseUrl}/api/projects/${projectId}`, { headers: { Cookie: `${OWNER_COOKIE}=${ownerKey}` } });
    const detail = (await detailResponse.json()) as { core?: { revision?: { id?: string; artifacts?: Array<{ kind?: string }> } } };
    assert(detailResponse.ok && detail.core?.revision?.id === created.core.creativeRevisionId, "owner must retain the creation revision");
    assert(detail.core.revision.artifacts?.some((artifact) => artifact.kind === "asset_manifest"), "Core revision must retain its generated asset manifest");

    const recoveryResponse = await fetch(`${baseUrl}/api/projects/${projectId}/background`, {
      method: "POST",
      headers,
      body: JSON.stringify({ durable: true }),
    });
    const recovery = (await recoveryResponse.json()) as { job?: { id?: string; status?: string } };
    assert(recoveryResponse.status === 202 && recovery.job?.id && recovery.job.status === "queued", "owner must explicitly queue recoverable art completion");

    const recoveryProcessedResponse = await fetch(`${baseUrl}/api/jobs/worker`, { method: "POST", headers: { "x-worker-id": "qa-game-assets-recovery-worker" } });
    const recoveryProcessed = (await recoveryProcessedResponse.json()) as { job?: { id?: string; status?: string } };
    assert(recoveryProcessedResponse.ok && recoveryProcessed.job?.id === recovery.job.id && recoveryProcessed.job.status === "completed", "worker must complete an explicit recovery task");
    console.log("[OK] qa-game-asset-job-api");
  } finally {
    if (projectId) {
      await fs.rm(repoPublicPath("game-bg", `${projectId}.png`), { force: true }).catch(() => undefined);
      await fs.rm(repoPublicPath("game-sprites", projectId), { recursive: true, force: true }).catch(() => undefined);
      await prisma.project.delete({ where: { id: projectId } }).catch(() => undefined);
    }
    if (coreProjectId) await prisma.creativeProject.delete({ where: { id: coreProjectId } }).catch(() => undefined);
  }
}

void main().finally(() => prisma.$disconnect());
