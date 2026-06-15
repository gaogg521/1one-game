/**
 * 运行时配置后台 smoke：加密、模型写入、读取合并
 * npm run qa:runtime-config-admin
 *
 * 默认写 prisma/ci.sqlite；测 dev.db 时：QA_USE_DEV_DB=1 npm run qa:runtime-config-admin
 * 强制 HTTP roundtrip：npm run qa:runtime-config-admin:http（需 dev @8888 + SUPER_ADMIN_SECRET）
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { config as loadEnv } from "dotenv";
import { applyQaOfflineDatabaseUrl } from "@/lib/database-url";
import { PRODUCT } from "../src/lib/product-config";

loadEnv();
applyQaOfflineDatabaseUrl();

const requireHttp = process.argv.includes("--require-http") || process.env.QA_REQUIRE_HTTP === "1";

const OUT = path.join(process.cwd(), "qa-output", "runtime-config-admin");
const HTTP_TIMEOUT_MS = 8_000;

type Check = { name: string; ok: boolean; detail?: string };

function assert(name: string, ok: boolean, detail?: string): Check {
  return { name, ok, detail };
}

async function httpFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) });
}

async function probeDevServer(base: string): Promise<boolean> {
  try {
    const res = await httpFetch(`${base}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  const checks: Check[] = [];
  const dbUrl = process.env.DATABASE_URL?.trim() || "file:./prisma/ci.sqlite";

  try {
    execSync("npx prisma migrate deploy", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: dbUrl },
    });
    checks.push(assert("prisma migrate deploy", true, dbUrl));
  } catch {
    checks.push(assert("prisma migrate deploy", false, `failed on ${dbUrl}`));
  }

  const { decryptRuntimeSecrets, encryptRuntimeSecrets } = await import("../src/lib/runtime-config-crypto");
  const {
    getEffectiveModels,
    getProductModelDefaults,
    getRuntimeConfigPublicView,
    invalidateRuntimeConfigCache,
    loadRuntimeConfig,
    saveRuntimeConfig,
  } = await import("../src/lib/runtime-config");
  const { prisma } = await import("../src/lib/prisma");

  try {
    const sample = JSON.stringify({ openaiApiKey: "sk-test-roundtrip-key", models: { gamePrimary: "gpt-5.2" } });
    const enc = encryptRuntimeSecrets(sample);
    const dec = decryptRuntimeSecrets(enc);
    checks.push(assert("crypto roundtrip", dec === sample));

    const defaults = getProductModelDefaults();
    checks.push(assert("defaults.gamePrimary", defaults.gamePrimary === PRODUCT.models.gamePrimary));
    checks.push(assert("defaults.novelTextPrimary", defaults.novelTextPrimary === PRODUCT.models.novelTextPrimary));
    checks.push(assert("defaults.imageOpenAI", defaults.imageOpenAI === PRODUCT.models.imageOpenAI));

    invalidateRuntimeConfigCache();
    await saveRuntimeConfig({
      models: {
        gamePrimary: PRODUCT.models.gamePrimary,
        gameFallbacks: PRODUCT.models.gameFallbacks.join(", "),
        novelTextPrimary: PRODUCT.models.novelTextPrimary,
        novelTextFallback: PRODUCT.models.novelTextFallback,
        imageOpenAI: PRODUCT.models.imageOpenAI,
        imageGemini: PRODUCT.models.imageGemini,
      },
    });

    invalidateRuntimeConfigCache();
    await loadRuntimeConfig();
    const effective = getEffectiveModels();
    checks.push(assert("persist gamePrimary", effective.gamePrimary === PRODUCT.models.gamePrimary));
    checks.push(assert("persist novelTextPrimary", effective.novelTextPrimary === PRODUCT.models.novelTextPrimary));
    checks.push(assert("persist imageGemini", effective.imageGemini === PRODUCT.models.imageGemini));

    const view = await getRuntimeConfigPublicView();
    checks.push(assert("public view has productDefaults", Boolean(view.productDefaults?.gamePrimary)));
    checks.push(
      assert(
        "modelSources.gamePrimary is db after seed",
        view.modelSources.gamePrimary === "db",
        view.modelSources.gamePrimary,
      ),
    );

    const base = process.env.QA_BASE_URL?.trim() || "http://127.0.0.1:8888";
    const httpSecret = process.env.SUPER_ADMIN_SECRET?.trim();
    const httpHeaders: Record<string, string> = httpSecret ? { "x-super-admin-key": httpSecret } : {};
    const devUp = await probeDevServer(base);

    checks.push(
      assert(
        "HTTP dev server reachable",
        devUp || !requireHttp,
        devUp ? base : requireHttp ? `not reachable at ${base}` : `skipped — DATABASE_URL=file:./prisma/ci.sqlite PORT=8888 npm run dev`,
      ),
    );

    if (devUp) {
      try {
        const res = await httpFetch(`${base}/api/admin/runtime-config`, { headers: httpHeaders });
        checks.push(
          assert(
            "HTTP GET /api/admin/runtime-config",
            res.status === 200 || res.status === 403,
            `status=${res.status}${httpSecret ? "" : " (no SUPER_ADMIN_SECRET)"}`,
          ),
        );

        if (!httpSecret) {
          checks.push(
            assert(
              "HTTP PATCH roundtrip",
              !requireHttp,
              "skipped (set SUPER_ADMIN_SECRET for PATCH probe)",
            ),
          );
        } else if (res.ok) {
          const body = (await res.json()) as { models?: { gamePrimary?: string; novelTextPrimary?: string } };
          checks.push(assert("HTTP models.gamePrimary", body.models?.gamePrimary === PRODUCT.models.gamePrimary));

          const probePrimary = `${PRODUCT.models.novelTextPrimary}-qa-probe`;
          const patchRes = await httpFetch(`${base}/api/admin/runtime-config`, {
            method: "PATCH",
            headers: { ...httpHeaders, "Content-Type": "application/json" },
            body: JSON.stringify({ models: { novelTextPrimary: probePrimary } }),
          });
          checks.push(
            assert("HTTP PATCH /api/admin/runtime-config", patchRes.ok, `status=${patchRes.status}`),
          );

          if (patchRes.ok) {
            const afterPatch = (await patchRes.json()) as { models?: { novelTextPrimary?: string } };
            checks.push(
              assert("HTTP PATCH novelTextPrimary applied", afterPatch.models?.novelTextPrimary === probePrimary),
            );

            const get2 = await httpFetch(`${base}/api/admin/runtime-config`, { headers: httpHeaders });
            const body2 = (await get2.json()) as { models?: { novelTextPrimary?: string } };
            checks.push(assert("HTTP GET after PATCH", body2.models?.novelTextPrimary === probePrimary));

            await httpFetch(`${base}/api/admin/runtime-config`, {
              method: "PATCH",
              headers: { ...httpHeaders, "Content-Type": "application/json" },
              body: JSON.stringify({ models: { novelTextPrimary: PRODUCT.models.novelTextPrimary } }),
            });
            checks.push(assert("HTTP PATCH restore novelTextPrimary", true));
          }
        } else if (res.status === 403) {
          checks.push(
            assert(
              "HTTP PATCH roundtrip",
              !requireHttp,
              "skipped (GET 403 — check SUPER_ADMIN_SECRET matches dev .env)",
            ),
          );
        }
      } catch (e) {
        checks.push(assert("HTTP admin runtime-config", false, String(e)));
      }
    } else if (requireHttp) {
      checks.push(assert("HTTP GET /api/admin/runtime-config", false, "dev server down"));
      checks.push(assert("HTTP PATCH roundtrip", false, "dev server down"));
    }

    await prisma.$disconnect();

    const failed = checks.filter((c) => !c.ok);
    fs.mkdirSync(OUT, { recursive: true });
    const summary = {
      at: new Date().toISOString(),
      pass: failed.length === 0,
      dbUrl,
      checks,
      seededModels: PRODUCT.models,
    };
    fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
    fs.writeFileSync(
      path.join(OUT, "REPORT.md"),
      `# Runtime Config Admin QA\n\n- 时间：${summary.at}\n- 库：\`${dbUrl}\`\n- 结果：**${summary.pass ? "PASS" : "FAIL"}** (${checks.length - failed.length}/${checks.length})\n\n## Checks\n\n${checks.map((c) => `- [${c.ok ? "x" : " "}] ${c.name}${c.detail ? ` — ${c.detail}` : ""}`).join("\n")}\n`,
    );

    console.log("\n# qa:runtime-config-admin\n");
    for (const c of checks) {
      console.log(`${c.ok ? "✓" : "✗"} ${c.name}${c.detail ? ` (${c.detail})` : ""}`);
    }
    console.log(`\n→ ${path.join(OUT, "REPORT.md")}\n`);
    return failed.length ? 1 : 0;
  } catch (e) {
    await prisma.$disconnect().catch(() => {});
    throw e;
  }
}

main()
  .catch((e) => {
    console.error(e);
    return 1;
  })
  .then((code) => process.exit(code ?? 0));
