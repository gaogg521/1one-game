"use client";

import { useCallback, useState } from "react";
import type { GameSpec } from "@/lib/game-spec";
import { buildGodotExportRequestPayload } from "@/lib/godot-export-request.client";
import type { RuntimeReferencePayload } from "@/game/engine/runtime-reference-payload";
import type { ReferenceImageHandle } from "@/lib/assets/reference-image-storage.types";

type Target = "windows" | "project" | "android";

type Props = {
  spec: GameSpec;
  projectId?: string;
  referencePayloads?: RuntimeReferencePayload[];
  referenceHandles?: ReferenceImageHandle[];
};

type RowState = "idle" | "loading" | "ready" | "error";

export function GodotBuildActions({ spec, projectId, referencePayloads, referenceHandles }: Props) {
  const [rows, setRows] = useState<Record<Target, { state: RowState; error?: string }>>({
    windows: { state: "idle" },
    project: { state: "idle" },
    android: { state: "idle" },
  });

  const run = useCallback(
    async (target: Target) => {
      setRows((r) => ({ ...r, [target]: { state: "loading" } }));
      try {
        const res = await fetch("/api/godot/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            buildGodotExportRequestPayload({
              spec,
              projectId,
              referencePayloads,
              referenceHandles,
              target,
            }),
          ),
        });
        const data = (await res.json()) as {
          downloadUrl?: string;
          error?: string;
        };
        if (!res.ok || !data.downloadUrl) {
          setRows((r) => ({
            ...r,
            [target]: { state: "error", error: data.error ?? "导出失败" },
          }));
          return;
        }
        setRows((r) => ({ ...r, [target]: { state: "ready" } }));
        window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
      } catch {
        setRows((r) => ({
          ...r,
          [target]: { state: "error", error: "网络异常" },
        }));
      }
    },
    [spec, projectId, referencePayloads, referenceHandles],
  );

  const btn =
    "rounded-full border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-3 py-1.5 text-xs font-medium text-[var(--gc-text-soft)] transition hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))] hover:text-[var(--gc-text)] disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Godot 离线下载（可选）">
      <button
        type="button"
        data-testid="godot-download-windows"
        className={btn}
        disabled={rows.windows.state === "loading"}
        onClick={() => void run("windows")}
        title="在本机 Windows 上由服务端打出 exe 压缩包（需已 npm run godot:install）"
      >
        {rows.windows.state === "loading" ? "正在打包 Windows…" : "下载 Windows 版"}
      </button>
      <button
        type="button"
        data-testid="godot-download-project"
        className={btn}
        disabled={rows.project.state === "loading"}
        onClick={() => void run("project")}
        title="含 GameSpec 与参考图的 Godot 4 工程，可用编辑器打开继续改"
      >
        {rows.project.state === "loading" ? "正在打包工程…" : "下载 Godot 工程"}
      </button>
      <button
        type="button"
        data-testid="godot-download-android"
        className={btn}
        disabled={rows.android.state === "loading"}
        onClick={() => void run("android")}
        title="需本机 Android SDK；未配置时会提示改用工程在编辑器内导出"
      >
        {rows.android.state === "loading" ? "正在导出 Android…" : "Android APK"}
      </button>
      {(["windows", "project", "android"] as const).map((t) =>
        rows[t].state === "error" ? (
          <span key={t} className="text-[11px] text-red-400">
            {rows[t].error}
          </span>
        ) : null,
      )}
    </div>
  );
}
