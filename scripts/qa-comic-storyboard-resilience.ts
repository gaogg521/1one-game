/**
 * 导演分镜 resilience：长篇 chunk 失败时须逐页降级（与 light 路径一致）
 * npm run qa:comic-storyboard-resilience
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { shouldUseLongComicPipeline } from "../src/lib/comic-generate-config.ts";

const longPath = resolve(process.cwd(), "src/lib/comic-storyboard-long.ts");
const pipelinePath = resolve(process.cwd(), "src/lib/comic-pipeline.ts");
const longSrc = readFileSync(longPath, "utf8");
const pipelineSrc = readFileSync(pipelinePath, "utf8");

const checks: { name: string; ok: boolean; detail?: string }[] = [];

function assert(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail });
}

assert("exports fetchComicStoryboardChunk", longSrc.includes("export async function fetchComicStoryboardChunk"));
assert(
  "chunk returns stat strategy",
  longSrc.includes("ComicStoryboardChunkResult") &&
    longSrc.includes('strategy: "batch"') &&
    longSrc.includes('strategy: "per_page"'),
);
assert(
  "pipeline emits director_storyboard_stats",
  pipelineSrc.includes("director_storyboard_stats") &&
    pipelineSrc.includes("accumulateDirectorStoryboardStats"),
);
assert(
  "director batch then single-page fallback",
  longSrc.includes("tryDirectorStoryboardOnce") &&
    longSrc.includes("chunkPages <= 1") &&
    longSrc.includes("storyboardPageJsonFailed"),
);
assert(
  "uses ComicGenerationRunError",
  longSrc.includes("ComicGenerationRunError") && longSrc.includes("storyboardPageJsonFailed"),
);
assert("pipeline imports long storyboard", pipelineSrc.includes("fetchComicStoryboardChunk"));
assert(
  "pipeline long path has light fallback",
  pipelineSrc.includes("pipeline_fallback") && pipelineSrc.includes("generateComicPagesLight"),
);
assert(
  "forceLightStoryboard skips director pipeline",
  pipelineSrc.includes("forceLightStoryboard") &&
    shouldUseLongComicPipeline(8, "medium", "zh", { forceLightStoryboard: true }) === false,
);

const prevForce = process.env.COMIC_FORCE_LIGHT_PIPELINE;
process.env.COMIC_FORCE_LIGHT_PIPELINE = "1";
assert("COMIC_FORCE_LIGHT_PIPELINE env", shouldUseLongComicPipeline(8, "medium", "zh") === false);
if (prevForce) process.env.COMIC_FORCE_LIGHT_PIPELINE = prevForce;
else delete process.env.COMIC_FORCE_LIGHT_PIPELINE;

const failed = checks.filter((c) => !c.ok);
for (const c of checks) {
  console.log(`${c.ok ? "[OK]" : "[FAIL]"} ${c.name}${c.detail ? ` · ${c.detail}` : ""}`);
}
if (failed.length) {
  console.error(`qa-comic-storyboard-resilience: ${failed.length}/${checks.length} failed`);
  process.exit(1);
}
console.log(`[OK] qa-comic-storyboard-resilience (${checks.length} checks)`);
