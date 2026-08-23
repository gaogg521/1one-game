/** Real local HTTP guard for the author publish / unpublish transition. */
import { config as loadEnv } from "dotenv";
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
  const spec = prepareGameSpecForPersist(undefined, "霓虹飞船突破机械舰队");
  const game = await prisma.project.create({
    data: { ownerKey, title: spec.title, prompt: "霓虹飞船突破机械舰队", specJson: JSON.stringify(spec), status: "ready", visibility: "pending_review" },
  });
  let coreId: string | null = null;
  try {
    coreId = (await mirrorGameToCreatorCore({ project: game })).creativeProjectId;
    const unauthenticated = await fetch(`${base}/api/projects/${game.id}`);
    assert(unauthenticated.status === 404, `pending work must be hidden from public, got ${unauthenticated.status}`);
    const headers = { Cookie: `gcreator_owner=${ownerKey}`, "Content-Type": "application/json" };
    const ownerRead = await fetch(`${base}/api/projects/${game.id}`, { headers });
    assert(ownerRead.ok, `owner must be able to read pending work, got ${ownerRead.status}`);
    const published = await fetch(`${base}/api/works/game/${game.id}/publication`, {
      method: "POST", headers, body: JSON.stringify({ action: "publish" }),
    });
    const publishedBody = await published.json() as { visibility?: string };
    assert(published.ok && publishedBody.visibility === "public", `publish must succeed, got ${published.status}`);
    assert((await fetch(`${base}/api/projects/${game.id}`)).ok, "published game must be publicly readable");
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
    await prisma.$disconnect();
  }
}

void main();
