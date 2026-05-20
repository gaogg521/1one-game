"use client";

import type { GameSpec } from "@/lib/game-spec";
import type { RuntimeReferencePayload } from "@/game/engine/runtime-reference-payload";
import type { ReferenceImageHandle } from "@/lib/assets/reference-image-storage.types";
import { GodotBuildActions } from "@/components/GodotBuildActions";

type Props = {
  spec: GameSpec;
  projectId?: string;
  referencePayloads?: RuntimeReferencePayload[];
  referenceHandles?: ReferenceImageHandle[];
  /** 仅在线试玩就绪后展示导出区（先玩再导） */
  onlineReady: boolean;
};

/**
 * 离线下载：默认折叠，且仅在 Godot Web 在线版可玩后出现。
 */
export function GodotOfflineDownloads({
  spec,
  projectId,
  referencePayloads,
  referenceHandles,
  onlineReady,
}: Props) {
  if (!onlineReady) return null;

  return (
    <details className="rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium text-[var(--gc-text-soft)]">
        玩法满意？导出离线包（Windows / 工程 / Android）
      </summary>
      <p className="mt-2 text-[11px] leading-relaxed text-[var(--gc-muted)]">
        在线试玩无需下载。只有想装到 PC、用 Godot 编辑器改、或打手机包时再点下面按钮。
      </p>
      <div className="mt-3">
        <GodotBuildActions
          spec={spec}
          projectId={projectId}
          referencePayloads={referencePayloads}
          referenceHandles={referenceHandles}
        />
      </div>
    </details>
  );
}
