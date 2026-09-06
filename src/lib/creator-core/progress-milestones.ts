import { z } from "zod";

/**
 * Creator-visible milestones for a long generation.
 *
 * A build takes minutes because reasoning models take 40-170s per call and the
 * pipeline makes several. Compressing that below a creator's patience is not
 * realistic — but a spinner with a percentage spends that time showing
 * nothing, while the pipeline is in fact producing things the creator would
 * want to see the moment they exist: the design document after ~40s, each
 * finished code module, each piece of art as it lands.
 *
 * So progress carries the artefacts, not just a percentage. `progressJson`
 * keeps its original `{percent, stage, detail}` shape for existing readers and
 * gains a bounded `milestones` list.
 */

export const MILESTONE_KINDS = [
  /** The design document — the first thing worth reading, and it arrives early. */
  "design",
  /** One finished code module. */
  "module",
  /** One finished image, with the url so the UI can show it immediately. */
  "art",
  /** A QA verdict, including what is being repaired and why. */
  "qa",
  /** A repair round targeting specific modules. */
  "repair",
  /** Terminal: the build is playable. */
  "ready",
] as const;

export const ProgressMilestoneSchema = z.object({
  kind: z.enum(MILESTONE_KINDS),
  /** One short line the creator can read. Written for a person, not a log. */
  label: z.string().min(1).max(160),
  /** Seconds since the job started, so the UI can show a real timeline. */
  atMs: z.number().int().min(0),
  /** Image url for `art`, so the picture appears as soon as it exists. */
  imageUrl: z.string().max(300).optional(),
  /** Structured payload for `design` (title/pitch/mechanics) etc. */
  data: z.record(z.string(), z.unknown()).optional(),
});
export type ProgressMilestone = z.infer<typeof ProgressMilestoneSchema>;

export const JobProgressSchema = z.object({
  percent: z.number().int().min(0).max(100),
  stage: z.string(),
  detail: z.string().optional(),
  milestones: z.array(ProgressMilestoneSchema).max(40).default([]),
});
export type JobProgress = z.infer<typeof JobProgressSchema>;

/** Keeps the newest milestones when a long build produces more than the cap. */
export const MAX_MILESTONES = 40;

export function appendMilestone(existing: ProgressMilestone[], next: ProgressMilestone): ProgressMilestone[] {
  const merged = [...existing, next];
  return merged.length > MAX_MILESTONES ? merged.slice(merged.length - MAX_MILESTONES) : merged;
}

/** Tolerates rows written before milestones existed. */
export function parseJobProgress(raw: string | null | undefined): JobProgress | null {
  if (!raw) return null;
  try {
    const parsed = JobProgressSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
