/**
 * Astrocade 用户生成路径：template-first → 专用 Scene（与样品馆一致）→ 样品不含 agentic
 * npm run qa:astrocade-user-path
 */
import { mockSpecFromPrompt } from "../src/lib/mock-spec";
import { attachAgenticModuleIfEnabled } from "../src/lib/agentic/generate-game-module";
import { checkAstrocadeParity, templateFirstCoverage } from "../src/lib/astrocade-architecture";
import { buildRuntimeAssetManifest } from "../src/lib/assets/asset-runtime-resolver";
import { SAMPLES } from "../src/lib/samples";
import { specForSample } from "../src/lib/sample-specs";
import { PRODUCT } from "../src/lib/product-config";
import { AGENTIC_QA_CASES } from "./agentic-qa-cases";

const USER_CASES = AGENTIC_QA_CASES.slice(0, 6);

async function main() {
  if (!PRODUCT.game.agenticModuleEnabled) throw new Error("agenticModuleEnabled must be true");
  if (!PRODUCT.game.dedicatedSceneForTemplateFirst) throw new Error("dedicatedSceneForTemplateFirst must be true");
  if (PRODUCT.orchestration.qualityTier !== "astrocade") throw new Error("qualityTier must be astrocade");

  const { missing } = templateFirstCoverage();
  if (missing.length) throw new Error(`template-first missing: ${missing.join(", ")}`);

  for (const c of USER_CASES) {
    const base = mockSpecFromPrompt(c.prompt);
    if (base.templateId !== c.expectTemplate) {
      throw new Error(`mock ${c.expectTemplate} got ${base.templateId}`);
    }
    const attached = await attachAgenticModuleIfEnabled(c.prompt, base, true);
    const violations = checkAstrocadeParity(attached, { label: c.expectTemplate });
    if (violations.length) throw new Error(violations.map((v) => v.message).join("; "));
  }

  for (const s of SAMPLES) {
    const spec = specForSample(s);
    const violations = checkAstrocadeParity(spec, { label: s.id });
    if (violations.length) throw new Error(violations.map((v) => v.message).join("; "));
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
  if (manifest.runtimeSchema !== 2) throw new Error("manifest v2");
  if (!manifest.slots?.some((s) => s.slot === "background")) throw new Error("background slot");
  if (!manifest.slots?.some((s) => s.slot === "player")) throw new Error("player slot");
  if (!manifest.slots?.some((s) => s.slot === "enemy")) throw new Error("enemy slot from hazard");
  if (!manifest.slots?.some((s) => s.slot === "collectible")) throw new Error("collectible slot from gem");

  console.log("[OK] qa-astrocade-user-path: architecture parity + samples + asset slots");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
