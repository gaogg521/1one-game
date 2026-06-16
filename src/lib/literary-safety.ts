export type WorkVisibility = "public" | "hidden" | string | null | undefined;
export type WorkStatus = "ready" | "draft_generating" | string | null | undefined;

export function publicReadyWorkWhere(): { visibility: "public"; status: "ready" } {
  return { visibility: "public", status: "ready" };
}

export function canReadWorkPublicly(work: { visibility: WorkVisibility; status: WorkStatus }): boolean {
  return work.visibility === "public" && work.status === "ready";
}

export function shouldChargeNovelStreamQuota(resumeNovelId: string | undefined): boolean {
  return !resumeNovelId;
}
