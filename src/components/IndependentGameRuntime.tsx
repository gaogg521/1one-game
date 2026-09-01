"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GameSpec } from "@/lib/game-spec";

type Props = {
  spec: GameSpec;
  projectId?: string;
  onEnd?: (result: { won: boolean; score: number }) => void;
};

/** Runs only a game-specific module emitted by the code-generation agent. */
export function IndependentGameRuntime({ spec, projectId, onEnd }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [failed, setFailed] = useState(false);
  const source = spec.agenticModule?.source?.trim() ?? "";
  const runtimeReady = /\bmountGame\s*[=(]/.test(source) || /function\s+mountGame\s*\(/.test(source);
  const context = useMemo(() => ({
    title: spec.title,
    prompt: spec.labels.subtitle ?? "",
    winScore: spec.gameplay.winScore ?? 100,
    assets: projectId ? {
      background: `/game-bg/${projectId}.png`,
      player: `/game-sprites/${projectId}/player.png`,
      enemy: `/game-sprites/${projectId}/hazard.png`,
      collectible: `/game-sprites/${projectId}/gem.png`,
      power: `/game-sprites/${projectId}/power.png`,
    } : {},
  }), [projectId, spec.gameplay.winScore, spec.labels.subtitle, spec.title]);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow || !event.data || typeof event.data !== "object") return;
      if (event.data.type === "operone-game-end") onEnd?.({ won: Boolean(event.data.won), score: Number(event.data.score) || 0 });
      if (event.data.type === "operone-game-error") setFailed(true);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [onEnd]);

  if (!runtimeReady || failed) {
    return <section className="grid min-h-[min(70dvh,520px)] place-items-center rounded-2xl border border-amber-300/25 bg-[#08130f] px-6 text-center text-slate-100"><div className="max-w-md space-y-3"><p className="text-xs font-semibold uppercase tracking-[.18em] text-amber-300">Independent runtime required</p><h2 className="text-2xl font-bold">{spec.title}</h2><p className="text-sm leading-6 text-slate-300">这不是模板预览。该版本没有通过独立运行时生成与验证，因此不会用通用场景代替。</p></div></section>;
  }

  const safeSource = source.replace(/<\/script/gi, "<\\/script");
  const srcDoc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#game{margin:0;width:100%;height:100%;overflow:hidden;background:#06130e}*{box-sizing:border-box}</style></head><body><main id="game" aria-label="${spec.title.replace(/["<>]/g, "")}"></main><script>const ctx=${JSON.stringify(context).replace(/</g, "\\u003c")};const finish=(won,score=0)=>parent.postMessage({type:'operone-game-end',won,score},'*');try{${safeSource};if(typeof mountGame!=='function')throw new Error('mountGame missing');mountGame(document.getElementById('game'),{...ctx,finish});}catch(error){parent.postMessage({type:'operone-game-error',message:String(error)},'*');}</script></body></html>`;
  return <iframe ref={frameRef} title={spec.title} sandbox="allow-scripts" srcDoc={srcDoc} className="block min-h-[min(72dvh,640px)] w-full overflow-hidden rounded-2xl border-0 bg-[#06130e]" />;
}
