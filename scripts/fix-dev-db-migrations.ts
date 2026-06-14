/**
 * 修复本地 dev.db 迁移漂移（duplicate column / failed migration）。
 * npm run fix:dev-db-migrations
 *
 * 见 docs/local-database.md
 */
import { execSync } from "node:child_process";

const dbUrl = process.env.DATABASE_URL?.trim() || "file:./dev.db";

/** 若列/表已存在则标记 migration 为 applied，避免 duplicate column */
const DRIFT_CHECKS: Array<
  | { kind: "column"; migration: string; table: string; column: string }
  | { kind: "table"; migration: string; table: string }
> = [
  { kind: "column", migration: "20260521100000_work_visibility_featured", table: "Novel", column: "visibility" },
  { kind: "column", migration: "20260521101000_comic_cover_path", table: "Comic", column: "coverPath" },
  { kind: "table", migration: "20260612120000_platform_runtime_config", table: "PlatformRuntimeConfig" },
];

async function tableExists(table: string): Promise<boolean> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`,
    )) as Array<{ name: string }>;
    return rows.length > 0;
  } finally {
    await prisma.$disconnect();
  }
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  try {
    const rows = (await prisma.$queryRawUnsafe(`PRAGMA table_info("${table}")`)) as Array<{ name: string }>;
    return rows.some((r) => r.name === column);
  } finally {
    await prisma.$disconnect();
  }
}

function run(cmd: string, quiet = false) {
  execSync(cmd, {
    stdio: quiet ? "pipe" : "inherit",
    env: { ...process.env, DATABASE_URL: dbUrl },
  });
}

async function resolveDrift(): Promise<void> {
  for (const check of DRIFT_CHECKS) {
    const exists =
      check.kind === "column" ?
        await columnExists(check.table, check.column)
      : await tableExists(check.table);
    if (!exists) continue;
    console.log(`✓ ${check.migration} 目标已存在 → migrate resolve --applied`);
    try {
      run(`npx prisma migrate resolve --applied ${check.migration}`, true);
    } catch {
      console.log(`  (跳过 ${check.migration})`);
    }
  }
}

async function main() {
  console.log(`\n# fix-dev-db-migrations (${dbUrl})\n`);

  for (let attempt = 0; attempt < 3; attempt++) {
    await resolveDrift();
    try {
      run("npx prisma migrate deploy");
      console.log("\n[OK] dev.db migrations aligned\n");
      return;
    } catch (e) {
      if (attempt === 2) throw e;
      console.log("→ migrate deploy 失败，重试 resolve…");
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
