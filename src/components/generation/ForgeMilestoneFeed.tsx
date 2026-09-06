"use client";

import Image from "next/image";
import { useMemo } from "react";
import type { ProgressMilestone } from "@/lib/creator-core/progress-milestones";

/**
 * Live feed of what the build has actually produced.
 *
 * A build takes minutes because each reasoning-model call takes 40-170s and
 * the pipeline makes several. That wait cannot be compressed away, but it does
 * not have to be spent staring at a percentage: the design document exists
 * after ~40s, and modules and artwork land one at a time after that. Showing
 * each as it arrives turns dead waiting into watching the thing get made.
 */

type Props = {
  milestones: ProgressMilestone[];
  /** Elapsed time so far, for the header. */
  elapsedMs?: number;
  className?: string;
};

const KIND_META: Record<ProgressMilestone["kind"], { icon: string; tone: string; label: string }> = {
  design: { icon: "◈", tone: "var(--gc-accent)", label: "设计" },
  module: { icon: "◆", tone: "#7dd3fc", label: "代码" },
  art: { icon: "▣", tone: "#fbbf24", label: "美术" },
  qa: { icon: "✓", tone: "#a3e635", label: "检查" },
  repair: { icon: "↻", tone: "#fb923c", label: "修复" },
  ready: { icon: "★", tone: "#4ade80", label: "完成" },
};

function formatElapsed(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s`;
}

/** The design document is the first substantial thing a creator can read. */
function DesignCard({ data }: { data: Record<string, unknown> }) {
  const title = typeof data.title === "string" ? data.title : null;
  const pitch = typeof data.pitch === "string" ? data.pitch : null;
  const mechanics = Array.isArray(data.mechanics) ? (data.mechanics as unknown[]).filter((m): m is string => typeof m === "string") : [];
  const controls = Array.isArray(data.controls) ? (data.controls as unknown[]).filter((c): c is string => typeof c === "string") : [];
  const win = typeof data.winCondition === "string" ? data.winCondition : null;

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-[var(--gc-border)] bg-[var(--gc-bg-elevated)] p-3">
      {title ? <p className="text-sm font-semibold text-[var(--gc-text)]">{title}</p> : null}
      {pitch ? <p className="text-xs leading-5 text-[var(--gc-text-soft)]">{pitch}</p> : null}
      {mechanics.length ? (
        <ul className="space-y-1">
          {mechanics.slice(0, 5).map((m, i) => (
            <li key={i} className="text-xs leading-5 text-[var(--gc-muted)]">
              · {m}
            </li>
          ))}
        </ul>
      ) : null}
      {win ? <p className="text-xs text-[var(--gc-muted)]">胜利条件：{win}</p> : null}
      {controls.length ? <p className="text-xs text-[var(--gc-muted)]">操作：{controls.join("、")}</p> : null}
    </div>
  );
}

export function ForgeMilestoneFeed({ milestones, elapsedMs, className }: Props) {
  // Newest first: the thing that just happened is what a waiting creator looks at.
  const ordered = useMemo(() => [...milestones].sort((a, b) => b.atMs - a.atMs), [milestones]);
  const artShots = useMemo(
    () => milestones.filter((m) => m.kind === "art" && m.imageUrl).slice(0, 8),
    [milestones],
  );

  if (!milestones.length) return null;

  return (
    <section className={className}>
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-[var(--gc-text)]">制作过程</h3>
        {typeof elapsedMs === "number" ? (
          <span className="text-xs tabular-nums text-[var(--gc-muted)]">已用 {formatElapsed(elapsedMs)}</span>
        ) : null}
      </header>

      {artShots.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {artShots.map((shot) => (
            <figure
              key={shot.imageUrl}
              className="w-20 overflow-hidden rounded-lg border border-[var(--gc-border)] bg-[var(--gc-bg-elevated)]"
            >
              <Image
                src={shot.imageUrl!}
                alt={typeof shot.data?.key === "string" ? shot.data.key : "生成的素材"}
                width={80}
                height={80}
                className="h-20 w-20 object-contain"
                unoptimized
              />
            </figure>
          ))}
        </div>
      ) : null}

      <ol className="mt-3 space-y-2">
        {ordered.map((m, index) => {
          const meta = KIND_META[m.kind];
          return (
            <li key={`${m.kind}-${m.atMs}-${index}`} className="flex gap-2.5">
              <span aria-hidden className="mt-0.5 text-sm leading-5" style={{ color: meta.tone }}>
                {meta.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline gap-2 text-xs">
                  <span className="font-medium text-[var(--gc-text-soft)]">{m.label}</span>
                  <span className="shrink-0 tabular-nums text-[10px] text-[var(--gc-muted)]">+{formatElapsed(m.atMs)}</span>
                </p>
                {m.kind === "design" && m.data ? <DesignCard data={m.data} /> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
