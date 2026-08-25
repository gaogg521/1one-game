import {
  getEffectiveRoutes,
  resolveSceneRouteCandidates,
  routeModelCandidates,
  type RuntimeLlmProvider,
} from "../src/lib/runtime-providers";
import type { RuntimeSecretsPayload } from "../src/lib/runtime-config";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const providerA: RuntimeLlmProvider = {
  id: "openrouter", name: "OpenRouter", protocol: "openai_compatible", baseUrl: "https://openrouter.example/api/v1", apiKey: "a", models: ["openai/gpt-audio-mini"], enabled: true,
};
const providerB: RuntimeLlmProvider = {
  id: "backup", name: "Backup gateway", protocol: "openai_compatible", baseUrl: "https://backup.example/v1", apiKey: "b", models: ["audio/music-model"], enabled: true,
};

function main() {
  const payload: RuntimeSecretsPayload = {
    providers: [providerA, providerB],
    routes: [{
      scene: "game_bgm",
      providerId: "openrouter",
      primary: "openai/gpt-audio-mini",
      fallbacks: [],
      fallbackCandidates: [{ providerId: "backup", model: "audio/music-model" }],
    }],
  };
  const route = getEffectiveRoutes(payload).find((item) => item.scene === "game_bgm");
  assert(route && route.fallbacks.length === 0, "an explicit empty fallback must not inherit an unrelated default model");
  const candidates = routeModelCandidates(route);
  assert(candidates.length === 2 && candidates[1]?.providerId === "backup", "fallback must retain its own provider ID");
  const resolved = resolveSceneRouteCandidates(payload, "game_bgm");
  assert(resolved.length === 2 && resolved[1]?.provider.id === "backup", "runtime must resolve cross-provider candidates without mixing credentials");
  console.log("[OK] qa-runtime-cross-provider-routing");
}

main();
