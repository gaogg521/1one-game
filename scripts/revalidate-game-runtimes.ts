/** Refresh exact-runtime evidence after an SDK release, without generating or publishing. */
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { parseGameSpec } from "@/lib/game-spec";
import { validateGameRuntime } from "@/lib/game-runtime-validation";

async function main() {
  const db = new PrismaClient();
  try {
    const rows = await db.creativeArtifact.findMany({
      where: {
        kind: "game_runtime_validation",
        revision: {
          OR: [
            { status: "ready" },
            { status: "failed", summary: { startsWith: "Runtime revalidation failed:" } },
          ],
        },
      },
      include: { project: true, revision: true },
    });
    const backup = `qa-output/runtime-revalidation-${Date.now()}`;
    await fs.mkdir(backup, { recursive: true });
    for (const row of rows) {
      if (!row.creativeRevisionId || !row.project.legacyId) continue;
      // The immutable runtime artifact is the exact source delivered to the
      // iframe. Do not rely on lexical kind ordering here (`game_spec` sorts
      // after `game_runtime_source` in SQLite and can contain the pre-forge
      // snapshot), or a revalidation silently audits the wrong program.
      const artifact = await db.creativeArtifact.findFirst({
        where: { creativeRevisionId: row.creativeRevisionId, kind: "game_runtime_source" },
        orderBy: { createdAt: "desc" },
      }) ?? await db.creativeArtifact.findFirst({
        where: { creativeRevisionId: row.creativeRevisionId, kind: "game_spec" },
        orderBy: { createdAt: "desc" },
      });
      if (!artifact?.contentJson) continue;
      const spec = parseGameSpec(JSON.parse(artifact.contentJson));
      const validation = await validateGameRuntime(spec, row.project.legacyId);
      await fs.writeFile(`${backup}/${row.id}.json`, JSON.stringify({ prior: row, validation }, null, 2));
      if (process.env.APPLY_RUNTIME_REVALIDATION === "1") {
        await db.$transaction(async tx => {
          if (!await tx.creativeArtifact.count({ where: { id: artifact.id, contentJson: artifact.contentJson } })) throw new Error("Spec changed during validation");
          const contentJson = JSON.stringify(validation);
          const updated = await tx.creativeArtifact.updateMany({ where: { id: row.id, updatedAt: row.updatedAt }, data: { contentJson, contentHash: createHash("sha256").update(contentJson).digest("hex") } });
          if (updated.count !== 1) throw new Error("Evidence changed during validation");
          if (validation.status === "failed") {
            await tx.creativeRevision.updateMany({ where: { id: row.creativeRevisionId!, status: "ready" }, data: { status: "failed", summary: `Runtime revalidation failed: ${validation.blockers.join(", ")}` } });
          } else if (validation.status === "passed" && row.revision?.status === "failed" && row.revision.summary?.startsWith("Runtime revalidation failed:")) {
            await tx.creativeRevision.updateMany({
              where: { id: row.creativeRevisionId!, status: "failed", summary: row.revision.summary },
              data: { status: "ready", summary: "runtime verified · ready for observed playtest" },
            });
          }
        });
      }
      console.log(JSON.stringify({ projectId: row.project.legacyId, revisionId: row.creativeRevisionId, status: validation.status, blockers: validation.blockers, applied: process.env.APPLY_RUNTIME_REVALIDATION === "1" }));
    }
  } finally { await db.$disconnect(); }
}
void main();
