import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Creates one game on the production platform exactly as the /create page does,
 * then waits for its revision to finish and reports the delivery evidence.
 *
 * It never publishes. Publishing is a separate decision that belongs to a human
 * who has seen the game.
 *
 *   QA_OWNER_KEY=... QA_GAME_PROMPT="..." npx tsx scripts/create-prod-game.ts
 */
const baseUrl = (process.env.QA_PROD_BASE_URL || "https://operone.1oneclaw.com").replace(/\/$/, "");
const ownerKey = process.env.QA_OWNER_KEY?.trim() || "";
const prompt = process.env.QA_GAME_PROMPT?.trim() || "";
const waitMs = Number(process.env.QA_CREATE_WAIT_MS || 25 * 60_000);
const outDir = path.join(process.cwd(), "qa-output", "prod-game-create");

type Detail = {
  core?: { revision?: { id?: string; sequence?: number; status?: string } };
  runtimeDelivery?: { status?: string; blockers?: string[]; evidence?: string[] };
  job?: { status?: string; attempts?: number } | null;
};

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return { cookie: `gcreator_owner=${ownerKey}`, "Accept-Language": "zh-Hans", ...extra };
}

async function main() {
  assert(ownerKey, "需要 QA_OWNER_KEY");
  assert(prompt.length > 2, "需要 QA_GAME_PROMPT");

  const stages: Array<Record<string, unknown>> = [];
  const record = (stage: string, detail: unknown) => {
    stages.push({ at: new Date().toISOString(), stage, detail });
    console.log(`[${stage}]`, JSON.stringify(detail).slice(0, 500));
  };

  const created = await fetch(`${baseUrl}/api/projects`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ prompt }),
  });
  const createdBody = (await created.json().catch(() => ({}))) as { project?: { id?: string }; errorKey?: string };
  record("created", { status: created.status, projectId: createdBody.project?.id, errorKey: createdBody.errorKey });
  assert.equal(created.status, 200, `创建失败 HTTP ${created.status} ${createdBody.errorKey ?? ""}`);
  const projectId = createdBody.project?.id;
  assert(projectId, "创建后没有拿到项目 ID");

  const deadline = Date.now() + waitMs;
  let latest: Detail = {};
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20_000));
    const res = await fetch(`${baseUrl}/api/projects/${encodeURIComponent(projectId)}`, { headers: headers() });
    if (res.status !== 200) {
      record("poll_error", { status: res.status });
      continue;
    }
    latest = (await res.json()) as Detail;
    const revision = latest.core?.revision;
    record("poll", {
      sequence: revision?.sequence,
      status: revision?.status,
      job: latest.job?.status,
      delivery: latest.runtimeDelivery?.status,
    });
    if (revision?.status && revision.status !== "preparing" && revision.status !== "generating") break;
  }

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(
    path.join(outDir, "create-summary.json"),
    JSON.stringify({ projectId, prompt, revision: latest.core?.revision, runtimeDelivery: latest.runtimeDelivery, stages }, null, 2),
    "utf8",
  );

  const revision = latest.core?.revision;
  console.log(`\nprojectId=${projectId}`);
  console.log(`revision=${revision?.sequence} status=${revision?.status}`);
  console.log(`delivery=${latest.runtimeDelivery?.status} blockers=${JSON.stringify(latest.runtimeDelivery?.blockers ?? [])}`);
  const advisories = (latest.runtimeDelivery?.evidence ?? []).filter((entry) => entry.startsWith("advisory:") || entry.startsWith("screenFill"));
  console.log(`evidence=${JSON.stringify(advisories)}`);
  console.log(`play=${baseUrl}/zh-Hans/play/${projectId}`);
  assert.equal(revision?.status, "ready", `修订未就绪：${revision?.status}`);
}

void main().catch((error) => {
  console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
