"use client";

import { useEffect } from "react";

/** Starts an anonymous, HttpOnly 30-day funnel session without blocking rendering. */
export function CreatorFunnelTracker() {
  useEffect(() => {
    void fetch("/api/analytics/creator-funnel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "visit" }),
      keepalive: true,
    });
  }, []);
  return null;
}
