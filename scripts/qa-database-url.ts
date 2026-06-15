/**
 * DATABASE_URL 规范化离线断言
 */
import assert from "node:assert/strict";
import {
  CI_DATABASE_URL,
  DEV_DATABASE_URL,
  applyLiteraryQaDatabaseUrl,
  applyQaOfflineDatabaseUrl,
  normalizeSqliteDatabaseUrl,
  resolveDevServerDatabaseUrl,
  resolveLiteraryQaDatabaseUrl,
  resolveQaOfflineDatabaseUrl,
} from "@/lib/database-url";

function main() {
  assert.equal(normalizeSqliteDatabaseUrl(undefined), DEV_DATABASE_URL);
  assert.equal(normalizeSqliteDatabaseUrl("file:./prisma/dev.db"), DEV_DATABASE_URL);
  assert.equal(normalizeSqliteDatabaseUrl("file:./dev.db"), "file:./dev.db");

  delete process.env.DATABASE_URL;
  delete process.env.QA_USE_DEV_DB;
  assert.equal(resolveLiteraryQaDatabaseUrl(), DEV_DATABASE_URL);
  assert.equal(resolveQaOfflineDatabaseUrl(), CI_DATABASE_URL);

  delete process.env.DATABASE_URL;
  assert.equal(applyLiteraryQaDatabaseUrl(), DEV_DATABASE_URL);
  assert.equal(process.env.DATABASE_URL, DEV_DATABASE_URL);

  delete process.env.DATABASE_URL;
  delete process.env.QA_USE_DEV_DB;
  assert.equal(applyQaOfflineDatabaseUrl(), CI_DATABASE_URL);
  assert.equal(process.env.DATABASE_URL, CI_DATABASE_URL);

  process.env.DATABASE_URL = "file:./prisma/ci.sqlite";
  delete process.env.DEV_ALLOW_CI_DB;
  assert.equal(resolveDevServerDatabaseUrl(), DEV_DATABASE_URL);

  process.env.DEV_ALLOW_CI_DB = "1";
  assert.equal(resolveDevServerDatabaseUrl(), "file:./prisma/ci.sqlite");

  console.log("qa-database-url: ok");
}

main();
