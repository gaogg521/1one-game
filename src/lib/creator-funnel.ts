import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { CreatorWorkKind } from "@/lib/creator-workflow";

const FUNNEL_COOKIE = "gcreator_funnel";
const FUNNEL_SESSION_PATTERN = /^[a-f0-9-]{36}$/i;
const FUNNEL_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type CreatorFunnelEventName = "visit" | "signup" | "create" | "publish";
export type CreatorFunnelStage = "creatorVisits" | "creatorSignups" | "creatorFirstCreates" | "creatorPublishes";

/** Aggregate only random-session event rows; caller never receives a session id. */
export function summarizeCreatorFunnelRows(
  rows: Array<{ sessionId: string; event: string }>,
): Array<{ stage: CreatorFunnelStage; value: number }> {
  const countSessions = (event: CreatorFunnelEventName) => new Set(
    rows.filter((row) => row.event === event).map((row) => row.sessionId),
  ).size;
  return [
    { stage: "creatorVisits", value: countSessions("visit") },
    { stage: "creatorSignups", value: countSessions("signup") },
    { stage: "creatorFirstCreates", value: countSessions("create") },
    { stage: "creatorPublishes", value: countSessions("publish") },
  ];
}

/**
 * Records one idempotent activation signal per random browser session.
 * The event is intentionally not tied to a user, owner key, work id, prompt,
 * IP address, or device identifier; the admin API exposes aggregates only.
 */
export async function recordCreatorFunnelEvent(input: {
  event: CreatorFunnelEventName;
  workType?: CreatorWorkKind;
}): Promise<void> {
  try {
    const jar = await cookies();
    let sessionId = jar.get(FUNNEL_COOKIE)?.value;
    if (!sessionId || !FUNNEL_SESSION_PATTERN.test(sessionId)) {
      sessionId = randomUUID();
      jar.set(FUNNEL_COOKIE, sessionId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: FUNNEL_SESSION_MAX_AGE_SECONDS,
      });
    }
    const workType = input.workType ?? "";
    await prisma.creatorFunnelEvent.upsert({
      where: { sessionId_event_workType: { sessionId, event: input.event, workType } },
      create: { sessionId, event: input.event, workType },
      update: {},
    });
  } catch (error) {
    // Measurement must never block authentication, creation, or publication.
    console.error("[creator-funnel] record failed", { event: input.event, error });
  }
}
