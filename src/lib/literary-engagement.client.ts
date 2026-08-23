"use client";

import type { LiteraryEngagementPayload } from "@/lib/literary-engagement";

function randomSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `literary-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

function sessionFor(workType: "novel" | "comic", workId: string) {
  const key = `operone:literary-session:${workType}:${workId}`;
  try {
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const next = randomSessionId();
    window.sessionStorage.setItem(key, next);
    return next;
  } catch {
    return randomSessionId();
  }
}

/** Fire-and-forget only: no content, prompt, identity or fingerprint is sent. */
export function reportLiteraryEngagement(input: Omit<LiteraryEngagementPayload, "sessionId">) {
  if (typeof window === "undefined") return;
  const body: LiteraryEngagementPayload = { ...input, sessionId: sessionFor(input.workType, input.workId) };
  void fetch("/api/literary/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => undefined);
}
