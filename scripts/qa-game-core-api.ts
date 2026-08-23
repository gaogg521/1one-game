import { OWNER_COOKIE } from "../src/lib/constants";
import { randomUUID } from "crypto";
import { prisma } from "../src/lib/prisma";
import { prepareGameSpecForPersist } from "../src/lib/spec-patch";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const baseUrl = process.env.QA_BASE_URL?.trim() || "http://127.0.0.1:8888";

async function main() {
  const ownerKey = `qa-game-core-api-${Date.now()}`;
  const funnelSessionId = randomUUID();
  const baseSpec = prepareGameSpecForPersist(undefined, "霓虹飞船突破机械舰队并击败终局 Boss");
  const spec = {
    ...baseSpec,
    director: {
      intensity: 0.7,
      acts: [
        { at: 0.2, label: "侦察接触", modifiers: ["warning"] },
        { at: 0.7, label: "终局突破", modifiers: ["elite"] },
      ],
    },
  };
  let projectId: string | undefined;
  let coreProjectId: string | undefined;
  try {
    const headers = { "Content-Type": "application/json", Cookie: `${OWNER_COOKIE}=${ownerKey}; gcreator_funnel=${funnelSessionId}` };
    const createdResponse = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers,
      body: JSON.stringify({ prompt: "霓虹飞船突破机械舰队并击败终局 Boss", spec }),
    });
    const created = (await createdResponse.json()) as {
      project?: { id?: string };
      core?: { creativeProjectId?: string; creativeRevisionId?: string; status?: string };
    };
    assert(createdResponse.ok && created.project?.id, "game create API must return a project");
    assert(created.core?.creativeProjectId && created.core.creativeRevisionId, "game create API must create a Core revision");
    projectId = created.project.id;
    coreProjectId = created.core.creativeProjectId;
    const createSignal = await prisma.creatorFunnelEvent.findUnique({
      where: { sessionId_event_workType: { sessionId: funnelSessionId, event: "create", workType: "game" } },
    });
    assert(createSignal, "game creation must write a privacy-safe funnel signal");

    const ownerDetailResponse = await fetch(`${baseUrl}/api/projects/${projectId}`, {
      headers: { Cookie: `${OWNER_COOKIE}=${ownerKey}` },
    });
    const ownerDetail = (await ownerDetailResponse.json()) as { core?: { revision?: { id?: string; artifacts?: Array<{ kind?: string; content?: unknown }> } } };
    assert(ownerDetailResponse.ok, "owner game detail must load");
    assert(ownerDetail.core?.revision?.id === created.core.creativeRevisionId, "owner detail must expose the latest Core revision");
    assert(ownerDetail.core.revision.artifacts?.some((artifact) => artifact.kind === "game_spec"), "owner snapshot must include game spec");
    const sceneGraph = ownerDetail.core.revision.artifacts?.find((artifact) => artifact.kind === "scene_graph")?.content as { scenes?: Array<{ act?: { label?: string } }> } | undefined;
    const behaviorGraph = ownerDetail.core.revision.artifacts?.find((artifact) => artifact.kind === "behavior_graph")?.content as { nodes?: Array<{ label?: string }> } | undefined;
    assert(sceneGraph?.scenes?.some((scene) => scene.act?.label === "终局突破"), "scene graph must preserve saved director acts");
    assert(behaviorGraph?.nodes?.some((node) => node.label === "侦察接触"), "behavior graph must preserve saved director acts");

    const patchResponse = await fetch(`${baseUrl}/api/projects/${projectId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ prompt: "霓虹飞船在机械舰队终局用护盾突破 Boss", spec }),
    });
    const patched = (await patchResponse.json()) as { core?: { creativeRevisionId?: string; status?: string } };
    assert(patchResponse.ok && patched.core?.creativeRevisionId, "game spec edit must create a Core revision");
    assert(patched.core.creativeRevisionId !== created.core.creativeRevisionId, "game edit must advance immutable revision lineage");

    const publicDetailResponse = await fetch(`${baseUrl}/api/projects/${projectId}`);
    const publicDetail = (await publicDetailResponse.json()) as { core?: unknown };
    assert(publicDetailResponse.status === 404 && publicDetail.core === undefined, "unpublished game must be hidden from non-owners");
    console.log("[OK] qa-game-core-api");
  } finally {
    if (projectId) await prisma.project.delete({ where: { id: projectId } }).catch(() => undefined);
    if (coreProjectId) await prisma.creativeProject.delete({ where: { id: coreProjectId } }).catch(() => undefined);
    await prisma.creatorFunnelEvent.deleteMany({ where: { sessionId: funnelSessionId } }).catch(() => undefined);
  }
}

void main().finally(() => prisma.$disconnect());
