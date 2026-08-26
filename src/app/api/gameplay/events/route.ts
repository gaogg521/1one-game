import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GameplayEventPayloadSchema } from "@/lib/gameplay-telemetry";
import { persistFirstMinutePlaytestEvidence } from "@/lib/game-playtest-evidence";

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

  try {
    await gameplayEvent.create({ data: parsed.data });
  } catch {
    // The client deliberately treats this telemetry route as non-blocking.
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  // Runtime proof must never slow or break the game. A failed Core write is
  // retriable through a later first-minute event, while telemetry remains kept.
  if (parsed.data.event === "first_minute" && parsed.data.projectId) {
    void persistFirstMinutePlaytestEvidence(parsed.data).catch(() => undefined);
  }
  return NextResponse.json({ ok: true }, { status: 202 });
}
