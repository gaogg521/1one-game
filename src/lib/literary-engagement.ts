import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const LITERARY_ENGAGEMENT_EVENTS = ["start", "unit_view", "complete"] as const;
export const LiteraryEngagementPayloadSchema = z.object({
  workType: z.enum(["novel", "comic"]),
  workId: z.string().min(1).max(96),
  sessionId: z.string().min(12).max(96),
  event: z.enum(LITERARY_ENGAGEMENT_EVENTS),
  unitIndex: z.number().int().min(0).max(10_000).optional(),
}).superRefine((value, ctx) => {
  if (value.event === "unit_view" && (!value.unitIndex || value.unitIndex < 1)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "unit_view_requires_unit" });
  }
  if (value.event !== "unit_view" && value.unitIndex !== undefined && value.unitIndex !== 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "work_event_requires_zero_unit" });
  }
});

export type LiteraryEngagementPayload = z.infer<typeof LiteraryEngagementPayloadSchema>;
export const LITERARY_QUALITY_MIN_SAMPLES = 10;

export type LiteraryEngagementAlert = {
  code: "low_completion" | "early_dropoff";
  recommendedUnitIndex?: number;
};

export type LiteraryEngagementHealth = {
  status: "insufficient_sample" | "attention" | "healthy";
  minSamples: number;
  alerts: LiteraryEngagementAlert[];
};

export type LiteraryEngagementSummary = {
  sampleSize: number;
  starts: number;
  completed: number;
  completionRate: number;
  averageProgressRate: number;
  unitViews: number;
  /** Unique anonymous sessions which reached each chapter/page. */
  unitViewsByIndex: Array<{ unitIndex: number; viewers: number }>;
  health: LiteraryEngagementHealth;
};

function roundRate(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Consumption signals are advisory only. They intentionally wait for a small
 * cohort before flagging a work, so a single reader never changes publishing
 * eligibility or creates a false quality alarm.
 */
export function assessLiteraryEngagementHealth(input: Omit<LiteraryEngagementSummary, "health">): LiteraryEngagementHealth {
  if (input.sampleSize < LITERARY_QUALITY_MIN_SAMPLES) {
    return { status: "insufficient_sample", minSamples: LITERARY_QUALITY_MIN_SAMPLES, alerts: [] };
  }

  const alerts: LiteraryEngagementAlert[] = [];
  if (input.completionRate < 35) alerts.push({ code: "low_completion" });
  if (input.unitViewsByIndex.length > 0 && input.averageProgressRate < 45) {
    const firstDropoff = input.unitViewsByIndex.find(({ viewers }) => viewers / input.sampleSize < 0.6);
    alerts.push({ code: "early_dropoff", ...(firstDropoff ? { recommendedUnitIndex: firstDropoff.unitIndex } : {}) });
  }
  return {
    status: alerts.length ? "attention" : "healthy",
    minSamples: LITERARY_QUALITY_MIN_SAMPLES,
    alerts,
  };
}

/** Aggregate random-session events only; no reader identity or source text enters this result. */
export function summarizeLiteraryEngagementRows(
  rows: Array<{ workType: string; workId: string; sessionId: string; event: string; unitIndex: number }>,
  unitCountFor: (workType: string, workId: string) => number,
): Map<string, LiteraryEngagementSummary> {
  const byWork = new Map<string, Array<(typeof rows)[number]>>();
  for (const row of rows) {
    const key = `${row.workType}:${row.workId}`;
    const list = byWork.get(key) ?? [];
    list.push(row);
    byWork.set(key, list);
  }
  return new Map([...byWork.entries()].map(([key, events]) => {
    const starts = new Set(events.filter((event) => event.event === "start").map((event) => event.sessionId));
    const completed = new Set(events.filter((event) => event.event === "complete").map((event) => event.sessionId));
    const maxUnit = new Map<string, number>();
    const viewersByUnit = new Map<number, Set<string>>();
    for (const event of events) {
      if (event.event === "unit_view") {
        maxUnit.set(event.sessionId, Math.max(maxUnit.get(event.sessionId) ?? 0, event.unitIndex));
        const viewers = viewersByUnit.get(event.unitIndex) ?? new Set<string>();
        viewers.add(event.sessionId);
        viewersByUnit.set(event.unitIndex, viewers);
      }
    }
    const denominator = starts.size || maxUnit.size;
    const [workType, workId] = key.split(":", 2);
    const unitCount = Math.max(1, unitCountFor(workType!, workId!));
    const progressSessions = new Set([...starts, ...maxUnit.keys()]);
    const averageProgressRate = progressSessions.size
      ? roundRate([...progressSessions].reduce((sum, sessionId) => sum + Math.min(100, ((maxUnit.get(sessionId) ?? 0) / unitCount) * 100), 0) / progressSessions.size)
      : 0;
    const summary = {
      sampleSize: denominator,
      starts: starts.size,
      completed: completed.size,
      completionRate: denominator ? roundRate((completed.size / denominator) * 100) : 0,
      averageProgressRate,
      unitViews: events.filter((event) => event.event === "unit_view").length,
      unitViewsByIndex: [...viewersByUnit.entries()]
        .map(([unitIndex, viewers]) => ({ unitIndex, viewers: viewers.size }))
        .sort((a, b) => a.unitIndex - b.unitIndex),
    };
    return [key, { ...summary, health: assessLiteraryEngagementHealth(summary) }];
  }));
}

export async function summarizeLiteraryEngagement(input: { workType: "novel" | "comic"; workId: string; unitCount: number }) {
  const rows = await prisma.literaryEngagementEvent.findMany({
    where: { workType: input.workType, workId: input.workId },
    select: { workType: true, workId: true, sessionId: true, event: true, unitIndex: true },
  });
  return summarizeLiteraryEngagementRows(rows, () => input.unitCount).get(`${input.workType}:${input.workId}`) ?? {
    sampleSize: 0, starts: 0, completed: 0, completionRate: 0, averageProgressRate: 0, unitViews: 0,
    unitViewsByIndex: [],
    health: { status: "insufficient_sample", minSamples: LITERARY_QUALITY_MIN_SAMPLES, alerts: [] },
  };
}
