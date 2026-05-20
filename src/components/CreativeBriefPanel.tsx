"use client";

import { useEffect, useState } from "react";
import type { BriefUserRevision } from "@/lib/creative-brief/format-revision";
import type { BriefMedium, CreativeBrief } from "@/lib/creative-brief/types";

const MEDIUM_COPY: Record<
  BriefMedium,
  { hints: string; unitSection: string; templateLine: boolean; addonPlaceholder: string }
> = {
  game: {
    hints: "玩法落地",
    unitSection: "单位",
    templateLine: true,
    addonPlaceholder: "例如：更偏弹幕射击、Boss 要更大、色调再冷一点…",
  },
  novel: {
    hints: "叙事结构",
    unitSection: "角色",
    templateLine: false,
    addonPlaceholder: "例如：第三人称、感情线更重、结局偏开放式…",
  },
  comic: {
    hints: "分镜节奏",
    unitSection: "角色造型",
    templateLine: false,
    addonPlaceholder: "例如：电影感分镜、对白少一点、每页一个大转折…",
  },
};

type Props = {
  brief: CreativeBrief | null;
  summary?: string | null;
  medium?: BriefMedium;
  className?: string;
  onRevisionChange?: (rev: BriefUserRevision | null) => void;
  onRegenerateWithRevision?: () => void;
  regenerateDisabled?: boolean;
};

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-[var(--gc-text-faint)]">
        {title}
      </p>
      <ul className="space-y-0.5 text-xs leading-relaxed text-[var(--gc-muted)]">
        {items.map((line) => (
          <li key={`${title}-${line.slice(0, 24)}`}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

/** 创作台：展示 / 修订 AI 对一句话创意的深度扩写（Creative Brief） */
export function CreativeBriefPanel({
  brief,
  summary,
  medium = "game",
  className = "",
  onRevisionChange,
  onRegenerateWithRevision,
  regenerateDisabled,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [logline, setLogline] = useState("");
  const [world, setWorld] = useState("");
  const [addonNotes, setAddonNotes] = useState("");

  useEffect(() => {
    if (!brief) return;
    setLogline(brief.logline);
    setWorld(brief.world);
  }, [brief]);

  if (!brief && !summary) return null;

  const copy = MEDIUM_COPY[medium];

  const applyRevision = () => {
    const rev: BriefUserRevision = {
      logline: logline.trim() || undefined,
      world: world.trim() || undefined,
      addonNotes: addonNotes.trim() || undefined,
    };
    const hasAny = Boolean(rev.logline || rev.world || rev.addonNotes);
    onRevisionChange?.(hasAny ? rev : null);
    setEditing(false);
  };

  return (
    <details
      className={`rounded-xl border border-[color:color-mix(in_srgb,var(--gc-accent)_18%,var(--gc-border))] bg-[color:color-mix(in_srgb,var(--gc-surface-glass)_88%,transparent)] px-4 py-3 backdrop-blur-sm ${className}`}
      open={Boolean(brief)}
    >
      <summary className="cursor-pointer list-none text-sm font-medium text-[var(--gc-text-soft)] outline-none [&::-webkit-details-marker]:hidden">
        AI 深度理解（可展开 / 可修订）
        {brief ? (
          <span className="ml-2 text-[10px] font-normal text-[var(--gc-text-faint)]">
            {brief.packLabel} · {brief.expandSource === "pack" ? "知识包" : "知识包+模型"}
          </span>
        ) : null}
      </summary>
      <div className="mt-3 space-y-3 border-t border-[color:var(--gc-border)] pt-3">
        {summary ? (
          <p className="text-xs leading-relaxed text-[var(--gc-text-soft)]">{summary}</p>
        ) : null}
        {brief ? (
          <>
            <p className="text-xs text-[var(--gc-muted)]">
              <span className="text-[var(--gc-text-faint)]">原话：</span>
              {brief.userPrompt}
            </p>

            {editing ? (
              <div className="space-y-2 rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)]/40 p-3">
                <label className="block text-[10px] font-medium text-[var(--gc-muted)]">Logline</label>
                <textarea
                  value={logline}
                  onChange={(e) => setLogline(e.target.value)}
                  rows={2}
                  className="w-full resize-y rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-bg)] px-2 py-1.5 text-xs text-[var(--gc-text)]"
                />
                <label className="block text-[10px] font-medium text-[var(--gc-muted)]">世界观</label>
                <textarea
                  value={world}
                  onChange={(e) => setWorld(e.target.value)}
                  rows={2}
                  className="w-full resize-y rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-bg)] px-2 py-1.5 text-xs text-[var(--gc-text)]"
                />
                <label className="block text-[10px] font-medium text-[var(--gc-muted)]">补充说明（可选）</label>
                <textarea
                  value={addonNotes}
                  onChange={(e) => setAddonNotes(e.target.value)}
                  rows={2}
                  placeholder={copy.addonPlaceholder}
                  className="w-full resize-y rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-bg)] px-2 py-1.5 text-xs text-[var(--gc-text)] placeholder:text-[var(--gc-text-faint)]"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={applyRevision}
                    className="rounded-lg bg-[color:color-mix(in_srgb,var(--gc-accent)_25%,transparent)] px-3 py-1.5 text-xs font-medium text-[var(--gc-text)] hover:brightness-110"
                  >
                    保存修订
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="rounded-lg border border-[color:var(--gc-border)] px-3 py-1.5 text-xs text-[var(--gc-muted)]"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs font-medium text-[var(--gc-text)]">{logline || brief.logline}</p>
                <Section title="世界观" items={[world || brief.world]} />
                <Section title="场景" items={brief.scenes} />
                <Section title="势力" items={brief.factions} />
                <Section title={copy.unitSection} items={brief.units} />
                <Section title="武器与特效" items={[...brief.weapons, ...brief.vfx]} />
                <Section title="画风" items={brief.artStyle} />
                <Section title="氛围" items={brief.mood} />
                <Section title={copy.hints} items={brief.gameplayHints} />
                <Section title="负面约束" items={brief.negatives} />
                {copy.templateLine ? (
                  <p className="text-[10px] text-[var(--gc-text-faint)]">
                    倾向模板：<code className="text-[var(--gc-muted)]">{brief.intent.templateHint}</code> · 调性{" "}
                    {brief.intent.tone} · 难度 {brief.intent.difficulty}
                  </p>
                ) : (
                  <p className="text-[10px] text-[var(--gc-text-faint)]">
                    调性 {brief.intent.tone} · 节奏 {brief.intent.difficulty}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="text-xs font-medium text-[color:color-mix(in_srgb,var(--gc-accent)_90%,white)] underline-offset-2 hover:underline"
                  >
                    修订扩写理解
                  </button>
                  {onRegenerateWithRevision ? (
                    <button
                      type="button"
                      disabled={regenerateDisabled}
                      onClick={() => onRegenerateWithRevision()}
                      className="text-xs font-medium text-[var(--gc-muted)] underline-offset-2 hover:text-[var(--gc-text)] hover:underline disabled:opacity-40"
                    >
                      按当前理解重新生成
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </>
        ) : null}
      </div>
    </details>
  );
}
