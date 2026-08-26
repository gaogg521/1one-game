export type WorkVisibility = "public" | "hidden" | "pending_review";

/**
 * New creations always require an explicit author publication decision.
 * Deployment configuration may make a draft less visible, but must never
 * silently make newly generated work public.
 */
export function defaultWorkVisibility(): WorkVisibility {
  const v = process.env.DEFAULT_WORK_VISIBILITY?.trim();
  if (v === "hidden") return v;
  return "pending_review";
}
