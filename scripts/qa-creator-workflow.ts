import { buildCreatorQualityReport, resolveCreatorWorkStage } from "../src/lib/creator-workflow";
import { visibilityWithQualityGuard } from "../src/lib/creator-publication";

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

assert(resolveCreatorWorkStage({ status: "ready", visibility: "public" }) === "published", "public ready work must be published");
assert(resolveCreatorWorkStage({ status: "draft_generating" }) === "generating", "generation states must be shared");
assert(resolveCreatorWorkStage({ status: "ready", quality: buildCreatorQualityReport({ kind: "game", score: 41 }) }) === "quality_review", "blocked quality must be reviewed");
assert(resolveCreatorWorkStage({ status: "ready", quality: buildCreatorQualityReport({ kind: "comic", score: 83 }) }) === "publishable", "quality-ready work must be publishable");
const blocked = buildCreatorQualityReport({ kind: "game", score: 41 });
assert(visibilityWithQualityGuard("public", blocked) === "pending_review", "blocked public work must enter review");
assert(visibilityWithQualityGuard("public", buildCreatorQualityReport({ kind: "novel", score: 62 })) === "public", "needs-polish work must remain publishable");
assert(visibilityWithQualityGuard("hidden", blocked) === "hidden", "explicit visibility must be preserved");
console.log("[OK] qa-creator-workflow");
