/**
 * 部署前预检：迁移 + 构建（不启动 dev）
 * npm run qa:deploy-preflight
 */
import { execSync } from "node:child_process";

type Check = { name: string; ok: boolean; detail?: string };

function run(name: string, cmd: string): Check {
  try {
    execSync(cmd, { stdio: "pipe", encoding: "utf8" });
    return { name, ok: true };
  } catch (e) {
    const err = e as { stderr?: string; stdout?: string; message?: string };
    const detail = (err.stderr || err.stdout || err.message || "").trim().slice(0, 240);
    return { name, ok: false, detail };
  }
}

async function main() {
  const dbUrl = process.env.DATABASE_URL?.trim() || "file:./prisma/ci.sqlite";
  const checks = [
    run("prisma migrate deploy", `npx prisma migrate deploy`),
    run("qa:console-sso-config", "npm run qa:console-sso-config"),
    run("qa:console-sso-production-preflight", "npm run qa:console-sso-production-preflight"),
    run("qa:comic-novel-product-rules", "npm run qa:comic-novel-product-rules"),
    run("qa:database-url", "npm run qa:database-url"),
    run("qa:comic-director-pipeline", "npm run qa:comic-director-pipeline"),
    run("qa:comic-featured:offline", "npm run qa:comic-featured:offline"),
    run("npm run build", "npm run build"),
  ];

  for (const c of checks) {
    console.log(`${c.ok ? "[OK]" : "[FAIL]"} ${c.name}${c.detail ? `\n  ${c.detail}` : ""}`);
  }

  const failed = checks.filter((c) => !c.ok);
  if (failed.length) {
    console.error(`qa-deploy-preflight: ${failed.length}/${checks.length} failed (db=${dbUrl})`);
    process.exit(1);
  }
  console.log(`qa-deploy-preflight: ok (db=${dbUrl})`);
}

main();
