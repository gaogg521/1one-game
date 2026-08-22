/** 平台层统一作品状态：媒介差异留在 quality evidence，生命周期对创作者保持一致。 */
export type CreatorWorkKind = "game" | "novel" | "comic";
export type CreatorWorkStage = "draft" | "generating" | "quality_review" | "editable" | "publishable" | "published";

export type CreatorQualityReport = {
  verdict: "ready" | "needs_polish" | "blocked";
  score?: number;
  evidence: string[];
};

export function resolveCreatorWorkStage(input: {
  status?: string | null;
  visibility?: string | null;
  quality?: CreatorQualityReport | null;
}): CreatorWorkStage {
  if (input.visibility === "public" && input.status === "ready") return "published";
  if (/generating|queued|rendering/i.test(input.status ?? "")) return "generating";
  if (input.quality?.verdict === "blocked") return "quality_review";
  if (input.quality?.verdict === "needs_polish") return "editable";
  if (input.status === "ready") return "publishable";
  return "draft";
}

export function buildCreatorQualityReport(input: {
  kind: CreatorWorkKind;
  score?: number;
  evidence?: string[];
}): CreatorQualityReport {
  const score = input.score;
  const verdict = score == null ? "needs_polish" : score >= 75 ? "ready" : score < 45 ? "blocked" : "needs_polish";
  return { verdict, ...(score == null ? {} : { score }), evidence: input.evidence ?? [] };
}
