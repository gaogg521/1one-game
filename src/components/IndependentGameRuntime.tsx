"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GameSpec } from "@/lib/game-spec";
import { GAME_FORGE_SDK_SOURCE } from "@/lib/game-forge/runtime-sdk";

type Props = {
  spec: GameSpec;
  projectId?: string;
  onEnd?: (result: { won: boolean; score: number }) => void;
  /** Observable runtime facts, forwarded so QA can judge behaviour not source. */
  onTelemetry?: (event: { type: string; [key: string]: unknown }) => void;
};

/** Legacy slot names kept so games generated before the forge still resolve. */
const LEGACY_SLOTS: Array<[string, string]> = [
  ["player", "player"],
  ["enemy", "hazard"],
  ["collectible", "gem"],
  ["power", "power"],
  ["boss", "boss"],
];

/** Runs a game-specific module emitted by the code agents on top of the SDK. */
export function IndependentGameRuntime({ spec, projectId, onEnd, onTelemetry }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const source = spec.agenticModule?.source?.trim() ?? "";
  const runtimeReady = /\bmountGame\s*[=(]/.test(source) || /function\s+mountGame\s*\(/.test(source);

  const context = useMemo(() => {
    const assets: Record<string, string> = {};
    if (projectId) {
      assets.background = `/game-bg/${projectId}.png`;
      for (const [key, file] of LEGACY_SLOTS) assets[key] = `/game-sprites/${projectId}/${file}.png`;
      // Slots the design asked for beyond the legacy five.
      const design = spec.forgeBuild?.design as { assets?: Array<{ key?: string }> } | undefined;
      for (const slot of design?.assets ?? []) {
        if (slot?.key && !assets[slot.key]) assets[slot.key] = `/game-sprites/${projectId}/${slot.key}.png`;
      }
      assets.music = `/api/projects/${projectId}/bgm`;
    }
    return {
      title: spec.title,
      prompt: spec.labels.subtitle ?? "",
      winScore: spec.gameplay.winScore ?? 100,
      assets,
    };
  }, [projectId, spec.forgeBuild, spec.gameplay.winScore, spec.labels.subtitle, spec.title]);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow || !event.data || typeof event.data !== "object") return;
      const data = event.data as { type?: string; won?: unknown; score?: unknown; message?: unknown };
      if (data.type === "operone-game-end" || data.type === "forge-end") {
        onEnd?.({ won: Boolean(data.won), score: Number(data.score) || 0 });
      }
      if (data.type === "operone-game-error" || data.type === "forge-error") {
        setFailed(typeof data.message === "string" ? data.message : "runtime error");
      }
      if (typeof data.type === "string" && data.type.startsWith("forge-")) {
        onTelemetry?.(event.data as { type: string });
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [onEnd, onTelemetry]);

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

  const safeSource = source.replace(/<\/script/gi, "<\\/script");
  const safeSdk = GAME_FORGE_SDK_SOURCE.replace(/<\/script/gi, "<\\/script");
  const srcDoc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>html,body,#game{margin:0;width:100%;height:100%;overflow:hidden;background:#06130e}*{box-sizing:border-box}</style></head><body><main id="game" aria-label="${spec.title.replace(/["<>]/g, "")}"></main><script>${safeSdk}</script><script>const ctx=${JSON.stringify(context).replace(/</g, "\\u003c")};const post=(t,p)=>{try{parent.postMessage(Object.assign({type:t},p||{}),'*')}catch(e){}};ctx.finish=(won,score=0)=>post('operone-game-end',{won:!!won,score:Number(score)||0});ctx.reportError=(e)=>post('operone-game-error',{message:String(e&&e.message?e.message:e)});try{${safeSource};if(typeof mountGame!=='function')throw new Error('mountGame missing');mountGame(document.getElementById('game'),ctx);}catch(error){ctx.reportError(error);}</script></body></html>`;

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
