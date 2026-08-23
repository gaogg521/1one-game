import { prisma } from "../src/lib/prisma";
import { CreatorPublicationError, setCreatorWorkPublication } from "../src/lib/creator-publication";
import { mirrorGameToCreatorCore } from "../src/lib/creator-core/game-bridge";
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
    data: { ownerKey, title: spec.title, prompt: "霓虹飞船穿过机械舰队", specJson: JSON.stringify(spec), status: "ready", visibility: "hidden" },
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

    const unpublished = await setCreatorWorkPublication({ type: "game", id: game.id, ownerKey, action: "unpublish" });
    assert(unpublished.visibility === "hidden", "owner should be able to unpublish");
    const hiddenCore = await prisma.creativeProject.findUniqueOrThrow({ where: { id: coreId } });
    assert(hiddenCore.visibility === "hidden" && hiddenCore.status === "ready", "core must reflect unpublish");

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
