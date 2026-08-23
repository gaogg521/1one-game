import { OWNER_COOKIE } from "../src/lib/constants";
import { prisma } from "../src/lib/prisma";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const baseUrl = process.env.QA_BASE_URL?.trim() || "http://127.0.0.1:8888";

async function main() {
  const ownerKey = `qa-comic-job-owner-${Date.now()}`;
  const otherOwnerKey = `${ownerKey}-other`;
  const comic = await prisma.comic.create({
    data: {
      ownerKey,
      visibility: "hidden",
      title: "Comic durable job API QA",
      prompt: "A detective follows a lantern through a rainy old city.",
      status: "ready",
      imageUrls: JSON.stringify({
        formatVersion: 3,
        pageCount: 1,
        pages: [{ page: 1, panels: [{ caption: "雨巷中的灯", prompt: "rainy alley lantern", imageUrl: "/covers/qa-existing.png" }] }],
      }),
    },
  });

  try {
    const ownerHeaders = { "Content-Type": "application/json", Cookie: `${OWNER_COOKIE}=${ownerKey}` };
    const detailResponse = await fetch(`${baseUrl}/api/comic/${comic.id}`, {
      headers: { Cookie: `${OWNER_COOKIE}=${ownerKey}` },
    });
    const detail = (await detailResponse.json()) as { comic?: { revisionToken?: string } };
    assert(detailResponse.ok && detail.comic?.revisionToken, "owner comic detail must provide a storyboard revision token");

    const editResponse = await fetch(`${baseUrl}/api/comic/${comic.id}`, {
      method: "PATCH",
      headers: ownerHeaders,
      body: JSON.stringify({
        expectedRevisionToken: detail.comic.revisionToken,
        storyboardUpdatePanel: { pageIndex: 0, panelIndex: 0, fields: { caption: "雨巷中重新点亮的灯" } },
      }),
    });
    const edited = (await editResponse.json()) as {
      pages?: Array<{ panels?: Array<{ caption?: string }> }>;
      revisionToken?: string;
      core?: { creativeRevisionId?: string; status?: string };
    };
    assert(editResponse.ok && edited.revisionToken, "storyboard edit must advance the revision token");
    assert(edited.revisionToken !== detail.comic.revisionToken, "storyboard edit must produce a fresh revision token");
    assert(edited.core?.creativeRevisionId, "storyboard edit must create a Core revision");
    assert(edited.pages?.[0]?.panels?.[0]?.caption === "雨巷中重新点亮的灯", "storyboard edit must persist its panel text");

    const staleResponse = await fetch(`${baseUrl}/api/comic/${comic.id}`, {
      method: "PATCH",
      headers: ownerHeaders,
      body: JSON.stringify({
        expectedRevisionToken: detail.comic.revisionToken,
        storyboardUpdatePanel: { pageIndex: 0, panelIndex: 0, fields: { caption: "stale overwrite" } },
      }),
    });
    const stale = (await staleResponse.json()) as { errorKey?: string };
    assert(staleResponse.status === 409 && stale.errorKey === "storyboardConflict", "stale storyboard writes must be rejected");

    const queuedResponse = await fetch(`${baseUrl}/api/comic/${comic.id}/panels`, {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({ durable: true }),
    });
    const queued = (await queuedResponse.json()) as { job?: { id?: string; status?: string } };
    assert(queuedResponse.status === 202, `durable queue endpoint expected 202, received ${queuedResponse.status}`);
    assert(queued.job?.id && queued.job.status === "queued", "durable endpoint must return its queued job");

    const activeResponse = await fetch(`${baseUrl}/api/comic/${comic.id}/panels`, {
      headers: { Cookie: `${OWNER_COOKIE}=${ownerKey}` },
    });
    const active = (await activeResponse.json()) as { job?: { id?: string; status?: string } | null };
    assert(activeResponse.ok && active.job?.id === queued.job.id, "owner must recover the active durable job by comic");

    const processedResponse = await fetch(`${baseUrl}/api/jobs/worker`, {
      method: "POST",
      headers: { "x-worker-id": "qa-http-worker" },
    });
    const processed = (await processedResponse.json()) as { processed?: boolean; job?: { id?: string; status?: string } };
    assert(processedResponse.ok && processed.processed, "worker endpoint must claim a queued durable job");
    assert(processed.job?.id === queued.job.id && processed.job.status === "completed", "worker must complete no-missing panel job");

    const statusResponse = await fetch(`${baseUrl}/api/jobs/${queued.job.id}`, {
      headers: { Cookie: `${OWNER_COOKIE}=${ownerKey}` },
    });
    const status = (await statusResponse.json()) as { status?: string; progress?: { percent?: number } };
    assert(statusResponse.ok && status.status === "completed", "owner job status must report completed");
    assert(status.progress?.percent === 100, "completed job must expose 100% progress");

    const forbiddenResponse = await fetch(`${baseUrl}/api/jobs/${queued.job.id}`, {
      headers: { Cookie: `${OWNER_COOKIE}=${otherOwnerKey}` },
    });
    assert(forbiddenResponse.status === 403, "a different owner must not read durable job status");

    const noneResponse = await fetch(`${baseUrl}/api/comic/${comic.id}/panels`, {
      headers: { Cookie: `${OWNER_COOKIE}=${ownerKey}` },
    });
    const none = (await noneResponse.json()) as { job?: unknown };
    assert(noneResponse.ok && none.job === null, "completed jobs must not be returned as active work");
    console.log("[OK] qa-comic-panel-job-api");
  } finally {
    await prisma.creativeProject.deleteMany({ where: { legacyType: "comic", legacyId: comic.id } });
    await prisma.comic.delete({ where: { id: comic.id } });
  }
}

void main().finally(() => prisma.$disconnect());
