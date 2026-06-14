/**
 * 导演分镜 chunk 成功率监控（结构 + 聚合逻辑）
 * npm run qa:comic-director-chunk-stats
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  accumulateDirectorStoryboardStats,
  formatDirectorStoryboardStatsLine,
} from "../src/lib/comic-director-chunk-stats.ts";

const longSrc = readFileSync(resolve(process.cwd(), "src/lib/comic-storyboard-long.ts"), "utf8");
const pipelineSrc = readFileSync(resolve(process.cwd(), "src/lib/comic-pipeline.ts"), "utf8");
const eventsSrc = readFileSync(resolve(process.cwd(), "src/lib/comic-pipeline-events.ts"), "utf8");

assert.match(longSrc, /ComicStoryboardChunkResult/);
assert.match(longSrc, /strategy: "batch"/);
assert.match(longSrc, /strategy: "per_page"/);
assert.match(pipelineSrc, /director_storyboard_stats/);
assert.match(pipelineSrc, /accumulateDirectorStoryboardStats/);
assert.match(eventsSrc, /director_storyboard_stats/);

const allBatch = accumulateDirectorStoryboardStats([
  { chunkStart: 1, chunkEnd: 4, pagesInChunk: 4, strategy: "batch" },
  { chunkStart: 5, chunkEnd: 8, pagesInChunk: 4, strategy: "batch" },
]);
assert.equal(allBatch.chunksTotal, 2);
assert.equal(allBatch.chunksBatch, 2);
assert.equal(allBatch.batchSuccessRate, 1);

const mixed = accumulateDirectorStoryboardStats([
  { chunkStart: 1, chunkEnd: 4, pagesInChunk: 4, strategy: "batch" },
  { chunkStart: 5, chunkEnd: 8, pagesInChunk: 4, strategy: "per_page" },
]);
assert.equal(mixed.chunksPerPage, 1);
assert.equal(mixed.batchSuccessRate, 0.5);
assert.match(formatDirectorStoryboardStatsLine(mixed, "zh"), /逐页降级/);

console.log("[OK] qa:comic-director-chunk-stats");
