import type { WorkVisibility } from "@/lib/auth/work-visibility";
import type { CreatorQualityReport } from "@/lib/creator-workflow";

/**
 * Keep the configured default visibility unless automated evidence says the
 * work is unfit for public discovery. "needs_polish" remains publishable:
 * it is a creator-facing improvement signal, not a calibrated rejection.
 */
export function visibilityWithQualityGuard(
  visibility: WorkVisibility | string,
  quality: CreatorQualityReport,
): WorkVisibility {
  const configured: WorkVisibility = visibility === "hidden" || visibility === "pending_review" || visibility === "public"
    ? visibility
    : "public";
  return configured === "public" && quality.verdict === "blocked"
    ? "pending_review"
    : configured;
}
