/**
 * platform-test-user 创作台 ?from= 回放链路（离线 API + 可选 HTTP）
 * npm run qa:platform-create-replay
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { mockSpecFromPrompt } from "@/lib/mock-spec";
import { prepareGameSpecForPersist } from "@/lib/spec-patch";
import { createProjectRecord } from "@/lib/project-create";
import { prisma } from "@/lib/prisma";

const OWNER = process.env.PLATFORM_TEST_OWNER ?? "platform-test-user";
const OUT = path.join(process.cwd(), "qa-output", "platform-create-replay");

async function resolveBaseUrl(): Promise<string | null> {
  for (const base of [
    process.env.STAGING_BASE_URL,
    process.env.PLAYWRIGHT_BASE_URL,
    "http://127.0.0.1:80",
    "http://127.0.0.1:8888",
    "http://127.0.0.1:3000",
  ].filter(Boolean) as string[]) {
    try {
      const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) return base.replace(/\/$/, "");
    } catch {
      /* next */
    }
  }
  return null;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const failures: string[] = [];

  const prompt = "platform-test-user 创作台回放验收：解压物理打 dummy";
  const spec = prepareGameSpecForPersist(
    mockSpecFromPrompt(prompt, { templateId: "physics" }),
    prompt,
  );

  const project = await createProjectRecord({
    ownerKey: OWNER,
    title: spec.title,
    prompt,
    specJson: JSON.stringify(spec),
    status: "ready",
  });

  const row = await prisma.project.findUnique({
    where: { id: project.id },
    select: { ownerKey: true, prompt: true, title: true },
  });
  if (!row || row.ownerKey !== OWNER) failures.push("DB ownerKey mismatch");
  if (row?.prompt !== prompt) failures.push("DB prompt mismatch");

  const base = await resolveBaseUrl();
  let httpNote = "dev 未启动，跳过 HTTP GET";
  if (base) {
    const res = await fetch(`${base}/api/projects/${encodeURIComponent(project.id)}`, {
      headers: { Cookie: `gcreator_owner=${OWNER}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      failures.push(`GET /api/projects/${project.id} → ${res.status}`);
    } else {
      const data = (await res.json()) as {
        project?: { prompt?: string; title?: string };
        spec?: { templateId?: string; title?: string };
      };
      if (data.project?.prompt !== prompt) failures.push("HTTP project.prompt mismatch");
      if (data.spec?.templateId !== "physics") failures.push("HTTP spec.templateId mismatch");
      httpNote = "GET project + spec OK";
    }
  }

  const createUrl = `${base ?? "http://127.0.0.1:8888"}/zh-Hans/create?from=${project.id}`;
  const playUrl = `${base ?? "http://127.0.0.1:8888"}/zh-Hans/play/${project.id}`;

  const report = [
    "# platform-test-user 创作台回放",
    "",
    `- 时间：${new Date().toISOString()}`,
    `- ownerKey：\`${OWNER}\``,
    `- projectId：\`${project.id}\``,
    `- HTTP：${httpNote}`,
    "",
    `- 创作台：[${createUrl}](${createUrl})`,
    `- 试玩：[${playUrl}](${playUrl})`,
    "",
    failures.length ? `## 失败\n\n${failures.map((f) => `- ${f}`).join("\n")}\n` : "✅ 离线回放链路 OK",
  ].join("\n");

  fs.writeFileSync(path.join(OUT, "REPORT.md"), report, "utf8");
  fs.writeFileSync(
    path.join(OUT, "summary.json"),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        owner: OWNER,
        projectId: project.id,
        createUrl,
        playUrl,
        pass: failures.length === 0,
        failures,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`projectId=${project.id}`);
  console.log(`createUrl=${createUrl}`);
  if (failures.length) {
    failures.forEach((f) => console.error("[FAIL]", f));
    process.exit(1);
  }
  console.log("[OK] qa:platform-create-replay");
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
