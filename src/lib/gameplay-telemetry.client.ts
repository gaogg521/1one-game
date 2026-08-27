"use client";

import type { GameSpec } from "@/lib/game-spec";
import type { GameplayEventPayload } from "@/lib/gameplay-telemetry";

type GameplayEventName = GameplayEventPayload["event"];
type EventFields = Omit<GameplayEventPayload, "templateId" | "sessionId" | "event" | "projectId" | "creativeRevisionId" | "verticalSliceScore">;

function newSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `play-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * 试玩事件以 fire-and-forget 方式上报，任何网络或数据库失败都不能影响玩家对局。
 * 不传 prompt、键盘内容、IP、用户标识或设备指纹。
 */
export function createGameplayTelemetrySession(args: {
  spec: GameSpec;
  projectId?: string;
  creativeRevisionId?: string;
  verticalSliceScore: number;
}) {
  const sessionId = newSessionId();
  const startedAt = performance.now();
  const sent = new Set<GameplayEventName>();
  const touchCapable = typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
  const deviceClass = touchCapable && Math.min(window.innerWidth, window.innerHeight) <= 768 ? "mobile" as const : "desktop" as const;
  const orientation = window.innerHeight >= window.innerWidth ? "portrait" as const : "landscape" as const;

  const track = (event: GameplayEventName, fields: EventFields = {}, once = false) => {
    if (once && sent.has(event)) return;
    if (once) sent.add(event);
    const payload: GameplayEventPayload = {
      ...(args.projectId ? { projectId: args.projectId } : {}),
      ...(args.creativeRevisionId ? { creativeRevisionId: args.creativeRevisionId } : {}),
      templateId: args.spec.templateId,
      event,
      sessionId,
      elapsedMs: Math.round(Math.max(0, performance.now() - startedAt)),
      verticalSliceScore: args.verticalSliceScore,
      deviceClass,
      orientation,
      touchCapable,
      ...fields,
    };
    void fetch("/api/gameplay/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      /* 遥测失败不可干扰试玩 */
    });
  };

  return {
    start: () => track("start", {}, true),
    firstAction: () => track("first_action", {}, true),
    firstMinute: (activeMs: number, actionCount: number) => track("first_minute", { activeMs, actionCount }, true),
    end: (won: boolean, score: number) => track("end", { won, score }, true),
    retry: () => track("retry"),
  };
}
