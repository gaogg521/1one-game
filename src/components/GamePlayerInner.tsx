"use client";

import type { GameSpec } from "@/lib/game-spec";
import { IndependentGameRuntime } from "@/components/IndependentGameRuntime";

type GamePlayerInnerProps = {
  spec: GameSpec;
  projectId?: string;
  onEnd?: (result: { won: boolean; score: number }) => void;
  coverCapture?: { projectId: string } | null;
  creativeRevisionId?: string;
  promptHint?: string;
  immersive?: boolean;
  previewMode?: boolean;
  arcadeMode?: boolean;
  onIterate?: (instruction: string) => void;
};

/** The only player surface: a model-generated, isolated independent runtime. */
export default function GamePlayerInner({ spec, projectId, onEnd }: GamePlayerInnerProps) {
  return <IndependentGameRuntime spec={spec} projectId={projectId} onEnd={onEnd} />;
}
