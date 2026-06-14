"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  creationEntryHref,
  getCreationModes,
  getStarterPrompts,
  type CreationMode,
} from "@/lib/product-ia";
import { decodeStartPrefillParam } from "@/lib/sample-create-prefill";
import { resolveStartIntake } from "@/lib/start-intake";
import type { AppLocale } from "@/i18n/routing";
import { withLocalePath } from "@/i18n/navigation";

export function CreationLauncher() {
  const router = useRouter();
  const locale = useLocale() as AppLocale;
  const t = useTranslations();
  const ts = useTranslations("start");
  const [prompt, setPrompt] = useState("");
  const [picked, setPicked] = useState<CreationMode | null>(null);
  const creationModes = useMemo(() => getCreationModes(locale), [locale]);
  const starterPrompts = useMemo(() => getStarterPrompts(locale), [locale]);
  const prefillApplied = useRef(false);

  useEffect(() => {
    if (prefillApplied.current || typeof window === "undefined") return;
    const raw = new URLSearchParams(window.location.search).get("prefill")?.trim();
    if (!raw) return;
    prefillApplied.current = true;
    queueMicrotask(() => {
      setPrompt(decodeStartPrefillParam(raw));
      setPicked(null);
    });
  }, []);

  const intake = useMemo(() => resolveStartIntake(prompt), [prompt]);
  const suggested = intake.mode;
  const active = picked ?? suggested;

  function go(mode?: CreationMode) {
    const m = mode ?? active;
    const href = creationEntryHref(m, prompt, locale);
    router.push(withLocalePath(href, locale));
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--gc-text)] sm:text-3xl">
          {t("start.title")}
        </h1>
        <p className="mt-2 text-sm text-[var(--gc-muted)]">
          {t("start.desc")}
        </p>
      </div>

      <div className="rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-5 sm:p-6">
        <label htmlFor="start-prompt" className="text-xs font-medium text-[var(--gc-muted)]">
          {t("start.inspiration")}
        </label>
        <textarea
          id="start-prompt"
          data-testid="start-prompt-input"
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            setPicked(null);
          }}
          rows={4}
          placeholder={t("start.placeholder")}
          className="mt-2 w-full resize-y rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-4 py-3 text-sm text-[var(--gc-text)] outline-none placeholder:text-[var(--gc-text-faint)] focus:border-[color:color-mix(in_srgb,var(--gc-accent)_45%,transparent)]"
        />

        {intake.hint?.kind === "sample_parity" ? (
          <div
            className="mt-3 rounded-xl border border-[color:color-mix(in_srgb,var(--gc-accent)_28%,var(--gc-border))] bg-[color:color-mix(in_srgb,var(--gc-accent)_8%,transparent)] px-3 py-2.5 text-xs leading-relaxed text-[var(--gc-muted)]"
            data-testid="start-sample-parity-hint"
          >
            <p className="font-medium text-[color:color-mix(in_srgb,var(--gc-accent)_92%,white)]">
              {ts("sampleMatchTitle", { sample: intake.hint.sampleTitle })}
            </p>
            <p className="mt-1">{ts("sampleMatchBody")}</p>
            <Link
              href={withLocalePath(intake.hint.samplePlayPath, locale)}
              className="mt-2 inline-flex text-[11px] font-medium text-[color:color-mix(in_srgb,var(--gc-accent)_90%,white)] hover:underline"
            >
              {ts("compareSample")}
            </Link>
          </div>
        ) : null}

        <p className="mt-3 text-[11px] text-[var(--gc-text-faint)]">{t("start.tryThese")}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {starterPrompts.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setPrompt(s);
                setPicked(null);
              }}
              className="rounded-full border border-[color:var(--gc-border)] px-3 py-1 text-[11px] text-[var(--gc-muted)] transition hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))] hover:text-[var(--gc-text)]"
            >
              {s.length > 28 ? `${s.slice(0, 28)}…` : s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-3 text-xs font-medium text-[var(--gc-muted)]" data-testid="start-mode-recommendation">
          {t("start.recommendedMode")}
          <span className="ml-2 text-[var(--gc-text-faint)]">{t("start.switchable")}</span>
          {prompt.trim() ? (
            <span className="ml-2 text-[color:color-mix(in_srgb,var(--gc-accent)_85%,white)]">
              → {creationModes[suggested].label}
            </span>
          ) : null}
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {(["game", "novel", "comic"] as const).map((mode) => {
            const m = creationModes[mode];
            const selected = active === mode;
            const isSuggested = suggested === mode && picked === null;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setPicked(mode)}
                className={`rounded-xl border p-4 text-left transition ${
                  selected
                    ? "border-[color:color-mix(in_srgb,var(--gc-accent)_50%,transparent)] bg-[color:color-mix(in_srgb,var(--gc-accent)_14%,transparent)]"
                    : "border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] hover:border-[color:color-mix(in_srgb,var(--gc-accent)_25%,var(--gc-border))]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[var(--gc-text)]">{m.label}</span>
                  {isSuggested ? (
                    <span className="rounded-full bg-[color:color-mix(in_srgb,var(--gc-accent)_20%,transparent)] px-2 py-0.5 text-[10px] text-[color:color-mix(in_srgb,var(--gc-accent)_90%,white)]">
                      {t("start.recommended")}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[var(--gc-muted)]">{m.tagline}</p>
                <p className="mt-2 text-[10px] text-[var(--gc-text-faint)]">{m.eta}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={() => go()}
          disabled={!prompt.trim()}
          className="gc-theme-cta rounded-full px-8 py-3 text-sm font-semibold disabled:opacity-40"
          data-testid="start-create-cta"
        >
          {t("start.createWithMode", { mode: creationModes[active].label })}
        </button>
        <Link
          href={withLocalePath("/samples", locale)}
          className="rounded-full px-6 py-3 text-sm font-medium text-[var(--gc-muted)] hover:text-[var(--gc-text)]"
        >
          {t("start.viewSamples")}
        </Link>
      </div>

      <div className="rounded-2xl border border-dashed border-[color:var(--gc-border)] bg-[color:color-mix(in_srgb,var(--gc-bg-elevated)_40%,transparent)] p-4 sm:p-5">
        <p className="text-center text-xs font-medium text-[var(--gc-text-soft)]">{t("start.browseCommunityTitle")}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Link
            href={withLocalePath("/discover", locale)}
            className="rounded-full border border-[color:var(--gc-border)] px-3 py-1.5 text-xs text-[var(--gc-muted)] hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))] hover:text-[var(--gc-text)]"
          >
            {t("nav.gameDiscover")}
          </Link>
          <Link
            href={withLocalePath("/novel/discover", locale)}
            className="rounded-full border border-[color:var(--gc-border)] px-3 py-1.5 text-xs text-[var(--gc-muted)] hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))] hover:text-[var(--gc-text)]"
          >
            {t("nav.novelDiscover")}
          </Link>
          <Link
            href={withLocalePath("/comic/discover", locale)}
            className="rounded-full border border-[color:var(--gc-border)] px-3 py-1.5 text-xs text-[var(--gc-muted)] hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))] hover:text-[var(--gc-text)]"
          >
            {t("nav.comicDiscover")}
          </Link>
          <Link
            href={withLocalePath("/studio", locale)}
            className="rounded-full border border-[color:var(--gc-border)] px-3 py-1.5 text-xs text-[var(--gc-muted)] hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))] hover:text-[var(--gc-text)]"
          >
            {t("nav.studio")}
          </Link>
        </div>
      </div>
    </div>
  );
}
