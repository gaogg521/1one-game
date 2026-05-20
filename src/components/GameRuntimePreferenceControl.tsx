"use client";

import { useEffect, useState } from "react";
import {
  GAME_RUNTIME_PREFERENCE_EVENT,
  getGameRuntimePreference,
  setGameRuntimePreference,
  type GameRuntimeChoice,
} from "@/lib/game-runtime-preference";
import { PRODUCT } from "@/lib/product-config";

/** 全局试玩引擎偏好（创作台 / 试玩页共用，localStorage） */
export function GameRuntimePreferenceControl({ className = "" }: { className?: string }) {
  const [choice, setChoice] = useState<GameRuntimeChoice>("phaser");

  useEffect(() => {
    setChoice(getGameRuntimePreference());
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<GameRuntimeChoice>).detail;
      if (detail === "phaser" || detail === "godot") setChoice(detail);
    };
    window.addEventListener(GAME_RUNTIME_PREFERENCE_EVENT, onChange);
    return () => window.removeEventListener(GAME_RUNTIME_PREFERENCE_EVENT, onChange);
  }, []);

  if (!PRODUCT.godot.enabled) return null;

  const pick = (id: GameRuntimeChoice) => {
    setGameRuntimePreference(id);
    setChoice(id);
  };

  const btn = (id: GameRuntimeChoice, label: string) => (
    <button
      type="button"
      onClick={() => pick(id)}
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        choice === id
          ? "bg-[color:color-mix(in_srgb,var(--gc-accent)_20%,transparent)] text-[var(--gc-text)]"
          : "text-[var(--gc-muted)] hover:text-[var(--gc-text)]"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-1 py-0.5 ${className}`}
      title="默认试玩引擎；试玩区可随时切换"
    >
      <span className="pl-2 text-[10px] uppercase tracking-wide text-[var(--gc-text-faint)]">引擎</span>
      {btn("godot", "Godot 在线")}
      {btn("phaser", "Phaser")}
    </div>
  );
}
