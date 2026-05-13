"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameSpec } from "@/lib/game-spec";
import { captureCanvasAsJpegDataUrl } from "@/lib/capture-game-thumb";
import { readReferenceImagePayloadsFromSession } from "@/lib/assets/reference-image-payloads.client";
import { createPhaserGame } from "@/game/engine/createPhaserGame";

export default function GamePlayerInner({
  spec,
  coverCapture,
}: {
  spec: GameSpec;
  coverCapture?: { projectId: string } | null;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<ReturnType<typeof createPhaserGame> | null>(null);
  const coverSentRef = useRef(false);
  const [session, setSession] = useState(0);
  const [result, setResult] = useState<{ score: number; won: boolean } | null>(null);

  useEffect(() => {
    coverSentRef.current = false;
  }, [coverCapture?.projectId]);

  useEffect(() => {
    const pid = coverCapture?.projectId;
    if (!pid || coverSentRef.current) return;
    if (typeof sessionStorage !== "undefined") {
      const k = `cover-uploaded:${pid}`;
      if (sessionStorage.getItem(k)) {
        coverSentRef.current = true;
        return;
      }
    }

    const tryUpload = () => {
      if (coverSentRef.current) return;
      const host = hostRef.current;
      if (!host) return;
      const dataUrl = captureCanvasAsJpegDataUrl(host, 520, 0.7);
      if (!dataUrl) return;

      void (async () => {
        try {
          const res = await fetch(`/api/projects/${pid}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ coverJpegBase64: dataUrl }),
          });
          if (res.ok) {
            coverSentRef.current = true;
            if (typeof sessionStorage !== "undefined") {
              sessionStorage.setItem(`cover-uploaded:${pid}`, "1");
            }
          }
        } catch {
          /* 静默失败，不影响试玩 */
        }
      })();
    };

    const t1 = window.setTimeout(tryUpload, 1600);
    const t2 = window.setTimeout(tryUpload, 4200);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [spec, session, coverCapture?.projectId]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    setResult(null);
    const refPayloads = readReferenceImagePayloadsFromSession();
    const game = createPhaserGame(el, spec, (r) => setResult(r), { referencePayloads: refPayloads });
    gameRef.current = game;
    return () => {
      game.destroy(true);
      gameRef.current = null;
    };
  }, [spec, session]);

  const restart = useCallback(() => {
    setResult(null);
    setSession((s) => s + 1);
  }, []);

  const fullscreen = useCallback(() => {
    const node = shellRef.current;
    if (!node) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void node.requestFullscreen().catch(() => {});
    }
  }, []);

  return (
    <div className="space-y-4">
      <div
        ref={shellRef}
        className="group relative overflow-hidden rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)] shadow-[0_24px_80px_-24px_rgba(0,0,0,0.9)]"
      >
        <div
          ref={hostRef}
          className="aspect-[920/560] w-full max-h-[min(70vh,620px)] bg-[color:color-mix(in_srgb,var(--gc-bg)_88%,#000)]"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-end gap-2 p-3">
          <button
            type="button"
            onClick={fullscreen}
            className="pointer-events-auto rounded-lg border border-[color:var(--gc-border)] bg-[color:color-mix(in_srgb,var(--gc-bg-elevated)_82%,#000)] px-3 py-1.5 text-xs font-medium text-[var(--gc-text-soft)] opacity-90 backdrop-blur-md transition hover:border-[color:color-mix(in_srgb,var(--gc-accent)_40%,transparent)] hover:text-[var(--gc-text)] md:opacity-0 md:transition-opacity md:group-hover:opacity-100"
          >
            全屏
          </button>
          <button
            type="button"
            onClick={restart}
            className="pointer-events-auto rounded-lg border border-[color:var(--gc-border)] bg-[color:color-mix(in_srgb,var(--gc-bg-elevated)_82%,#000)] px-3 py-1.5 text-xs font-medium text-[var(--gc-text-soft)] opacity-90 backdrop-blur-md transition hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))] hover:text-[var(--gc-text)] md:opacity-0 md:transition-opacity md:group-hover:opacity-100"
          >
            重开
          </button>
        </div>

        {result ? (
          <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-5 bg-black/70 px-6 text-center backdrop-blur-md">
            <div className="space-y-1">
              <p className="text-2xl font-semibold tracking-tight text-[var(--gc-text)]">
                {result.won ? "胜利" : "游戏结束"}
              </p>
              <p className="text-sm text-[var(--gc-muted)]">
                得分 <span className="tabular-nums text-[var(--gc-text)]">{result.score}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={restart}
              className="gc-theme-cta rounded-full px-8 py-2.5 text-sm font-semibold shadow-lg"
            >
              再来一局
            </button>
          </div>
        ) : null}
      </div>

      {result ? (
        <p className="text-center text-xs text-[var(--gc-muted)] md:hidden">提示：横屏或全屏可获得更大视野。</p>
      ) : null}
    </div>
  );
}
