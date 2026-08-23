/** Real local HTTP guard for the author publish / unpublish transition. */
import { config as loadEnv } from "dotenv";
import { randomUUID } from "crypto";
import { prisma } from "../src/lib/prisma";
import { mirrorGameToCreatorCore } from "../src/lib/creator-core/game-bridge";
import { prepareGameSpecForPersist } from "../src/lib/spec-patch";

loadEnv();

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  const base = process.env.QA_BASE_URL?.trim() || "http://127.0.0.1:8888";
  const ownerKey = `qa-publication-http-${Date.now()}`;
  const funnelSessionId = randomUUID();
  const spec = prepareGameSpecForPersist(undefined, "霓虹飞船突破机械舰队");
  const game = await prisma.project.create({
    data: {
      ownerKey, title: spec.title, prompt: "霓虹飞船突破机械舰队", specJson: JSON.stringify(spec),
      coverPath: "/covers/qa-confirmed-game.jpg", status: "ready", visibility: "pending_review",
    },
  });
  let coreId: string | null = null;
  try {
    coreId = (await mirrorGameToCreatorCore({ project: game })).creativeProjectId;
    const unauthenticated = await fetch(`${base}/api/projects/${game.id}`);
    assert(unauthenticated.status === 404, `pending work must be hidden from public, got ${unauthenticated.status}`);
    const headers = { Cookie: `gcreator_owner=${ownerKey}; gcreator_funnel=${funnelSessionId}`, "Content-Type": "application/json" };
    const ownerRead = await fetch(`${base}/api/projects/${game.id}`, { headers });
    assert(ownerRead.ok, `owner must be able to read pending work, got ${ownerRead.status}`);
    const published = await fetch(`${base}/api/works/game/${game.id}/publication`, {
      method: "POST", headers, body: JSON.stringify({ action: "publish" }),
    });
    const publishedBody = await published.json() as { visibility?: string };
    assert(published.ok && publishedBody.visibility === "public", `publish must succeed, got ${published.status}`);
    const publishSignal = await prisma.creatorFunnelEvent.findUnique({
      where: { sessionId_event_workType: { sessionId: funnelSessionId, event: "publish", workType: "game" } },
    });
    assert(publishSignal, "publication must write a privacy-safe funnel signal");
    assert((await fetch(`${base}/api/projects/${game.id}`)).ok, "published game must be publicly readable");
    const revisedSpec = { ...spec, title: "发布后尚未确认的新版本" };
    const revised = await fetch(`${base}/api/projects/${game.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ prompt: "把公开游戏改成尚未确认的新版本", spec: revisedSpec }),
    });
    assert(revised.ok, `owner refinement must save, got ${revised.status}`);
    const ownerAfterRefine = await (await fetch(`${base}/api/projects/${game.id}`, { headers })).json() as {
      spec?: { title?: string };
      core?: { revision?: { id?: string }; project?: { acceptedRevision?: { id?: string }; recentRevisions?: Array<{ id?: string }> } };
    };
    assert(ownerAfterRefine.spec?.title === revisedSpec.title, "owner must see the editable refined version");
    assert(ownerAfterRefine.core?.project?.recentRevisions?.length === 2, "owner API must expose recent immutable versions");
    assert(ownerAfterRefine.core?.project?.recentRevisions?.[0]?.id === ownerAfterRefine.core?.revision?.id, "owner API must put the current draft first");
    assert(ownerAfterRefine.core?.project?.recentRevisions?.[1]?.id === ownerAfterRefine.core?.project?.acceptedRevision?.id, "owner API must retain the confirmed public version");
    await prisma.project.update({ where: { id: game.id }, data: { coverPath: "/covers/qa-unconfirmed-game.jpg" } });
    const publicAfterRefine = await (await fetch(`${base}/api/projects/${game.id}`)).json() as {
      spec?: { title?: string };
      project?: { title?: string; prompt?: string; coverPath?: string | null };
    };
    assert(publicAfterRefine.spec?.title === spec.title, "public reader must remain on the author-confirmed revision until republish");
    assert(publicAfterRefine.project?.title === spec.title, "public title must remain on the author-confirmed publication display");
    assert(publicAfterRefine.project?.prompt === game.prompt, "public prompt must not leak an unconfirmed refinement");
    assert(publicAfterRefine.project?.coverPath === game.coverPath, "public cover must remain on the author-confirmed publication display");
    const unpublished = await fetch(`${base}/api/works/game/${game.id}/publication`, {
      method: "POST", headers, body: JSON.stringify({ action: "unpublish" }),
    });
    const unpublishedBody = await unpublished.json() as { visibility?: string };
    assert(unpublished.ok && unpublishedBody.visibility === "hidden", `unpublish must succeed, got ${unpublished.status}`);
    assert((await fetch(`${base}/api/projects/${game.id}`)).status === 404, "unpublished game must no longer be public");
    console.log("[OK] qa-creator-publication-api");
  } finally {
    await prisma.project.delete({ where: { id: game.id } });
    if (coreId) await prisma.creativeProject.delete({ where: { id: coreId } });
    await prisma.creatorFunnelEvent.deleteMany({ where: { sessionId: funnelSessionId } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

void main();
