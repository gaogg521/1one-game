/**
 * 已保存服务商测试回归：确保后台测试连接可在不回传 API Key 的前提下，
 * 由服务端按 providerId 取得加密保存的连接配置。
 *
 * 固定使用独立 SQLite 库，不读取或修改 dev.db / 生产配置。
 */
import { execSync } from "node:child_process";

const DATABASE_URL = "file:./prisma/runtime-provider-saved-test-qa.db";
process.env.DATABASE_URL = DATABASE_URL;
process.env.RUNTIME_CONFIG_SECRET = "qa-runtime-provider-saved-test-secret";

type Check = { name: string; ok: boolean };

async function main() {
  execSync("npx prisma migrate deploy", { stdio: "pipe", env: { ...process.env, DATABASE_URL } });

  const { getRuntimeConfigPublicView, getSavedRuntimeProvider, invalidateRuntimeConfigCache, saveRuntimeConfig } =
    await import("@/lib/runtime-config");
  const { prisma } = await import("@/lib/prisma");

  const providerId = "qa-saved-provider";
  const apiKey = "sk-qa-saved-provider-key";
  invalidateRuntimeConfigCache();
  await saveRuntimeConfig({
    providers: [
      {
        id: providerId,
        name: "QA saved provider",
        protocol: "openai_compatible",
        baseUrl: "https://provider.example.test/v1",
        apiKey,
        models: ["qa-model"],
        enabled: true,
      },
    ],
  });
  invalidateRuntimeConfigCache();

  const [saved, missing, view] = await Promise.all([
    getSavedRuntimeProvider(providerId),
    getSavedRuntimeProvider("missing-provider"),
    getRuntimeConfigPublicView(),
  ]);
  const publicProvider = view.providers.find((provider) => provider.id === providerId);
  const checks: Check[] = [
    { name: "saved provider resolves server-side", ok: saved?.apiKey === apiKey && saved.baseUrl === "https://provider.example.test/v1" },
    { name: "unknown provider is rejected", ok: missing === null },
    {
      name: "public view masks saved API key",
      ok: publicProvider?.apiKey !== apiKey && Boolean(publicProvider?.apiKey) && publicProvider?.apiKeySource === "db",
    },
  ];
  for (const check of checks) console.log(`${check.ok ? "✓" : "✗"} ${check.name}`);
  await prisma.$disconnect();
  if (checks.some((check) => !check.ok)) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
