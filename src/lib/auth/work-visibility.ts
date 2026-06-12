export type WorkVisibility = "public" | "hidden" | "pending_review";

/** 新作品默认可见性；可通过 DEFAULT_WORK_VISIBILITY 环境变量覆盖。 */
export function defaultWorkVisibility(): WorkVisibility {
  const v = process.env.DEFAULT_WORK_VISIBILITY?.trim();
  if (v === "pending_review" || v === "hidden" || v === "public") return v;
  return "public";
}
