"use client";

import { useCallback, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { GameSpec } from "@/lib/game-spec";
import { buildGodotExportRequestPayload } from "@/lib/godot-export-request.client";
import type { RuntimeReferencePayload } from "@/game/engine/runtime-reference-payload";
import type { ReferenceImageHandle } from "@/lib/assets/reference-image-storage.types";
import type { AppLocale } from "@/i18n/routing";
import { mergeLocaleHeaders } from "@/lib/i18n/client-headers";
import { resolveClientApiError } from "@/lib/i18n/resolve-client-api-error";

type Target = "windows" | "project" | "android";

type Props = {
  spec: GameSpec;
  projectId?: string;
  referencePayloads?: RuntimeReferencePayload[];
  referenceHandles?: ReferenceImageHandle[];
};

type RowState = "idle" | "loading" | "ready" | "error";

export function GodotBuildActions({ spec, projectId, referencePayloads, referenceHandles }: Props) {
  const t = useTranslations("godotExport");
  const locale = useLocale() as AppLocale;
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
          headers: mergeLocaleHeaders(locale, { "Content-Type": "application/json" }),
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
          errorKey?: string;
          errorParams?: Record<string, string | number>;
        };
        if (!res.ok || !data.downloadUrl) {
          setRows((r) => ({
            ...r,
            [target]: { state: "error", error: resolveClientApiError(locale, data, "exportFailed") },
          }));
          return;
        }
        setRows((r) => ({ ...r, [target]: { state: "ready" } }));
        window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
      } catch {
        setRows((r) => ({
          ...r,
          [target]: { state: "error", error: t("networkError") },
        }));
      }
    },
    [locale, referenceHandles, referencePayloads, projectId, spec, t],
  );

  const btn =
    "rounded-full border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-3 py-1.5 text-xs font-medium text-[var(--gc-text-soft)] transition hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))] hover:text-[var(--gc-text)] disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("ariaLabel")}>
      <button
        type="button"
        data-testid="godot-download-windows"
        className={btn}
        disabled={rows.windows.state === "loading"}
        onClick={() => void run("windows")}
        title={t("windowsTitle")}
      >
        {rows.windows.state === "loading" ? t("windowsLoading") : t("windowsLabel")}
      </button>
      <button
        type="button"
        data-testid="godot-download-project"
        className={btn}
        disabled={rows.project.state === "loading"}
        onClick={() => void run("project")}
        title={t("projectTitle")}
      >
        {rows.project.state === "loading" ? t("projectLoading") : t("projectLabel")}
      </button>
      <button
        type="button"
        data-testid="godot-download-android"
        className={btn}
        disabled={rows.android.state === "loading"}
        onClick={() => void run("android")}
        title={t("androidTitle")}
      >
        {rows.android.state === "loading" ? t("androidLoading") : t("androidLabel")}
      </button>
      {(["windows", "project", "android"] as const).map((target) =>
        rows[target].state === "error" ? (
          <span key={target} className="text-[11px] text-red-400">
            {rows[target].error}
          </span>
        ) : null,
      )}
    </div>
  );
}
