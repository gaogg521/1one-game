import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Drives one owner-side targeted edit against a production game and waits for
 * the revision it creates, mirroring exactly what the play page does:
 * refine (patch) -> PATCH the project -> a new revision and production job.
 *
 * It never creates a project. Reusing the game under test is the point: a
 * second game would hide whether the edit path works on the first one.
 *
 *   QA_OWNER_KEY=... QA_PROD_GAME_PROJECT_ID=... \
 *   QA_REFINE_INSTRUCTION="..." npx tsx scripts/refine-prod-game.ts
 */

const baseUrl = (process.env.QA_PROD_BASE_URL || "https://operone.1oneclaw.com").replace(/\/$/, "");
const projectId = process.env.QA_PROD_GAME_PROJECT_ID?.trim() || "";
const ownerKey = process.env.QA_OWNER_KEY?.trim() || "";
const instruction = process.env.QA_REFINE_INSTRUCTION?.trim() || "";
const outputDir = path.join(process.cwd(), "qa-output", "prod-game-refine");
const waitMs = Number(process.env.QA_REFINE_WAIT_MS || 20 * 60_000);

type Detail = {
  prompt?: string;
  spec?: unknown;
  core?: { revision?: { id?: string; sequence?: number; status?: string; cause?: string } };
  runtimeDelivery?: { status?: string; blockers?: string[]; evidence?: string[] };
  job?: { id?: string; status?: string; attempts?: number } | null;
};

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const superAdminKey = process.env.QA_SUPER_ADMIN_KEY?.trim();
  return {
    cookie: `gcreator_owner=${ownerKey}`,
    ...(superAdminKey ? { "X-Super-Admin-Key": superAdminKey } : {}),
    ...extra,
  };
}

async function readProject(): Promise<Detail> {
  const res = await fetch(`${baseUrl}/api/projects/${encodeURIComponent(projectId)}`, { headers: headers() });
  assert.equal(res.status, 200, `读取项目失败 HTTP ${res.status}`);
  return (await res.json()) as Detail;
}

async function main() {
  assert(projectId, "需要 QA_PROD_GAME_PROJECT_ID");
  assert(ownerKey, "需要 QA_OWNER_KEY（作品 owner 的 gcreator_owner cookie）");
  assert(instruction, "需要 QA_REFINE_INSTRUCTION");

  const stages: Array<Record<string, unknown>> = [];
  const record = (stage: string, detail: unknown) => {
    stages.push({ at: new Date().toISOString(), stage, detail });
    console.log(`[${stage}]`, JSON.stringify(detail).slice(0, 600));
  };

  const before = await readProject();
  const beforeSequence = before.core?.revision?.sequence ?? 0;
  record("project_loaded", { revision: before.core?.revision, delivery: before.runtimeDelivery?.status });

  const refineStarted = Date.now();
  const refineRes = await fetch(`${baseUrl}/api/projects/${encodeURIComponent(projectId)}/refine`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ instruction, mode: "patch" }),
  });
  const refineBody = (await refineRes.json()) as { spec?: unknown; prompt?: string; editedModules?: string[]; errorKey?: string };
  record("refine_response", {
    status: refineRes.status,
    ms: Date.now() - refineStarted,
    editedModules: refineBody.editedModules,
    errorKey: refineBody.errorKey,
  });
  assert.equal(refineRes.status, 200, `refine 失败 HTTP ${refineRes.status} ${refineBody.errorKey ?? ""}`);
  assert(refineBody.spec, "refine 没有返回 spec");

  const saveRes = await fetch(`${baseUrl}/api/projects/${encodeURIComponent(projectId)}`, {
    method: "PATCH",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ prompt: refineBody.prompt ?? before.prompt, spec: refineBody.spec }),
  });
  const saveBody = (await saveRes.json()) as { core?: { creativeRevisionId?: string }; errorKey?: string };
  record("save_response", { status: saveRes.status, revisionId: saveBody.core?.creativeRevisionId, errorKey: saveBody.errorKey });
  assert.equal(saveRes.status, 200, `保存失败 HTTP ${saveRes.status} ${saveBody.errorKey ?? ""}`);

  const deadline = Date.now() + waitMs;
  let latest = before;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 15_000));
    latest = await readProject();
    const revision = latest.core?.revision;
    record("poll", {
      sequence: revision?.sequence,
      status: revision?.status,
      job: latest.job?.status,
      delivery: latest.runtimeDelivery?.status,
    });
    const advanced = (revision?.sequence ?? 0) > beforeSequence;
    if (advanced && revision?.status && revision.status !== "preparing" && revision.status !== "generating") break;
  }

  const revision = latest.core?.revision;
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(
    path.join(outputDir, "refine-summary.json"),
    JSON.stringify({ projectId, instruction, beforeSequence, revision, runtimeDelivery: latest.runtimeDelivery, stages }, null, 2),
    "utf8",
  );

  assert((revision?.sequence ?? 0) > beforeSequence, `没有产生新修订：仍是 sequence ${revision?.sequence}`);
  assert.equal(revision?.status, "ready", `新修订未就绪：${revision?.status}`);
  console.log(`[OK] ${projectId} 产生新修订 sequence=${revision?.sequence} status=${revision?.status}`);
  console.log(`     交付状态 ${latest.runtimeDelivery?.status} blockers=${JSON.stringify(latest.runtimeDelivery?.blockers ?? [])}`);
}

void main().catch((error) => {
  console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
