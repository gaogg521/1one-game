/**
 * HTTP SSE 路径：POST /api/generate/stream → done 帧路由 dedicated Scene
 * npm run qa:generate-stream-sse
 * 需 dev @8888
 */
import "dotenv/config";
import { consumeSSE } from "../src/lib/read-sse";
import { shouldUseAgenticRuntime } from "../src/lib/agentic/game-module";
import { expectedPhaserSceneName } from "../src/lib/game-templates/runtime";
import type { GameSpec } from "../src/lib/game-spec";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:8888";
const OWNER = process.env.QA_OWNER_KEY ?? "qa-generate-stream-sse";

async function main() {
  const health = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(5000) }).catch(() => null);
  if (!health?.ok) {
    console.error(`[FAIL] dev not reachable at ${BASE}`);
    process.exit(1);
  }

  const prompt = "打击 dummy 假人解压";
  const res = await fetch(`${BASE}/api/generate/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `gcreator_owner=${OWNER}`,
    },
    body: JSON.stringify({ prompt, templateHint: "physics", enhancePass: false }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    console.error("[FAIL] POST /api/generate/stream", res.status, await res.text());
    process.exit(1);
  }

  let doneSpec: GameSpec | null = null;
  let steps: string[] = [];

  await consumeSSE(res, (ev) => {
    const step = ev.step as string | undefined;
    if (step) steps.push(step);
    if (step === "done" && ev.spec) doneSpec = ev.spec as GameSpec;
    if (step === "error") {
      throw new Error(String(ev.message ?? "stream error"));
    }
  });

  if (!doneSpec) {
    console.error("[FAIL] no done spec; steps:", steps.join(" → "));
    process.exit(1);
  }

  if (shouldUseAgenticRuntime(doneSpec)) {
    console.error("[FAIL] done spec should not use AgenticScene (dedicated path)");
    process.exit(1);
  }
  if (expectedPhaserSceneName(doneSpec) !== "PhysicsScene") {
    console.error("[FAIL] expected PhysicsScene, got", expectedPhaserSceneName(doneSpec));
    process.exit(1);
  }

  console.log(`[OK] qa-generate-stream-sse: steps=${steps.join("→")} template=${doneSpec.templateId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
