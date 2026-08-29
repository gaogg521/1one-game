import { prisma } from "../src/lib/prisma";
import { CreatorPublicationError, setCreatorWorkPublication } from "../src/lib/creator-publication";
import { mirrorGameToCreatorCore } from "../src/lib/creator-core/game-bridge";
import { createCreativeArtifact, getAcceptedLegacyPublicationDisplay, getLegacyCreativeProjectSnapshot } from "../src/lib/creator-core/repository";
import { prepareGameSpecForPersist } from "../src/lib/spec-patch";
import { defaultWorkVisibility } from "../src/lib/auth/work-visibility";
import { canAccessWorkByDirectLink, canReadWorkPublicly } from "../src/lib/literary-safety";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  const previousDefault = process.env.DEFAULT_WORK_VISIBILITY;
  delete process.env.DEFAULT_WORK_VISIBILITY;
  assert(defaultWorkVisibility() === "pending_review", "new creations must default to creator review");
  if (previousDefault === undefined) delete process.env.DEFAULT_WORK_VISIBILITY;
  else process.env.DEFAULT_WORK_VISIBILITY = previousDefault;
  process.env.DEFAULT_WORK_VISIBILITY = "public";
  assert(defaultWorkVisibility() === "pending_review", "deployment configuration must not auto-publish new creations");
  if (previousDefault === undefined) delete process.env.DEFAULT_WORK_VISIBILITY;
  else process.env.DEFAULT_WORK_VISIBILITY = previousDefault;
  assert(!canReadWorkPublicly({ visibility: "pending_review", status: "ready" }), "review work must not appear in public listings");
  assert(canAccessWorkByDirectLink({ visibility: "pending_review", status: "ready" }), "ready review work must be readable via the share URL");
  assert(!canAccessWorkByDirectLink({ visibility: "hidden", status: "ready" }), "hidden work must remain owner-only");
  assert(canReadWorkPublicly({ visibility: "public", status: "ready" }), "explicitly published ready work must be listed");
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
  async function addReadyAssets(creativeProjectId: string, creativeRevisionId: string) {
    await createCreativeArtifact({
      creativeProjectId,
      creativeRevisionId,
      artifact: {
        kind: "asset_manifest",
        mediaType: "json",
        content: {
          backgroundUrl: `/game-bg/${game.id}.png`,
          sprites: [
            { kind: "player", url: `/game-sprites/${game.id}/player.png` },
            { kind: "hazard", url: `/game-sprites/${game.id}/hazard.png` },
          ],
          manifest: { slots: [
            { slot: "background", url: `/game-bg/${game.id}.png` },
            { slot: "player", url: `/game-sprites/${game.id}/player.png` },
            { slot: "enemy", url: `/game-sprites/${game.id}/hazard.png` },
          ] },
        },
      },
    });
    await createCreativeArtifact({
      creativeProjectId,
      creativeRevisionId,
      artifact: {
        kind: "game_production_candidate",
        mediaType: "report",
        content: { version: 1, kind: "game_production_candidate", decision: "ready_for_playtest", score: 90, blockers: [] },
      },
    });
  }
  async function addDeliveryEvidence(creativeProjectId: string, creativeRevisionId: string) {
    await createCreativeArtifact({
      creativeProjectId,
      creativeRevisionId,
      artifact: { kind: "bgm_notes", mediaType: "json", content: { bpm: 112, notes: [{ at: 0, duration: 0.2, frequency: 220 }] } },
    });
    await prisma.creativeArtifact.create({
      data: {
        creativeProjectId,
        creativeRevisionId,
        kind: "game_playtest_delivery",
        mediaType: "report",
        contentJson: JSON.stringify({ version: 1, templateId: spec.templateId, activeMs: 60_000, actionCount: 4, deviceClass: "mobile", touchCapable: true, outcome: "won" }),
        idempotencyKey: `game_playtest_delivery:${creativeRevisionId}`,
      },
    });
  }
  try {
    const mirrored = await mirrorGameToCreatorCore({ project: game });
    coreId = mirrored.creativeProjectId;
    await addReadyAssets(mirrored.creativeProjectId, mirrored.creativeRevisionId);
    await setCreatorWorkPublication({ type: "game", id: game.id, ownerKey, action: "publish" })
      .then(() => { throw new Error("a game without BGM and observed playtest evidence must not publish"); })
      .catch((error) => assert(error instanceof CreatorPublicationError && error.code === "quality_blocked", "delivery evidence must fail closed"));
    await addDeliveryEvidence(mirrored.creativeProjectId, mirrored.creativeRevisionId);
    await prisma.creativeArtifact.updateMany({
      where: {
        creativeProjectId: mirrored.creativeProjectId,
        creativeRevisionId: mirrored.creativeRevisionId,
        kind: "game_delivery_preflight",
      },
      data: { contentJson: JSON.stringify({ version: 1, verdict: "needs_review", score: 100 }) },
    });
    const published = await setCreatorWorkPublication({
      type: "game",
      id: game.id,
      ownerKey,
      action: "publish",
      revisionId: mirrored.creativeRevisionId,
    });
    assert(published.visibility === "public" && published.quality.verdict !== "blocked", "a complete game with advisory balance review should publish");
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
    await addReadyAssets(newerRevision.creativeProjectId, newerRevision.creativeRevisionId);
    await addDeliveryEvidence(newerRevision.creativeProjectId, newerRevision.creativeRevisionId);
    assert(newerRevision.creativeRevisionId !== core.acceptedRevisionId, "a refinement must create a separate immutable revision");
    const coreAfterRefine = await prisma.creativeProject.findUniqueOrThrow({ where: { id: coreId } });
    assert(
      coreAfterRefine.acceptedRevisionId === core.acceptedRevisionId,
      "a later generation must not silently replace the author-accepted revision",
    );
    const historySnapshot = await getLegacyCreativeProjectSnapshot({ ownerKey, legacyType: "project", legacyId: game.id });
    assert(historySnapshot?.project.recentRevisions?.length === 2, "owner snapshot must expose recent immutable revisions");
    assert(historySnapshot?.project.recentRevisions?.[0]?.id === newerRevision.creativeRevisionId, "revision history must place the current draft first");
    assert(historySnapshot?.project.recentRevisions?.[1]?.id === core.acceptedRevisionId, "revision history must retain the confirmed public version");
    assert(historySnapshot?.project.recentRevisions?.[1]?.canRepublish, "a previously published revision must be explicitly safe to republish");
    const publishedLatest = await setCreatorWorkPublication({
      type: "game",
      id: game.id,
      ownerKey,
      action: "publish",
      revisionId: newerRevision.creativeRevisionId,
    });
    assert(publishedLatest.visibility === "public", "the latest ready revision should create its immutable display on explicit publish");
    const coreAfterLatestPublish = await prisma.creativeProject.findUniqueOrThrow({ where: { id: coreId } });
    assert(coreAfterLatestPublish.acceptedRevisionId === newerRevision.creativeRevisionId, "explicit latest-version publish must advance the accepted pointer");
    const republished = await setCreatorWorkPublication({ type: "game", id: game.id, ownerKey, action: "publish", revisionId: core.acceptedRevisionId! });
    assert(republished.visibility === "public", "a historical confirmed version should republish");
    const coreAfterRepublish = await prisma.creativeProject.findUniqueOrThrow({ where: { id: coreId } });
    assert(coreAfterRepublish.acceptedRevisionId === core.acceptedRevisionId, "republish must point the public projection back to the selected historical revision");

    const unpublished = await setCreatorWorkPublication({ type: "game", id: game.id, ownerKey, action: "unpublish" });
    assert(unpublished.visibility === "hidden", "owner should be able to unpublish");
    const hiddenCore = await prisma.creativeProject.findUniqueOrThrow({ where: { id: coreId } });
    assert(hiddenCore.visibility === "hidden" && hiddenCore.status === "ready", "core must reflect unpublish");
    assert(hiddenCore.acceptedRevisionId === core.acceptedRevisionId, "unpublish must not silently change the accepted revision");
    const publicationHistory = await prisma.creativePublication.findMany({ where: { creativeProjectId: coreId }, orderBy: { createdAt: "asc" } });
    assert(publicationHistory.length === 4 && publicationHistory[3]?.action === "unpublish", "each publish and unpublish must append rather than overwrite publication history");
    assert(publicationHistory[2]?.creativeRevisionId === core.acceptedRevisionId, "republish must record the selected historical version");
    assert(publicationHistory[3]?.creativeRevisionId === core.acceptedRevisionId, "unpublish must remain linked to the version that was actually published");

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
