"use client";

import dynamic from "next/dynamic";
import type { GameSpec } from "@/lib/game-spec";
import { GamePlayerLoading } from "@/components/GamePlayerLoading";

const GamePlayerInner = dynamic(() => import("@/components/GamePlayerInner"), {
  ssr: false,
  loading: () => <GamePlayerLoading />,
});

export function GamePlayer(props: {
  spec: GameSpec;
  coverCapture?: { projectId: string } | null;
  projectId?: string;
  promptHint?: string;
  /** 样品馆试玩：隐藏 dev 叠层，更沉浸 */
  immersive?: boolean;
  /** 创作台预览模式：游戏结束自动重启，不显示结算画面 */
  previewMode?: boolean;
  /** 结算画面"继续调整"回调 */
  onIterate?: (instruction: string) => void;
}) {
  return <GamePlayerInner {...props} />;
}
