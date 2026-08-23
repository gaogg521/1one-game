import { prisma } from "../src/lib/prisma";
import { CreatorPublicationError, setCreatorWorkPublication } from "../src/lib/creator-publication";
import { mirrorGameToCreatorCore } from "../src/lib/creator-core/game-bridge";
import { getAcceptedLegacyPublicationDisplay, getLegacyCreativeProjectSnapshot } from "../src/lib/creator-core/repository";
import { prepareGameSpecForPersist } from "../src/lib/spec-patch";
import { defaultWorkVisibility } from "../src/lib/auth/work-visibility";
import { canReadWorkPublicly } from "../src/lib/literary-safety";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  const previousDefault = process.env.DEFAULT_WORK_VISIBILITY;
  delete process.env.DEFAULT_WORK_VISIBILITY;
  assert(defaultWorkVisibility() === "pending_review", "new creations must default to creator review");
  if (previousDefault === undefined) delete process.env.DEFAULT_WORK_VISIBILITY;
  else process.env.DEFAULT_WORK_VISIBILITY = previousDefault;
  assert(!canReadWorkPublicly({ visibility: "pending_review", status: "ready" }), "review work must not be publicly readable");
  assert(canReadWorkPublicly({ visibility: "public", status: "ready" }), "explicitly published ready work must be readable");
  const ownerKey = `qa-publication-${Date.now()}`;
  const spec = prepareGameSpecForPersist(undefined, "霓虹飞船穿过机械舰队");
  const game = await prisma.project.create({
    data: {
      ownerKey, title: spec.title, prompt: "霓虹飞船穿过机械舰队", specJson: JSON.stringify(spec),
      coverPath: "/covers/qa-confirmed-game.jpg", status: "ready", visibility: "hidden",
    },
  });
  const comic = await prisma.comic.create({
    data: { ownerKey, title: "空白分镜", prompt: "测试", imageUrls: JSON.stringify({ pages: [{ page: 1, panels: [] }] }), status: "ready", visibility: "hidden" },
  });
  let coreId: string | null = null;
  try {
    coreId = (await mirrorGameToCreatorCore({ project: game })).creativeProjectId;
    const published = await setCreatorWorkPublication({ type: "game", id: game.id, ownerKey, action: "publish" });
    assert(published.visibility === "public" && published.quality.verdict !== "blocked", "ready game should publish");
    const persisted = await prisma.project.findUniqueOrThrow({ where: { id: game.id } });
    const core = await prisma.creativeProject.findUniqueOrThrow({ where: { id: coreId } });
    assert(persisted.visibility === "public", "legacy work must become public");
    assert(core.visibility === "public" && core.status === "published", "core publication state must stay in sync");
    assert(core.acceptedRevisionId, "publish must explicitly accept an immutable revision");
    const ownerSnapshot = await getLegacyCreativeProjectSnapshot({ ownerKey, legacyType: "project", legacyId: game.id });
    assert(ownerSnapshot?.project.acceptedRevision?.id === core.acceptedRevisionId, "owner snapshot must expose the confirmed revision for version UI");
    const publishDecision = await prisma.creativePublication.findFirst({
      where: { creativeProjectId: coreId, action: "publish" },
      orderBy: { createdAt: "desc" },
    });
    assert(publishDecision?.decision === "approved" && publishDecision.visibility === "public", "publish must write an immutable Core decision");
    assert(publishDecision?.creativeRevisionId === core.acceptedRevisionId, "publication must point to the author-accepted revision");
    const acceptedDisplay = await getAcceptedLegacyPublicationDisplay({ legacyType: "project", legacyId: game.id });
    assert(acceptedDisplay?.title === game.title, "publish must capture the reader-facing title with the accepted revision");
    assert(acceptedDisplay?.prompt === game.prompt, "publish must capture the reader-facing prompt with the accepted revision");
    assert(acceptedDisplay?.coverPath === game.coverPath, "publish must capture the reader-facing cover with the accepted revision");

    const newerRevision = await mirrorGameToCreatorCore({ project: game, cause: "refine" });
    assert(newerRevision.creativeRevisionId !== core.acceptedRevisionId, "a refinement must create a separate immutable revision");
    const coreAfterRefine = await prisma.creativeProject.findUniqueOrThrow({ where: { id: coreId } });
    assert(
      coreAfterRefine.acceptedRevisionId === core.acceptedRevisionId,
      "a later generation must not silently replace the author-accepted revision",
    );

    const unpublished = await setCreatorWorkPublication({ type: "game", id: game.id, ownerKey, action: "unpublish" });
    assert(unpublished.visibility === "hidden", "owner should be able to unpublish");
    const hiddenCore = await prisma.creativeProject.findUniqueOrThrow({ where: { id: coreId } });
    assert(hiddenCore.visibility === "hidden" && hiddenCore.status === "ready", "core must reflect unpublish");
    assert(hiddenCore.acceptedRevisionId === core.acceptedRevisionId, "unpublish must not silently change the accepted revision");
    const publicationHistory = await prisma.creativePublication.findMany({ where: { creativeProjectId: coreId }, orderBy: { createdAt: "asc" } });
    assert(publicationHistory.length === 2 && publicationHistory[1]?.action === "unpublish", "unpublish must append rather than overwrite publication history");
    assert(publicationHistory[1]?.creativeRevisionId === core.acceptedRevisionId, "unpublish must remain linked to the version that was actually published");

    await setCreatorWorkPublication({ type: "game", id: game.id, ownerKey: `${ownerKey}-other`, action: "publish" })
      .then(() => { throw new Error("other owners must not publish this work"); })
      .catch((error) => assert(error instanceof CreatorPublicationError && error.code === "not_owner", "publication must require owner"));

    await setCreatorWorkPublication({ type: "comic", id: comic.id, ownerKey, action: "publish" })
      .then(() => { throw new Error("blocked comic must not publish"); })
      .catch((error) => assert(error instanceof CreatorPublicationError && error.code === "quality_blocked", "blocked quality must fail closed"));
    console.log("[OK] qa-creator-publication");
  } finally {
    await prisma.project.delete({ where: { id: game.id } });
    await prisma.comic.delete({ where: { id: comic.id } });
    if (coreId) await prisma.creativeProject.delete({ where: { id: coreId } });
    await prisma.$disconnect();
  }
}

void main();
