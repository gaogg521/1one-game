/**
 * Astrocade 用户生成路径：Agentic attach → AgenticScene 路由 → 样品不含 agentic
 * npm run qa:astrocade-user-path
 */
import { mockSpecFromPrompt } from "../src/lib/mock-spec";
import { attachAgenticModuleIfEnabled } from "../src/lib/agentic/generate-game-module";
import { shouldUseAgenticRuntime } from "../src/lib/agentic/game-module";
import { expectedPhaserSceneName } from "../src/lib/game-templates/runtime";
import { enrichGameSpecForRuntime } from "../src/lib/enrich-game-spec";
import { buildRuntimeAssetManifest } from "../src/lib/assets/asset-runtime-resolver";
import { SAMPLES } from "../src/lib/samples";
import { specForSample } from "../src/lib/sample-specs";
import { PRODUCT } from "../src/lib/product-config";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
  assert(PRODUCT.game.agenticModuleEnabled, "agenticModuleEnabled must be true");
  assert(PRODUCT.orchestration.qualityTier === "astrocade", "qualityTier must be astrocade");

  const prompts = [
    "做一个解压打 dummy 的假人游戏",
    "空中轨道过山车竞速",
    "地图征服派兵占领",
  ];

  for (const p of prompts) {
    const base = mockSpecFromPrompt(p);
    const withAgentic = await attachAgenticModuleIfEnabled(p, base, true);
    assert(shouldUseAgenticRuntime(withAgentic), `agentic attached: ${p.slice(0, 12)}`);
    assert(
      expectedPhaserSceneName(withAgentic) === "AgenticScene",
      `routes AgenticScene: ${withAgentic.templateId}`,
    );
    const enriched = enrichGameSpecForRuntime(withAgentic, p);
    assert(Boolean(enriched.agenticModule?.source), "enrich preserves agenticModule");
    assert(
      validateAgenticSourceQuick(enriched.agenticModule!.source),
      "agentic source passes forbidden check",
    );
  }

  for (const s of SAMPLES) {
    const spec = specForSample(s);
    assert(!shouldUseAgenticRuntime(spec), `sample ${s.id} must use dedicated scene`);
    assert(
      expectedPhaserSceneName(spec) !== "AgenticScene",
      `sample ${s.id} must not route AgenticScene`,
    );
  }

  const manifest = buildRuntimeAssetManifest({
    projectId: "test-project",
    backgroundUrl: "/game-backgrounds/test.webp",
    spriteUrls: [
      { kind: "player", url: "/game-sprites/test/player.png" },
      { kind: "hazard", url: "/game-sprites/test/hazard.png" },
      { kind: "gem", url: "/game-sprites/test/gem.png" },
    ],
  });
  assert(manifest.runtimeSchema === 2, "manifest v2");
  assert(manifest.slots?.some((s) => s.slot === "background"), "background slot");
  assert(manifest.slots?.some((s) => s.slot === "player"), "player slot");
  assert(manifest.slots?.some((s) => s.slot === "enemy"), "enemy slot from hazard");
  assert(manifest.slots?.some((s) => s.slot === "collectible"), "collectible slot from gem");

  console.log("[OK] qa-astrocade-user-path: agentic attach + routing + samples + asset slots");
}

function validateAgenticSourceQuick(source: string): boolean {
  return !/\b(fetch|eval\s*\(|new\s+Function|import\s|require\s)\b/i.test(source);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
