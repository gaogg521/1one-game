"use client";

import { useEffect, useRef, useState } from "react";
import type { GameSpec } from "@/lib/game-spec";
import {
  VoxelSandboxRuntime,
  type VoxelBlock,
  type VoxelRuntimeState,
} from "@/game/voxel/VoxelSandboxRuntime";

const INITIAL: VoxelRuntimeState = {
  health: 10,
  hunger: 10,
  crystals: 0,
  placed: 0,
  defeated: 0,
  selected: "dirt",
  inventory: { grass: 0, dirt: 8, stone: 0, wood: 0, leaves: 0, crystal: 0 },
  worldTime: 0.22,
  position: [0, 0, 0],
  locked: false,
  message: "正在生成体素世界…",
  completed: false,
};

const HOTBAR: Array<{ type: VoxelBlock; icon: string; label: string }> = [
  { type: "dirt", icon: "🟫", label: "土块" },
  { type: "stone", icon: "⬜", label: "石块" },
  { type: "wood", icon: "🪵", label: "木材" },
  { type: "grass", icon: "🟩", label: "草方块" },
  { type: "leaves", icon: "🌿", label: "树叶" },
];

export function VoxelSandboxPlayer({
  spec,
  projectId,
  onEnd,
}: {
  spec: GameSpec;
  projectId?: string;
  onEnd?: (result: { won: boolean; score: number }) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<VoxelSandboxRuntime | null>(null);
  const dragRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const [state, setState] = useState(INITIAL);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const runtime = new VoxelSandboxRuntime(canvas, projectId ?? spec.title, setState, (result) => onEnd?.(result));
    runtimeRef.current = runtime;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) runtime.resize(box.width, box.height);
    });
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      runtime.dispose();
      runtimeRef.current = null;
    };
  }, [projectId, spec.title, onEnd]);

  const mission = [
    { label: "采集晶体", value: state.crystals, target: 3 },
    { label: "建造方块", value: state.placed, target: 4 },
    { label: "击退暗影", value: state.defeated, target: 3 },
  ];
  const completed = mission.reduce((sum, item) => sum + Math.min(item.value, item.target), 0);
  const daylight = Math.max(0, Math.sin(state.worldTime * Math.PI * 2));

  const setMove = (x: number, z: number) => runtimeRef.current?.setMobileMove(x, z);
  const stopMove = () => setMove(0, 0);

  return (
    <div className="relative h-[min(78vh,760px)] min-h-[560px] w-full overflow-hidden bg-slate-950 text-white sm:rounded-2xl" data-testid="voxel-sandbox-runtime" onPointerDownCapture={() => setStarted(true)}>
      <canvas
        ref={canvasRef}
        className="h-full w-full touch-none outline-none"
        tabIndex={0}
        aria-label={`${spec.title} 3D voxel game`}
        onPointerDown={(event) => {
          if (event.pointerType === "touch") {
            dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
            event.currentTarget.setPointerCapture(event.pointerId);
          }
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.id !== event.pointerId) return;
          runtimeRef.current?.rotate(event.clientX - drag.x, event.clientY - drag.y);
          drag.x = event.clientX;
          drag.y = event.clientY;
        }}
        onPointerUp={(event) => {
          if (dragRef.current?.id === event.pointerId) dragRef.current = null;
        }}
      />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(2,6,23,.24)_100%)]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2">
        <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/90" />
        <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/90" />
      </div>

      <div className="pointer-events-none absolute left-3 top-3 w-[min(20rem,calc(100%-6rem))] rounded-2xl border border-white/15 bg-slate-950/78 p-3 shadow-2xl backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300">Voxel Frontier</p>
            <h2 className="mt-0.5 text-base font-bold text-white">{spec.title}</h2>
          </div>
          <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-2 py-1 text-[10px] text-cyan-100">独立 3D 运行时</span>
        </div>
        <div className="mt-3 flex gap-1" aria-label="health">
          {Array.from({ length: 10 }, (_, i) => <span key={i} className={i < state.health ? "text-red-400" : "text-white/20"}>♥</span>)}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {mission.map((item) => (
            <div key={item.label} className="rounded-lg bg-white/7 px-2 py-1.5">
              <p className="text-[9px] text-white/55">{item.label}</p>
              <p className={item.value >= item.target ? "text-sm font-bold text-emerald-300" : "text-sm font-bold text-white"}>{Math.min(item.value, item.target)}/{item.target}</p>
            </div>
          ))}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all" style={{ width: `${(completed / 10) * 100}%` }} /></div>
      </div>

      <div className="pointer-events-none absolute right-3 top-3 flex flex-col items-end gap-2 text-[10px]">
        <div className="rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 backdrop-blur-md">
          <span>{daylight > 0.35 ? "☀️ 白昼" : "🌙 夜晚"}</span>
          <span className="ml-2 text-white/50">世界已保存</span>
        </div>
        <div className="rounded-lg bg-slate-950/65 px-2 py-1 font-mono text-white/65" data-testid="voxel-coordinates">X {state.position[0].toFixed(1)} · Y {state.position[1].toFixed(1)} · Z {state.position[2].toFixed(1)}</div>
        <div className="max-w-48 rounded-xl border border-amber-300/20 bg-amber-950/65 px-3 py-2 text-right text-amber-100 backdrop-blur-md">{state.message}</div>
      </div>

      {!state.locked && !started ? (
        <button
          type="button"
          className="absolute left-1/2 top-[58%] -translate-x-1/2 rounded-2xl border border-white/20 bg-slate-950/80 px-5 py-3 text-sm font-semibold shadow-2xl backdrop-blur-md hover:bg-slate-900/90"
          onClick={() => { setStarted(true); canvasRef.current?.click(); }}
        >
          点击进入世界<br /><span className="text-[10px] font-normal text-white/60">WASD 移动 · 鼠标观察 · 左键采掘 · 右键放置</span>
        </button>
      ) : null}

      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1 rounded-2xl border border-white/15 bg-slate-950/76 p-1.5 shadow-2xl backdrop-blur-md">
        {HOTBAR.map((item, index) => (
          <button
            type="button"
            key={item.type}
            aria-label={item.label}
            onClick={() => runtimeRef.current?.select(item.type)}
            className={`relative h-12 w-12 rounded-xl border text-lg transition ${state.selected === item.type ? "border-cyan-300 bg-cyan-300/20 shadow-[0_0_18px_rgba(34,211,238,.28)]" : "border-white/10 bg-white/5"}`}
          >
            {item.icon}<span className="absolute left-1 top-0.5 text-[8px] text-white/45">{index + 1}</span><span className="absolute bottom-0.5 right-1 text-[9px] font-bold">{state.inventory[item.type]}</span>
          </button>
        ))}
      </div>

      <div className="absolute bottom-20 left-3 grid grid-cols-3 gap-1 sm:hidden">
        <span />
        <button type="button" aria-label="前进" className="h-12 w-12 rounded-xl bg-slate-950/70 text-xl" onClick={() => runtimeRef.current?.nudge(0, -1)} onPointerDown={() => setMove(0, -1)} onPointerUp={stopMove} onPointerCancel={stopMove}>↑</button>
        <span />
        <button type="button" aria-label="左移" className="h-12 w-12 rounded-xl bg-slate-950/70 text-xl" onClick={() => runtimeRef.current?.nudge(-1, 0)} onPointerDown={() => setMove(-1, 0)} onPointerUp={stopMove} onPointerCancel={stopMove}>←</button>
        <button type="button" aria-label="后退" className="h-12 w-12 rounded-xl bg-slate-950/70 text-xl" onClick={() => runtimeRef.current?.nudge(0, 1)} onPointerDown={() => setMove(0, 1)} onPointerUp={stopMove} onPointerCancel={stopMove}>↓</button>
        <button type="button" aria-label="右移" className="h-12 w-12 rounded-xl bg-slate-950/70 text-xl" onClick={() => runtimeRef.current?.nudge(1, 0)} onPointerDown={() => setMove(1, 0)} onPointerUp={stopMove} onPointerCancel={stopMove}>→</button>
      </div>

      <div className="absolute bottom-20 right-3 grid grid-cols-2 gap-2 sm:hidden">
        <button type="button" onClick={() => runtimeRef.current?.mineAction()} className="h-12 rounded-xl border border-rose-300/30 bg-rose-950/75 px-3 text-xs font-bold">采掘</button>
        <button type="button" onClick={() => runtimeRef.current?.placeAction()} className="h-12 rounded-xl border border-blue-300/30 bg-blue-950/75 px-3 text-xs font-bold">放置</button>
        <button type="button" onClick={() => runtimeRef.current?.jump()} className="h-12 rounded-xl border border-amber-300/30 bg-amber-950/75 px-3 text-xs font-bold">跳跃</button>
        <button type="button" onClick={() => runtimeRef.current?.pulseAction()} className="h-12 rounded-xl border border-violet-300/30 bg-violet-950/75 px-3 text-xs font-bold">脉冲</button>
      </div>

      {state.completed ? <div className="pointer-events-none absolute inset-0 grid place-items-center bg-emerald-950/45"><div className="rounded-3xl border border-emerald-300/35 bg-slate-950/90 px-8 py-6 text-center shadow-2xl"><p className="text-3xl">🏆</p><p className="mt-2 text-xl font-black text-emerald-200">世界核心已点亮</p><p className="mt-1 text-xs text-white/60">采集、建造与战斗闭环完成</p></div></div> : null}
    </div>
  );
}
