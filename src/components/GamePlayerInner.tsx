"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { mergeLocaleHeaders } from "@/lib/i18n/client-headers";
import type { GameSpec } from "@/lib/game-spec";
import { captureCanvasAsJpegDataUrl } from "@/lib/capture-game-thumb";
import { readReferenceImagePayloadsFromSession } from "@/lib/assets/reference-image-payloads.client";
import { buildCohesivePresentation, describeCohesiveExperience } from "@/lib/cohesive-presentation";
import { createPhaserGame } from "@/game/engine/createPhaserGame";
import type Phaser from "phaser";
import { SAMPLES } from "@/lib/samples";

export default function GamePlayerInner({
  spec,
  coverCapture,
  projectId,
  promptHint,
}: {
  spec: GameSpec;
  coverCapture?: { projectId: string } | null;
  projectId?: string;
  promptHint?: string;
}) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("gamePlayer");
  const hostRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const bootAudioRef = useRef<(() => void) | null>(null);
  const pendingAudioBootRef = useRef(false);
  const coverSentRef = useRef(false);
  const [audioHint, setAudioHint] = useState(true);
  const [session, setSession] = useState(0);
  const [result, setResult] = useState<{ score: number; won: boolean } | null>(null);
  const [playReady, setPlayReady] = useState(false);

  const cohesive = useMemo(() => buildCohesivePresentation(spec), [spec]);
  const cohesiveSnapshot = useMemo(() => describeCohesiveExperience(cohesive), [cohesive]);
  const showCohesiveSnapshot = process.env.NODE_ENV !== "production";
  const resolvedPromptHint = useMemo(() => {
    const direct = promptHint?.trim();
    if (direct) return direct;
    const variantId = spec.samplePlayProfile?.variantId;
    if (variantId) {
      const samplePrompt = SAMPLES.find((s) => s.id === variantId)?.prompt?.trim();
      if (samplePrompt) return samplePrompt;
    }
    return [spec.labels.subtitle, spec.title].filter(Boolean).join(" · ");
  }, [promptHint, spec.labels.subtitle, spec.title, spec.samplePlayProfile?.variantId]);
  const shellStyle = useMemo(
    () =>
      ({
        ["--gc-accent"]: cohesive.chrome.accent,
        ["--gc-accent2"]: cohesive.chrome.accent2,
        ["--gc-cyan"]: cohesive.chrome.cyan,
        ["--gc-text"]: cohesive.chrome.text,
        ["--gc-muted"]: cohesive.chrome.muted,
        ["--gc-bg-elevated"]: cohesive.chrome.elevated,
        ["--gc-border"]: `rgba(${cohesive.chrome.borderRgb}, 0.22)`,
        ["--gc-text-soft"]: `color-mix(in srgb, ${cohesive.chrome.text} 82%, ${cohesive.chrome.muted})`,
        ["--gc-cta-a"]: cohesive.chrome.ctaA,
        ["--gc-cta-b"]: cohesive.chrome.ctaB,
        ["--gc-cta-c"]: cohesive.chrome.ctaC,
      }) as React.CSSProperties,
    [cohesive],
  );

  useEffect(() => {
    coverSentRef.current = false;
  }, [coverCapture?.projectId]);

  useEffect(() => {
    const pid = coverCapture?.projectId;
    if (!pid || coverSentRef.current) return;
    if (typeof sessionStorage !== "undefined") {
      const k = `cover-uploaded:${pid}`;
      if (sessionStorage.getItem(k)) {
        coverSentRef.current = true;
        return;
      }
    }

    const tryUpload = () => {
      if (coverSentRef.current) return;
      const host = hostRef.current;
      if (!host) return;
      const dataUrl = captureCanvasAsJpegDataUrl(host, 520, 0.7);
      if (!dataUrl) return;

      void (async () => {
        try {
          const res = await fetch(`/api/projects/${pid}`, {
            method: "PATCH",
            headers: mergeLocaleHeaders(locale, { "Content-Type": "application/json" }),
            body: JSON.stringify({ coverJpegBase64: dataUrl }),
          });
          if (res.ok) {
            coverSentRef.current = true;
            if (typeof sessionStorage !== "undefined") {
              sessionStorage.setItem(`cover-uploaded:${pid}`, "1");
            }
          }
        } catch {
          /* 静默失败，不影响试玩 */
        }
      })();
    };

    const t1 = window.setTimeout(tryUpload, 1600);
    const t2 = window.setTimeout(tryUpload, 4200);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [spec, session, coverCapture?.projectId, locale]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    setResult(null);
    const refPayloads = readReferenceImagePayloadsFromSession();
    const handle = createPhaserGame(el, spec, (r) => setResult(r), {
      referencePayloads: refPayloads,
      projectId: projectId ?? undefined,
      uiLocale: locale,
      promptHint: resolvedPromptHint,
    });
    gameRef.current = handle.game;
    bootAudioRef.current = handle.bootAudio;
    el.focus({ preventScroll: true });
    if (pendingAudioBootRef.current) {
      pendingAudioBootRef.current = false;
      handle.bootAudio();
      setAudioHint(false);
    }
    return () => {
      handle.game.destroy(true);
      gameRef.current = null;
      bootAudioRef.current = null;
    };
  }, [spec, session, locale, projectId, resolvedPromptHint]);

  /** 用户侧：避免引擎 bootstrap 前闪黑/半成品帧 */
  useEffect(() => {
    setPlayReady(false);
    const poll = window.setInterval(() => {
      if ((window as unknown as { __PHASER_PLAY_READY__?: boolean }).__PHASER_PLAY_READY__) {
        setPlayReady(true);
      }
    }, 80);
    const fallback = window.setTimeout(() => setPlayReady(true), 4500);
    return () => {
      window.clearInterval(poll);
      window.clearTimeout(fallback);
    };
  }, [spec, session, locale, projectId, resolvedPromptHint]);

  useEffect(() => {
    if (!playReady) return;
    hostRef.current?.focus({ preventScroll: true });
  }, [playReady, spec, session, locale, projectId, resolvedPromptHint]);

  useEffect(() => {
    if (!audioHint) return;
    const hide = () => setAudioHint(false);
    const el = hostRef.current;
    el?.addEventListener("pointerdown", hide, { once: true });
    window.addEventListener("keydown", hide, { once: true, capture: true });
    const t = window.setTimeout(() => setAudioHint(false), 8000);
    return () => {
      el?.removeEventListener("pointerdown", hide);
      window.removeEventListener("keydown", hide, true);
      window.clearTimeout(t);
    };
  }, [audioHint, session]);

  const armAudioBoot = useCallback(() => {
    pendingAudioBootRef.current = true;
    bootAudioRef.current?.();
    setAudioHint(false);
  }, []);

  const restart = useCallback(() => {
    armAudioBoot();
    setResult(null);
    setSession((s) => s + 1);
  }, [armAudioBoot]);

  const fullscreen = useCallback(() => {
    const node = shellRef.current;
    if (!node) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void node.requestFullscreen().catch(() => {});
    }
  }, []);

  return (
    <div className="space-y-4">
      <div
        ref={shellRef}
        style={shellStyle}
        className="group relative overflow-hidden rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)] shadow-[0_24px_80px_-24px_rgba(0,0,0,0.9)]"
      >
        {showCohesiveSnapshot ? (
          <div className="pointer-events-none absolute left-3 top-3 z-[6] flex max-w-[calc(100%-10rem)] flex-wrap items-center gap-2 rounded-full border border-[color:var(--gc-border)] bg-[color:color-mix(in_srgb,var(--gc-bg-elevated)_88%,#000)] px-3 py-1.5 text-[10px] text-[var(--gc-muted)] backdrop-blur-md">
            <span className="font-medium text-[var(--gc-text)]">{cohesiveSnapshot.label}</span>
            <span className="text-[var(--gc-muted)]">{cohesiveSnapshot.detail}</span>
            {cohesiveSnapshot.chips.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-[color:var(--gc-border)] bg-[color:color-mix(in_srgb,var(--gc-bg)_82%,#000)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--gc-text-soft)]"
              >
                {chip}
              </span>
            ))}
          </div>
        ) : null}
        <div
          ref={hostRef}
          tabIndex={0}
          role="application"
          aria-label={t("gameAria")}
          className="aspect-[920/560] w-full max-h-[min(70vh,620px)] bg-[color:color-mix(in_srgb,var(--gc-bg)_88%,#000)] outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--gc-accent)_55%,transparent)]"
        />
        {!playReady && !result ? (
          <div
            className="pointer-events-none absolute inset-0 z-[5] flex flex-col items-center justify-center gap-3 bg-[color:color-mix(in_srgb,var(--gc-bg-elevated)_92%,#000)] backdrop-blur-sm"
            aria-live="polite"
          >
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--gc-border)] border-t-[color:color-mix(in_srgb,var(--gc-accent)_80%,white)]" />
            <p className="text-xs text-[var(--gc-muted)]">{t("loading")}</p>
          </div>
        ) : null}
        {audioHint && !result ? (
          <p className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-[color:var(--gc-border)] bg-[color:color-mix(in_srgb,var(--gc-bg-elevated)_88%,#000)] px-3 py-1 text-[10px] text-[var(--gc-muted)] backdrop-blur-sm">
            {t("audioHint")}
          </p>
        ) : null}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-end gap-2 p-3">
          <button
            type="button"
            onClick={fullscreen}
            className="pointer-events-auto rounded-lg border border-[color:var(--gc-border)] bg-[color:color-mix(in_srgb,var(--gc-bg-elevated)_82%,#000)] px-3 py-1.5 text-xs font-medium text-[var(--gc-text-soft)] opacity-90 backdrop-blur-md transition hover:border-[color:color-mix(in_srgb,var(--gc-accent)_40%,transparent)] hover:text-[var(--gc-text)] md:opacity-0 md:transition-opacity md:group-hover:opacity-100"
          >
            {t("fullscreen")}
          </button>
          <button
            type="button"
            onClick={restart}
            className="pointer-events-auto rounded-lg border border-[color:var(--gc-border)] bg-[color:color-mix(in_srgb,var(--gc-bg-elevated)_82%,#000)] px-3 py-1.5 text-xs font-medium text-[var(--gc-text-soft)] opacity-90 backdrop-blur-md transition hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))] hover:text-[var(--gc-text)] md:opacity-0 md:transition-opacity md:group-hover:opacity-100"
          >
            {t("restart")}
          </button>
        </div>

        {result ? (
          <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-5 bg-black/70 px-6 text-center backdrop-blur-md">
            <div className="space-y-1">
              <p className="text-2xl font-semibold tracking-tight text-[var(--gc-text)]">
                {result.won ? t("victory") : t("gameOver")}
              </p>
              <p className="text-sm text-[var(--gc-muted)]">
                {t("score")}{" "}
                <span className="tabular-nums text-[var(--gc-text)]">{result.score}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={restart}
              className="gc-theme-cta rounded-full px-8 py-2.5 text-sm font-semibold shadow-lg"
            >
              {t("playAgain")}
            </button>
          </div>
        ) : null}
      </div>

      {result ? (
        <p className="text-center text-xs text-[var(--gc-muted)] md:hidden">{t("landscapeHint")}</p>
      ) : null}
    </div>
  );
}
