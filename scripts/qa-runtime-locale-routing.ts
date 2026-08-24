import assert from "node:assert/strict";
import { runtimeLocaleGroup } from "@/lib/runtime-locale-routing";
import { resolveSceneRoute, type RuntimeLlmProvider } from "@/lib/runtime-providers";
import type { RuntimeSecretsPayload } from "@/lib/runtime-config";

const providers: RuntimeLlmProvider[] = [
  { id: "cn", name: "Chinese gateway", protocol: "openai_compatible", baseUrl: "https://cn.example/v1", apiKey: "cn-key", models: ["doubao-seedream-5-0-pro"], enabled: true },
  { id: "global", name: "Global gateway", protocol: "openai_compatible", baseUrl: "https://global.example/v1", apiKey: "global-key", models: ["gpt-image-2"], enabled: true },
];

const payload: RuntimeSecretsPayload = {
  providers,
  routes: [{ scene: "comic_image_openai", providerId: "global", primary: "legacy-image", fallbacks: [] }],
  localeRoutes: [
    { scene: "comic_image_openai", localeGroup: "zh", providerId: "cn", primary: "doubao-seedream-5-0-pro", fallbacks: [] },
    { scene: "comic_image_openai", localeGroup: "international", providerId: "global", primary: "gpt-image-2", fallbacks: [] },
  ],
};

assert.equal(runtimeLocaleGroup("zh-Hans"), "zh");
assert.equal(runtimeLocaleGroup("zh-Hant"), "zh");
assert.equal(runtimeLocaleGroup("en"), "international");
assert.equal(resolveSceneRoute(payload, "comic_image_openai", "zh")?.provider.id, "cn");
assert.equal(resolveSceneRoute(payload, "comic_image_openai", "zh")?.models[0], "doubao-seedream-5-0-pro");
assert.equal(resolveSceneRoute(payload, "comic_image_openai", "international")?.provider.id, "global");
assert.equal(resolveSceneRoute({ ...payload, localeRoutes: [] }, "comic_image_openai", "zh")?.models[0], "legacy-image");

console.info("runtime locale routing: OK");
