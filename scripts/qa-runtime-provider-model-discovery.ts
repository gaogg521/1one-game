import { discoverRuntimeProviderModels } from "@/lib/runtime-provider-models";
import type { RuntimeLlmProvider } from "@/lib/runtime-providers";

const provider: RuntimeLlmProvider = {
  id: "qa-provider",
  name: "QA provider",
  protocol: "openai_compatible",
  baseUrl: "https://gateway.example.test/v1",
  apiKey: "sk-qa-key",
  models: [],
  enabled: true,
};

async function main() {
  const originalFetch = globalThis.fetch;
  let requestUrl = "";
  let authorization = "";
  globalThis.fetch = (async (input, init) => {
    requestUrl = String(input);
    authorization = new Headers(init?.headers).get("Authorization") ?? "";
    return Response.json({ data: [{ id: "seedream" }, { id: "minimax" }, { id: "seedream" }, { id: " " }] });
  }) as typeof fetch;
  try {
    const result = await discoverRuntimeProviderModels(provider);
    const checks = [
      ["models endpoint normalized", requestUrl === "https://gateway.example.test/v1/models"],
      ["authorization forwarded server-side", authorization === "Bearer sk-qa-key"],
      ["model IDs deduplicated and sorted", result.ok && result.models.join(",") === "minimax,seedream"],
      [
        "unsupported protocol is explicit",
        (await discoverRuntimeProviderModels({ ...provider, protocol: "gemini" })).message === "model_discovery_unsupported_protocol",
      ],
    ] as const;
    for (const [name, ok] of checks) console.log(`${ok ? "✓" : "✗"} ${name}`);
    if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
