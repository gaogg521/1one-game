/**
 * 开发环境一键就绪：Prisma Client + 迁移对齐 + 样品馆 seed
 * npm run ensure:dev-playable
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const clientDir = path.join(repoRoot, "node_modules", ".prisma", "client");
const schemaInClient = path.join(clientDir, "schema.prisma");

function run(cmd: string) {
  execSync(cmd, { stdio: "inherit", cwd: repoRoot, env: process.env });
}

function main() {
  if (!fs.existsSync(schemaInClient)) {
    console.log("[ensure:dev-playable] Prisma Client 不完整，执行 generate …");
    run("npx prisma generate");
  }

  run("npm run fix:dev-db-migrations");
  run("npm run seed:samples");
  run("npm run seed:sample-assets");
  console.log("[ensure:dev-playable] ok — 可 npm run dev @8888");
}

main();
