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
  const { normalizeOpenAIBaseURL, createOpenAIClient } = await import("@/lib/openai-client");
  const { createOpenAIClientForProvider } = await import("@/lib/runtime-llm-client");
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
    { name: "Ark /api/v3 stays unmodified", ok: normalizeOpenAIBaseURL("https://ark.cn-beijing.volces.com/api/v3") === "https://ark.cn-beijing.volces.com/api/v3" },
    { name: "ordinary OpenAI base still receives /v1", ok: normalizeOpenAIBaseURL("https://provider.example.test") === "https://provider.example.test/v1" },
  ];
  process.env.OPENAI_API_KEY = "sk-env-should-not-win";
  process.env.OPENAI_BASE_URL = "https://env.example.test/v1";
  const routed = createOpenAIClientForProvider({
    id: "qa-route",
    name: "QA route",
    protocol: "openai_compatible",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    apiKey: "sk-provider-should-win",
    models: ["qa-model"],
    enabled: true,
  });
  const explicit = createOpenAIClient(undefined, {
    apiKey: "sk-explicit",
    baseURL: "https://provider.example.test/v1",
  });
  checks.push(
    {
      name: "provider client uses provider key not process.env",
      ok: routed.apiKey === "sk-provider-should-win",
    },
    {
      name: "provider client uses provider base URL not process.env",
      ok: routed.baseURL === "https://ark.cn-beijing.volces.com/api/v3",
    },
    {
      name: "explicit creds ignore process.env",
      ok: explicit.apiKey === "sk-explicit" && explicit.baseURL === "https://provider.example.test/v1",
    },
  );
  for (const check of checks) console.log(`${check.ok ? "✓" : "✗"} ${check.name}`);
  await prisma.$disconnect();
  if (checks.some((check) => !check.ok)) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
