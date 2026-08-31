import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GameplayEventPayloadSchema } from "@/lib/gameplay-telemetry";
import { persistFirstMinutePlaytestEvidenceWithRetry, persistGameDeliveryPlaytestEvidenceWithRetry } from "@/lib/game-playtest-evidence";
import { isPrismaUniqueViolation } from "@/lib/prisma-errors";
import { evaluateAndPersistGameDistribution } from "@/lib/game-distribution-loop";

export const runtime = "nodejs";

/**
 * Minimal anonymous play-quality telemetry. This route intentionally accepts
 * no prompt, user identity, raw input, or client fingerprint.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = GameplayEventPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_event" }, { status: 400 });
  }

  const gameplayEvent = prisma.gameplayEvent;
  if (!gameplayEvent) {
    // A long-running process may still hold a Client generated before this
    // model was added. Telemetry is intentionally non-blocking; retry after a
    // safe restart rather than failing the game itself.
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  // Draft previews are useful to the creator, but they are not production
  // candidates. Never let their telemetry drive retention, auto-iteration or
  // distribution. This also rejects a forged revision/project pairing.
  if (parsed.data.projectId && parsed.data.creativeRevisionId) {
    const core = await prisma.creativeProject.findUnique({
      where: { legacyType_legacyId: { legacyType: "project", legacyId: parsed.data.projectId } },
      select: {
        revisions: {
          where: { id: parsed.data.creativeRevisionId, status: "ready" },
          take: 1,
          select: { id: true },
        },
      },
    });
    if (!core?.revisions[0]) {
      return NextResponse.json({ ok: false, ignored: "production_not_ready" }, { status: 202 });
    }
  }

  try {
    const eventKey = parsed.data.projectId && parsed.data.creativeRevisionId
      ? `${parsed.data.projectId}:${parsed.data.creativeRevisionId}:${parsed.data.sessionId}:${parsed.data.event}`
      : null;
    await gameplayEvent.create({ data: { ...parsed.data, eventKey } });
  } catch (error) {
    if (isPrismaUniqueViolation(error)) {
      // A keepalive retry is still allowed to repair a previously missed Core
      // evidence write below; the gameplay row itself remains exactly-once.
    } else {
    // The client deliberately treats this telemetry route as non-blocking.
      return NextResponse.json({ ok: false }, { status: 503 });
    }
  }
  // Runtime proof must never slow or break the game. A failed Core write is
  // retriable through a later first-minute event, while telemetry remains kept.
  if (parsed.data.event === "first_minute" && parsed.data.projectId) {
    void persistFirstMinutePlaytestEvidenceWithRetry(parsed.data).catch(() => undefined);
  }
  if ((parsed.data.event === "first_minute" || parsed.data.event === "end") && parsed.data.projectId && parsed.data.creativeRevisionId) {
    void persistGameDeliveryPlaytestEvidenceWithRetry(parsed.data).catch(() => undefined);
    void evaluateAndPersistGameDistribution({
      projectId: parsed.data.projectId,
      creativeRevisionId: parsed.data.creativeRevisionId,
    }).catch(() => undefined);
  }
  return NextResponse.json({ ok: true }, { status: 202 });
}
