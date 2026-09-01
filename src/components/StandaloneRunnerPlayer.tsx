"use client";

import { useEffect, useRef, useState } from "react";
import type { GameSpec } from "@/lib/game-spec";

type Props = {
  spec: GameSpec;
  projectId?: string;
  previewMode?: boolean;
  onEnd?: (result: { won: boolean; score: number }) => void;
};

type Actor = { id: number; lane: number; z: number; kind: "hazard" | "gem" };

/**
 * Asset-first standalone runner.  This deliberately does not import a game
 * framework: the saved project's visual output is the stage and every actor
 * comes from that project's generated PNG kit.
 */
export function StandaloneRunnerPlayer({ spec, projectId, previewMode = false, onEnd }: Props) {
  const [lane, setLane] = useState(1);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(spec.gameplay.lives ?? 3);
  const [actors, setActors] = useState<Actor[]>([]);
  const [ended, setEnded] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const state = useRef({ lane: 1, score: 0, lives: spec.gameplay.lives ?? 3, actors: [] as Actor[], nextId: 1, ended: false });
  const target = Math.max(600, spec.endlessRunner?.targetScore ?? spec.gameplay.winScore ?? 1200);
  const assetBase = projectId ? `/game-sprites/${projectId}` : null;
  const background = projectId ? `/game-bg/${projectId}.png` : null;

  const reset = () => {
    state.current = { lane: 1, score: 0, lives: spec.gameplay.lives ?? 3, actors: [], nextId: 1, ended: false };
    setLane(1); setScore(0); setLives(state.current.lives); setActors([]); setEnded(false);
  };

  useEffect(() => {
    reset();
    const timer = window.setInterval(() => {
      const s = state.current;
      if (s.ended) return;
      const next = s.actors
        .map((a) => ({ ...a, z: a.z + 0.045 }))
        .filter((a) => a.z < 1.18);
      if (Math.random() < 0.14) next.push({ id: s.nextId++, lane: Math.floor(Math.random() * 3), z: 0, kind: Math.random() < 0.62 ? "gem" : "hazard" });
      for (const actor of next) {
        if (actor.z < 0.86 || actor.z > 1.02 || actor.lane !== s.lane) continue;
        if (actor.kind === "gem") {
          actor.z = 2;
          s.score += 40;
        } else {
          actor.z = 2;
          s.lives -= 1;
        }
      }
      s.score += 3;
      const won = s.score >= target;
      const lost = s.lives <= 0;
      if (won || lost) {
        s.ended = true;
        if (!previewMode) onEnd?.({ won, score: s.score });
        if (previewMode) window.setTimeout(reset, 900);
      }
      s.actors = next.filter((a) => a.z < 1.18);
      setLane(s.lane); setScore(s.score); setLives(s.lives); setActors([...s.actors]); setEnded(s.ended);
    }, 120);
    return () => window.clearInterval(timer);
  // Intentional restart only for a new saved game/version.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, target]);

  const shift = (delta: number) => {
    if (state.current.ended) return;
    state.current.lane = Math.max(0, Math.min(2, state.current.lane + delta));
    setLane(state.current.lane);
  };

  const actorStyle = (actor: Actor) => {
    const z = Math.min(1, actor.z);
    const x = 50 + (actor.lane - 1) * (12 + z * 21);
    const y = 27 + z * 62;
    const size = 24 + z * 52;
    return { left: `${x}%`, top: `${y}%`, width: size, height: size, transform: "translate(-50%, -50%)", zIndex: Math.round(20 + z * 20) };
  };

  const status = ended ? (score >= target ? "神庙已抵达" : "遗迹险境") : "横滑切道 · 上滑跳跃 · 下滑翻滚";
  return (
    <section
      className="relative min-h-[min(72dvh,640px)] overflow-hidden rounded-2xl bg-[#061713] text-white shadow-2xl"
      style={background ? { backgroundImage: `linear-gradient(180deg,rgba(2,9,7,.12),rgba(2,9,7,.38)),url(${background})`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}
      onPointerDown={(event) => { touch.current = { x: event.clientX, y: event.clientY }; }}
      onPointerUp={(event) => { const start = touch.current; touch.current = null; if (!start) return; const dx = event.clientX - start.x; const dy = event.clientY - start.y; if (Math.abs(dx) > 24 && Math.abs(dx) >= Math.abs(dy)) shift(dx < 0 ? -1 : 1); }}
    >
      <div className="absolute inset-x-0 top-0 z-50 flex items-center justify-between bg-black/35 px-4 py-3 text-sm font-bold backdrop-blur-sm">
        <span>{spec.title}</span><span>神像 {Math.floor(score / 40)} · 生命 {lives}</span>
      </div>
      <div className="absolute inset-x-[12%] bottom-[-14%] top-[22%] z-10 origin-top bg-[linear-gradient(90deg,rgba(17,31,34,.78),rgba(47,65,66,.64),rgba(17,31,34,.78))] [clip-path:polygon(32%_0,68%_0,100%_100%,0_100%)] shadow-[0_0_55px_rgba(255,200,80,.16)]" />
      <div className="absolute inset-x-[12%] bottom-[-14%] top-[22%] z-20 [clip-path:polygon(32%_0,68%_0,100%_100%,0_100%)] opacity-80" style={{ backgroundImage: "repeating-linear-gradient(0deg,transparent 0 42px,rgba(255,222,130,.18) 43px 45px)" }} />
      {[0, 1, 2].map((line) => <div key={line} className="absolute z-20 h-[78%] w-px bg-amber-200/75" style={{ left: `${29 + line * 21}%`, top: "22%", transform: line === 0 ? "rotate(25deg)" : line === 2 ? "rotate(-25deg)" : undefined }} />)}
      {actors.map((actor) => <img key={actor.id} src={assetBase ? `${assetBase}/${actor.kind === "gem" ? "gem" : "hazard"}.png` : ""} alt="" className="absolute z-30 rounded-full object-contain drop-shadow-[0_8px_8px_rgba(0,0,0,.55)]" style={actorStyle(actor)} />)}
      <img src={assetBase ? `${assetBase}/player.png` : ""} alt="探宝者" className="absolute bottom-[9%] z-40 h-24 w-24 object-contain drop-shadow-[0_14px_9px_rgba(0,0,0,.65)] transition-[left] duration-150" style={{ left: `${25 + lane * 25}%`, transform: "translateX(-50%)" }} />
      <div className="absolute inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 bg-gradient-to-t from-black/55 to-transparent px-4 pb-4 pt-16 text-center">
        <strong className="text-amber-100">{status}</strong><span className="text-xs text-white/75">进度 {Math.min(100, Math.round(score / target * 100))}%</span>
        {ended && !previewMode ? <button type="button" onClick={reset} className="rounded-full bg-amber-300 px-5 py-2 font-bold text-stone-950">再来一局</button> : null}
      </div>
    </section>
  );
}
