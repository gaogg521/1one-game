"use client";

import dynamic from "next/dynamic";
import type { GameSpec } from "@/lib/game-spec";

const GamePlayerInner = dynamic(() => import("@/components/GamePlayerInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[560px] w-full items-center justify-center rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)] text-sm text-[var(--gc-muted)]">
      正在加载引擎…
    </div>
  ),
});

export function GamePlayer(props: {
  spec: GameSpec;
  coverCapture?: { projectId: string } | null;
  projectId?: string;
}) {
  return <GamePlayerInner {...props} />;
}
