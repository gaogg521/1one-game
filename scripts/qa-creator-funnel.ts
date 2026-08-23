import { randomUUID } from "crypto";
import { prisma } from "../src/lib/prisma";
import { summarizeCreatorFunnelRows } from "../src/lib/creator-funnel";

const baseUrl = process.env.QA_BASE_URL?.trim() || "http://127.0.0.1:8888";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  const sessionId = randomUUID();
  const username = `qafunnel${Date.now()}`;
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(`${baseUrl}/api/analytics/creator-funnel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `gcreator_funnel=${sessionId}` },
        body: JSON.stringify({ event: "visit" }),
      });
      assert(response.status === 202, "visit event must be accepted");
    }
    const persisted = await prisma.creatorFunnelEvent.findMany({
      where: { sessionId },
      select: { sessionId: true, event: true },
    });
    assert(persisted.length === 1 && persisted[0]?.event === "visit", "repeat visits must be idempotent per random session");

    const summary = summarizeCreatorFunnelRows([
      ...persisted,
      { sessionId, event: "create" },
      { sessionId, event: "create" },
      { sessionId: randomUUID(), event: "visit" },
      { sessionId: randomUUID(), event: "signup" },
    ]);
    const values = Object.fromEntries(summary.map((row) => [row.stage, row.value]));
    assert(values.creatorVisits === 2, "visit stage must count unique sessions");
    assert(values.creatorFirstCreates === 1, "create stage must collapse multiple media records in one session");
    assert(values.creatorSignups === 1 && values.creatorPublishes === 0, "empty stages must remain explicit");

    const signup = await fetch(`${baseUrl}/api/auth/register/username`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `gcreator_funnel=${sessionId}` },
      body: JSON.stringify({ username, password: "QaFunnel!2026", displayName: "Funnel QA" }),
    });
    assert(signup.ok, "username registration must succeed for funnel QA");
    const signupSignal = await prisma.creatorFunnelEvent.findUnique({
      where: { sessionId_event_workType: { sessionId, event: "signup", workType: "" } },
    });
    assert(signupSignal, "registration must write the anonymous signup stage");
    console.log("[OK] qa-creator-funnel");
  } finally {
    await prisma.user.deleteMany({ where: { username } }).catch(() => undefined);
    await prisma.creatorFunnelEvent.deleteMany({ where: { sessionId } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

void main();
