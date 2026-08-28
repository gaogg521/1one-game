export type WorkVisibility = "public" | "hidden" | "pending_review" | string | null | undefined;
export type WorkStatus = "ready" | "draft_generating" | "pending_images" | string | null | undefined;

const DIRECT_LINK_STATUSES = new Set(["ready", "pending_images"]);

export function publicReadyWorkWhere(): { visibility: "public"; status: "ready" } {
  return { visibility: "public", status: "ready" };
}

/** Listed on discover / public feeds. New work stays off this list until explicit publish. */
export function canReadWorkPublicly(work: { visibility: WorkVisibility; status: WorkStatus }): boolean {
  return work.visibility === "public" && work.status === "ready";
}

/**
 * Anyone holding the work URL may open it.
 * `pending_review` is unlisted (shareable, not in discover); `hidden` stays owner-only.
 * Comics often stay `pending_images` until panel renders finish — that is still readable.
 */
export function canAccessWorkByDirectLink(work: { visibility: WorkVisibility; status: WorkStatus }): boolean {
  if (!DIRECT_LINK_STATUSES.has(String(work.status ?? ""))) return false;
  return work.visibility === "public" || work.visibility === "pending_review";
}

export function shouldChargeNovelStreamQuota(resumeNovelId: string | undefined): boolean {
  return !resumeNovelId;
}
