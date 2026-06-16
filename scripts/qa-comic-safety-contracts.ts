import fs from "node:fs";
import path from "node:path";
import { comicStoryboardQualityWarning, comicPanelResumeHint } from "../src/lib/comic-safety";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const root = process.cwd();
const panelsRoute = fs.readFileSync(path.join(root, "src/app/api/comic/[id]/panels/route.ts"), "utf8");
const panelsStreamRoute = fs.readFileSync(path.join(root, "src/app/api/comic/[id]/panels/stream/route.ts"), "utf8");

function assertOrder(source: string, before: string, after: string, message: string): void {
  const beforeAt = source.indexOf(before);
  const afterAt = source.indexOf(after);
  assert(beforeAt >= 0, `missing marker before: ${before}`);
  assert(afterAt >= 0, `missing marker after: ${after}`);
  assert(beforeAt < afterAt, message);
}

assert(
  panelsRoute.includes('gateGenerationQuota("comicPanels"'),
  "sync comic panels route should gate comicPanels quota like the stream route",
);
assert(
  panelsStreamRoute.includes('gateGenerationQuota("comicPanels"'),
  "stream comic panels route should keep comicPanels quota gate",
);
assertOrder(
  panelsRoute,
  "if (!row || row.ownerKey !== ownerKey)",
  'gateGenerationQuota("comicPanels"',
  "sync panels route should verify ownership before charging quota",
);
assertOrder(
  panelsRoute,
  "before.withImage >= before.total",
  'gateGenerationQuota("comicPanels"',
  "sync panels route should skip completed no-op before charging quota",
);
assertOrder(
  panelsStreamRoute,
  "if (!row || row.ownerKey !== ownerKey)",
  'gateGenerationQuota("comicPanels"',
  "stream panels route should verify ownership before charging quota",
);
assertOrder(
  panelsStreamRoute,
  "before.withImage >= before.total",
  'gateGenerationQuota("comicPanels"',
  "stream panels route should skip completed no-op before charging quota",
);

assert(
  comicStoryboardQualityWarning("emergency", "zh-Hans").length > 0,
  "emergency storyboard fallback should expose a user-visible warning",
);
assert(
  comicStoryboardQualityWarning("llm", "zh-Hans") === undefined,
  "normal LLM storyboard should not expose emergency warning",
);
assert(
  comicPanelResumeHint({ withImage: 12, total: 32, uiLocale: "zh-Hans" }).length > 0,
  "partial panel render should expose a resume hint",
);
assert(
  comicPanelResumeHint({ withImage: 32, total: 32, uiLocale: "zh-Hans" }) === undefined,
  "complete panel render should not expose a resume hint",
);

console.log("[OK] qa-comic-safety-contracts");
