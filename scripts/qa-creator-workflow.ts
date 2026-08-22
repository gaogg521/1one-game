import { buildCreatorQualityReport, resolveCreatorWorkStage } from "../src/lib/creator-workflow";

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

assert(resolveCreatorWorkStage({ status: "ready", visibility: "public" }) === "published", "public ready work must be published");
assert(resolveCreatorWorkStage({ status: "draft_generating" }) === "generating", "generation states must be shared");
assert(resolveCreatorWorkStage({ status: "ready", quality: buildCreatorQualityReport({ kind: "game", score: 41 }) }) === "quality_review", "blocked quality must be reviewed");
assert(resolveCreatorWorkStage({ status: "ready", quality: buildCreatorQualityReport({ kind: "comic", score: 83 }) }) === "publishable", "quality-ready work must be publishable");
console.log("[OK] qa-creator-workflow");
