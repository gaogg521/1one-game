"use client";

import { useEffect, useRef, useState } from "react";
import type { GameSpec } from "@/lib/game-spec";
import { buildIndependentRuntimePage } from "@/lib/independent-runtime-page";
import { createGameplayTelemetrySession } from "@/lib/gameplay-telemetry.client";

type Props = {
  spec: GameSpec;
  projectId?: string;
  creativeRevisionId?: string;
  previewMode?: boolean;
  onEnd?: (result: { won: boolean; score: number }) => void;
  /** Observable runtime facts, forwarded so QA can judge behaviour not source. */
  onTelemetry?: (event: { type: string; [key: string]: unknown }) => void;
};

/** Runs a game-specific module emitted by the code agents on top of the SDK. */
export function IndependentGameRuntime({ spec, projectId, creativeRevisionId, previewMode, onEnd, onTelemetry }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const source = spec.agenticModule?.source?.trim() ?? "";
  const runtimeReady = /\bmountGame\s*[=(]/.test(source) || /function\s+mountGame\s*\(/.test(source);

  useEffect(() => {
    const createSession = () => !previewMode && projectId && creativeRevisionId ? createGameplayTelemetrySession({ spec, projectId, creativeRevisionId, verticalSliceScore: 0 }) : null;
    let session = createSession();
    let started = false, ended = false, actions = 0, activeMs = 0, lastBeat = 0, lastTick = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      if (started && !ended && document.visibilityState === "visible" && now - lastBeat < 2000) activeMs += Math.min(1000, now - lastTick);
      lastTick = now;
      if (activeMs >= 60_000) session?.firstMinute(Math.round(activeMs), actions);
    }, 500);
    const receive = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow || !event.data || typeof event.data !== "object") return;
      const data = event.data as { type?: string; won?: unknown; score?: unknown; message?: unknown };
      if (data.type === "forge-heartbeat" || data.type === "operone-game-heartbeat" || data.type === "operone-game-mounted") {
        lastBeat = performance.now();
        started = true;
        session?.start();
      }
      if (data.type === "operone-game-input" && started && !ended) { actions += 1; session?.firstAction(); }
      if (data.type === "forge-restart") {
        session?.retry();
        session = createSession();
        session?.start();
        started = true; ended = false; actions = 0; activeMs = 0; lastBeat = performance.now();
      }
      if (data.type === "operone-game-end" || data.type === "forge-end") {
        if (!ended) { session?.end(Boolean(data.won), Math.max(0, Math.round(Number(data.score) || 0))); onEnd?.({ won: Boolean(data.won), score: Number(data.score) || 0 }); }
        ended = true;
      }
      if (data.type === "operone-game-error" || data.type === "forge-error") {
        setFailed(typeof data.message === "string" ? data.message : "runtime error");
      }
      if (typeof data.type === "string" && data.type.startsWith("forge-")) {
        onTelemetry?.(event.data as { type: string });
      }
    };
    window.addEventListener("message", receive);
    return () => { window.removeEventListener("message", receive); window.clearInterval(timer); };
  }, [onEnd, onTelemetry, creativeRevisionId, previewMode, projectId, spec]);

  if (!runtimeReady || failed) {
    return (
      <section className="grid min-h-[min(70dvh,520px)] place-items-center rounded-2xl border border-amber-300/25 bg-[#08130f] px-6 text-center text-slate-100">
        <div className="max-w-md space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-amber-300">Independent runtime required</p>
          <h2 className="text-2xl font-bold">{spec.title}</h2>
          <p className="text-sm leading-6 text-slate-300">
            这不是模板预览。该版本没有通过独立运行时生成与验证，因此不会用通用场景代替。
          </p>
          {failed ? <p className="text-xs text-rose-300/80">{failed}</p> : null}
        </div>
      </section>
    );
  }

  const srcDoc = buildIndependentRuntimePage(spec, projectId);

  return (
    <iframe
      ref={frameRef}
      title={spec.title}
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      className="block min-h-[min(72dvh,640px)] w-full overflow-hidden rounded-2xl border-0 bg-[#06130e]"
    />
  );
}
