/**
 * 修复本地 dev.db 迁移漂移（duplicate column / failed migration / 缺表）。
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
  { kind: "column", migration: "20260614120000_novel_character_roster", table: "Novel", column: "characterRosterJson" },
  { kind: "table", migration: "20260614090000_user_auth_foundation", table: "User" },
  { kind: "table", migration: "20260614100000_email_auth", table: "EmailVerification" },
  { kind: "column", migration: "20260614100000_email_auth", table: "User", column: "passwordHash" },
  { kind: "table", migration: "20260614180000_platform_email_config", table: "PlatformEmailConfig" },
  { kind: "column", migration: "20260615100000_username_auth", table: "User", column: "username" },
];

const FAILED_MIGRATIONS_TO_ROLLBACK = ["20260614100000_email_auth", "20260614090000_user_auth_foundation"];

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

function runQuiet(cmd: string): boolean {
  try {
    run(cmd, true);
    return true;
  } catch {
    return false;
  }
}

async function resolveFailedMigrations(): Promise<void> {
  for (const name of FAILED_MIGRATIONS_TO_ROLLBACK) {
    if (runQuiet(`npx prisma migrate resolve --rolled-back ${name}`)) {
      console.log(`✓ ${name} → rolled-back（可重试 deploy）`);
    }
  }
}

async function resolveDrift(): Promise<void> {
  for (const check of DRIFT_CHECKS) {
    const exists =
      check.kind === "column" ?
        await columnExists(check.table, check.column)
      : await tableExists(check.table);
    if (!exists) continue;
    console.log(`✓ ${check.migration} 目标已存在 → migrate resolve --applied`);
    runQuiet(`npx prisma migrate resolve --applied ${check.migration}`);
  }
}

async function ensureSchemaViaPush(): Promise<void> {
  const hasUser = await tableExists("User");
  if (hasUser) return;
  console.log("→ dev.db 缺少 User 等表，执行 prisma db push 对齐 schema…");
  run("npx prisma db push --skip-generate");
}

async function main() {
  console.log(`\n# fix-dev-db-migrations (${dbUrl})\n`);

  await resolveFailedMigrations();

  for (let attempt = 0; attempt < 3; attempt++) {
    await ensureSchemaViaPush();
    await resolveDrift();
    try {
      run("npx prisma migrate deploy");
      console.log("\n[OK] dev.db migrations aligned\n");
      return;
    } catch {
      if (attempt === 2) break;
      console.log("→ migrate deploy 失败，重试 resolve…");
    }
  }

  console.log("→ 最后尝试 db push + resolve 全部 pending…");
  await ensureSchemaViaPush();
  await resolveDrift();
  run("npx prisma db push --skip-generate");
  console.log("\n[OK] dev.db schema synced via db push\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
