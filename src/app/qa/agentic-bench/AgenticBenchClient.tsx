"use client";

import { useEffect, useRef } from "react";
import type { GameSpec } from "@/lib/game-spec";
import type { AgenticBrowserBenchProbe } from "@/lib/opengame-skills/browser-bench";

function publishBench(bench: AgenticBrowserBenchProbe) {
  window.__OPERONE_AGENTIC_BENCH__ = { ...bench };
}

export default function AgenticBenchClient({ spec }: { spec: GameSpec }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bench: AgenticBrowserBenchProbe = {
      status: "pending",
      consoleErrors: [],
    };
    publishBench(bench);

    const onError = (e: ErrorEvent) => {
      bench.consoleErrors = [...(bench.consoleErrors ?? []), e.message || String(e.error)];
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const msg = e.reason instanceof Error ? e.reason.message : String(e.reason);
      bench.consoleErrors = [...(bench.consoleErrors ?? []), msg];
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    let destroyed = false;
    let timer: number | undefined;
    let gameDestroy: (() => void) | undefined;
    let gameRef: import("phaser").Game | null = null;

    const readSceneKey = (): string | null => {
      if (!gameRef) return null;
      const scenes = gameRef.scene.getScenes(true);
      return scenes[0]?.scene?.key ?? null;
    };

    const fail = (message: string) => {
      if (destroyed) return;
      bench.status = "error";
      bench.errorMessage = message;
      publishBench(bench);
    };

    const finishProbe = () => {
      if (destroyed) return;
      const el = hostRef.current;
      const canvas = el?.querySelector("canvas");
      bench.canvasVisible = Boolean(canvas && canvas.offsetWidth > 0 && canvas.offsetHeight > 0);
      bench.sceneKey = readSceneKey();
      bench.moduleFailed = bench.sceneKey !== "AgenticScene";
      if (canvas && bench.canvasVisible) {
        bench.canvasNonEmpty = !bench.moduleFailed;
      }
      bench.status = bench.moduleFailed || bench.canvasVisible === false ? "error" : "done";
      publishBench(bench);
    };

    void (async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
      if (destroyed) return;

      const el = hostRef.current;
      if (!el) {
        fail("missing_host");
        return;
      }

      try {
        const [{ createPhaserGame }, { markPhaserPlayReady }] = await Promise.all([
          import("@/game/engine/createPhaserGame"),
          import("@/game/engine/phaser-play-ready"),
        ]);
        if (destroyed) return;

        const handle = createPhaserGame(el, spec, () => {}, {
          uiLocale: "zh-Hans",
          preserveAgenticModule: true,
        });
        gameRef = handle.game;
        gameDestroy = () => handle.game.destroy(true);
        bench.phaserReady = true;
        publishBench(bench);

        timer = window.setTimeout(() => {
          markPhaserPlayReady();
          finishProbe();
        }, 2600);
      } catch (e) {
        fail(e instanceof Error ? e.message : "boot_failed");
      }
    })();

    return () => {
      destroyed = true;
      if (timer) window.clearTimeout(timer);
      gameDestroy?.();
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [spec]);

  return (
    <div
      ref={hostRef}
      data-testid="agentic-bench-host"
      style={{ width: 920, height: 560, margin: "0 auto", background: "#0f172a" }}
      tabIndex={0}
    />
  );
}
