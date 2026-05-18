"use client";

import type { ReactNode } from "react";
import type { NovelReaderPalette } from "@/lib/novel-reader-theme";
import type { useNovelListen } from "@/hooks/use-novel-listen";

type ListenApi = ReturnType<typeof useNovelListen>;

export function NovelListenBar({ listen, palette }: { listen: ListenApi; palette: NovelReaderPalette }) {
  if (!listen.supported) {
    return (
      <p className="mx-auto max-w-[42rem] px-5 pb-6 text-center text-xs" style={{ color: palette.muted }}>
        听书不可用：请配置火山引擎 TTS（.env）或使用支持朗读的浏览器。
      </p>
    );
  }

  const {
    state,
    currentChapter,
    rateLabel,
    providerLabel,
    voiceOptions,
    selectedVoiceId,
    setVolcVoice,
    setBrowserVoice,
    provider,
    statusMessage,
    error,
    toggle,
    stop,
    prevChapter,
    nextChapter,
    cycleRate,
    canPrev,
    canNext,
  } = listen;

  const playing = state === "playing";
  const loading = state === "loading";
  const active = state !== "idle";
  const chapterLabel =
    currentChapter ?
      `第${currentChapter.num}章 ${currentChapter.title}`
    : "听书";

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-4 pt-2 sm:px-6"
      aria-live="polite"
    >
      <div
        className="pointer-events-auto flex w-full max-w-lg flex-col gap-2 rounded-2xl border px-3 py-2.5 shadow-lg backdrop-blur-md sm:px-4"
        style={{
          borderColor: palette.border,
          backgroundColor: `color-mix(in srgb, ${palette.panel} 92%, transparent)`,
          color: palette.text,
        }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-xs font-medium" style={{ color: palette.text }}>
            {loading ?
              statusMessage || "正在合成语音…"
            : active ?
              playing ?
                "朗读中"
              : "已暂停"
            : "听书"}{" "}
            · {chapterLabel}
            {providerLabel ? ` · ${providerLabel}` : ""}
          </p>
          {voiceOptions.length > 1 ?
            <label className="flex shrink-0 items-center">
              <span className="sr-only">朗读音色</span>
              <select
                value={selectedVoiceId}
                onChange={(e) => {
                  const id = e.target.value;
                  if (provider === "volc") setVolcVoice(id);
                  else setBrowserVoice(id);
                }}
                disabled={loading}
                className="max-w-[7.5rem] truncate rounded-md px-1.5 py-1 text-xs font-medium outline-none sm:max-w-[9rem]"
                style={{
                  border: `1px solid ${palette.border}`,
                  color: palette.text,
                  backgroundColor: `color-mix(in srgb, ${palette.panel} 80%, transparent)`,
                }}
                title="选择朗读音色"
              >
                {voiceOptions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
          : null}
          <button
            type="button"
            onClick={cycleRate}
            className="shrink-0 rounded-md px-2 py-1 text-xs font-medium"
            style={{
              border: `1px solid ${palette.border}`,
              color: palette.muted,
            }}
            title="切换语速"
          >
            {rateLabel}
          </button>
        </div>

        <div className="flex items-center justify-center gap-2">
          <IconButton
            label="上一章"
            disabled={!canPrev}
            onClick={prevChapter}
            palette={palette}
          >
            ‹
          </IconButton>

          <button
            type="button"
            onClick={toggle}
            disabled={loading}
            className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-white shadow-md transition hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: palette.tocActive }}
            aria-label={playing ? "暂停朗读" : state === "paused" ? "继续朗读" : "开始朗读"}
          >
            {loading ? "…" : playing ? "❚❚" : "▶"}
          </button>

          <IconButton label="下一章" disabled={!canNext} onClick={nextChapter} palette={palette}>
            ›
          </IconButton>

          {active ?
            <button
              type="button"
              onClick={stop}
              className="ml-1 rounded-lg px-3 py-2 text-xs font-medium"
              style={{ color: palette.muted, border: `1px solid ${palette.border}` }}
            >
              停止
            </button>
          : null}
        </div>
        {error ?
          <p className="text-center text-xs text-red-400">{error}</p>
        : null}
      </div>
    </div>
  );
}

function IconButton({
  children,
  label,
  disabled,
  onClick,
  palette,
}: {
  children: ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
  palette: NovelReaderPalette;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-lg font-medium transition disabled:opacity-35"
      style={{
        border: `1px solid ${palette.border}`,
        color: palette.text,
      }}
    >
      {children}
    </button>
  );
}
