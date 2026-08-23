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
export type LiteraryEngagementSummary = {
  sampleSize: number;
  starts: number;
  completed: number;
  completionRate: number;
  averageProgressRate: number;
  unitViews: number;
};

function roundRate(value: number): number {
  return Math.round(value * 10) / 10;
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
    for (const event of events) {
      if (event.event === "unit_view") maxUnit.set(event.sessionId, Math.max(maxUnit.get(event.sessionId) ?? 0, event.unitIndex));
    }
    const denominator = starts.size || maxUnit.size;
    const [workType, workId] = key.split(":", 2);
    const unitCount = Math.max(1, unitCountFor(workType!, workId!));
    const progressSessions = new Set([...starts, ...maxUnit.keys()]);
    const averageProgressRate = progressSessions.size
      ? roundRate([...progressSessions].reduce((sum, sessionId) => sum + Math.min(100, ((maxUnit.get(sessionId) ?? 0) / unitCount) * 100), 0) / progressSessions.size)
      : 0;
    return [key, {
      sampleSize: denominator,
      starts: starts.size,
      completed: completed.size,
      completionRate: denominator ? roundRate((completed.size / denominator) * 100) : 0,
      averageProgressRate,
      unitViews: events.filter((event) => event.event === "unit_view").length,
    }];
  }));
}

export async function summarizeLiteraryEngagement(input: { workType: "novel" | "comic"; workId: string; unitCount: number }) {
  const rows = await prisma.literaryEngagementEvent.findMany({
    where: { workType: input.workType, workId: input.workId },
    select: { workType: true, workId: true, sessionId: true, event: true, unitIndex: true },
  });
  return summarizeLiteraryEngagementRows(rows, () => input.unitCount).get(`${input.workType}:${input.workId}`) ?? {
    sampleSize: 0, starts: 0, completed: 0, completionRate: 0, averageProgressRate: 0, unitViews: 0,
  };
}
