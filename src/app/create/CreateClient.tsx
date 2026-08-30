"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { GameSpec } from "@/lib/game-spec";
import { consumeSSE } from "@/lib/read-sse";
import { prepareGameSpecForPersist } from "@/lib/spec-patch";
import { GamePlayer } from "@/components/GamePlayer";
import { requiresBespokeRuntime } from "@/lib/game-runtime-policy";
import { AppMain, AppPageShell } from "@/components/AppPageShell";
import { SiteHeader } from "@/components/SiteHeader";
import { useQuotaExceededModal } from "@/components/commerce/QuotaExceededModal";
import { parseQuotaExceeded } from "@/lib/commerce/quota-error";
import { mergeLocaleHeaders } from "@/lib/i18n/client-headers";
import { resolveClientApiError } from "@/lib/i18n/resolve-client-api-error";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

type BuildStatus = { step: "idle" | "kernel" | "verify" | "ready"; message: string; lines: string[] };

const FALLBACK_EXAMPLES = [
  "设计一个开心消消乐游戏",
  "做一个单手操作的太空躲避游戏",
  "做一个种花、收获、升级的小农场",
];

/** A single public decision: describe the game, then play it. */
export default function CreateClient(props: { initialPrompt?: string; replayFromProjectId?: string }) {
  const router = useRouter();
  const locale = useLocale() as AppLocale;
  const t = useTranslations("createFlow");
  const { showQuotaExceeded, QuotaModal } = useQuotaExceededModal();
  const [prompt, setPrompt] = useState(() => props.initialPrompt?.slice(0, 4000) ?? "");
  const [spec, setSpec] = useState<GameSpec | null>(null);
  const [generationDebug, setGenerationDebug] = useState<{
    model?: string;
    provider?: string;
    fallback?: boolean;
    kernelFallback?: boolean;
    source?: string;
    templateHint?: string;
    scene?: string;
  } | null>(null);
  const [generationSource, setGenerationSource] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(props.replayFromProjectId?.trim() || null);
  const [busy, setBusy] = useState<"idle" | "generating" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<BuildStatus>({ step: "idle", message: "", lines: [] });

  // Reopening a project restores its playable revision, without rebuilding the old wizard.
  useEffect(() => {
    const id = props.replayFromProjectId?.trim();
    if (!id) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, { headers: mergeLocaleHeaders(locale) });
        const data = (await res.json()) as { project?: { prompt?: string; id?: string }; spec?: GameSpec };
        if (cancelled || !res.ok) return;
        if (data.project?.prompt) setPrompt(data.project.prompt.slice(0, 4000));
        if (data.project?.id) setProjectId(data.project.id);
        if (data.spec) {
          setSpec(data.spec);
          setStatus({ step: "ready", message: "已恢复可玩的版本", lines: [] });
        }
      } catch {
        if (!cancelled) setError(t("errors.network"));
      }
    })();
    return () => { cancelled = true; };
  }, [locale, props.replayFromProjectId, t]);

  const generate = useCallback(async () => {
    if (prompt.trim().length < 2 || busy !== "idle") return;
    setBusy("generating");
    setError(null);
    setSpec(null);
    setGenerationDebug(null);
    setGenerationSource(null);
    setStatus({ step: "kernel", message: "正在确定核心规则与操作方式", lines: [] });
    try {
      const res = await fetch("/api/generate/stream", {
        method: "POST",
        headers: mergeLocaleHeaders(locale, {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          "Cache-Control": "no-cache",
        }),
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string; errorKey?: string; errorParams?: Record<string, string | number> };
        const quota = parseQuotaExceeded(data, res.status);
        if (quota) showQuotaExceeded(quota);
        else setError(resolveClientApiError(locale, data, "generateFailed"));
        return;
      }
      await consumeSSE(res, (event) => {
        const step = typeof event.step === "string" ? event.step : "";
        const message = typeof event.message === "string" ? event.message : "";
        if (step === "kernel") setStatus({ step: "kernel", message, lines: [] });
        if (step === "verify") setStatus({ step: "verify", message, lines: [] });
        if (step === "recap") {
          const lines = Array.isArray(event.lines)
            ? event.lines.filter((line): line is string => typeof line === "string")
            : [];
          setStatus((old) => ({ ...old, lines }));
        }
        if (step === "done" && event.spec) {
          const generatedSpec = event.spec as GameSpec;
          setSpec(generatedSpec);
          const debug = event.debug && typeof event.debug === "object"
            ? (event.debug as {
                model?: string;
                provider?: string;
                fallback?: boolean;
                kernelFallback?: boolean;
                source?: string;
                templateHint?: string;
                scene?: string;
              })
            : null;
          setGenerationDebug(debug);
          setGenerationSource(typeof event.source === "string" ? event.source : debug?.source ?? null);
          setStatus((old) => ({
            ...old,
            step: "ready",
            message: requiresBespokeRuntime(generatedSpec)
              ? "设计已准备好；保存后将构建独立玩法运行时"
              : "可玩版本已准备好",
          }));
        }
        if (step === "error") setError(message || t("errors.generateFailed"));
      }, { locale });
    } catch {
      setError(t("errors.network"));
    } finally {
      setBusy("idle");
    }
  }, [busy, locale, prompt, showQuotaExceeded, t]);

  const saveAndPlay = useCallback(async () => {
    if (!spec || busy !== "idle") return;
    setBusy("saving");
    setError(null);
    try {
      const specToSave = prepareGameSpecForPersist(spec, prompt, locale);
      const updating = Boolean(projectId);
      const provenanceDebug = generationDebug
        ? {
            provider: generationDebug.provider,
            model: generationDebug.model,
            source: generationDebug.source ?? generationSource ?? undefined,
            fallback: generationDebug.fallback,
            kernelFallback: generationDebug.kernelFallback,
            templateHint: generationDebug.templateHint,
            scene: generationDebug.scene,
          }
        : null;
      const res = await fetch(updating ? `/api/projects/${projectId}` : "/api/projects", {
        method: updating ? "PATCH" : "POST",
        headers: mergeLocaleHeaders(locale, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          prompt,
          spec: specToSave,
          debug: provenanceDebug,
          source: generationSource ?? provenanceDebug?.source,
        }),
      });
      const data = (await res.json()) as { project?: { id?: string }; error?: string; errorKey?: string; errorParams?: Record<string, string | number> };
      if (!res.ok) {
        setError(resolveClientApiError(locale, data, "saveFailed"));
        return;
      }
      const id = data.project?.id ?? projectId;
      if (!id) {
        setError(t("errors.noProjectId"));
        return;
      }
      setProjectId(id);
      // Play immediately: generated art can improve later, never block mobile H5.
      router.push(withLocalePath(`/play/${id}`, locale));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("errors.network"));
    } finally {
      setBusy("idle");
    }
  }, [busy, locale, projectId, prompt, router, spec, generationDebug, generationSource, t]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        void generate();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [generate]);

  const examples = [t("examples.0"), t("examples.1"), t("examples.2")];
  const hint = status.step === "kernel" ? "1 / 2" : status.step === "verify" ? "2 / 2" : status.step === "ready" ? "完成" : "";

  return (
    <AppPageShell className="text-[var(--gc-text)]">
      <SiteHeader />
      <AppMain>
        <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:py-12">
          <header className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--gc-text)]">{t("title")}</h1>
            <p className="text-sm leading-relaxed text-[var(--gc-muted)]">一句话描述玩法，系统会先建立规则与操作，再交付可以直接玩的版本。</p>
          </header>

          <section className="rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-4 sm:p-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <label htmlFor="prompt" className="text-sm font-medium text-[var(--gc-text-soft)]">{t("promptLabel")}</label>
              <span className="text-xs tabular-nums text-[var(--gc-text-faint)]">{prompt.length} / 4000</span>
            </div>
            <textarea id="prompt" rows={5} value={prompt} onChange={(event) => setPrompt(event.target.value.slice(0, 4000))} placeholder={t("promptPlaceholder")} className="min-h-36 w-full resize-y rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-4 py-3 text-sm outline-none placeholder:text-[var(--gc-text-faint)] focus:border-[color:color-mix(in_srgb,var(--gc-accent)_45%,transparent)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--gc-accent)_22%,transparent)]" />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {examples.map((example, index) => <button key={example} type="button" onClick={() => setPrompt(example || FALLBACK_EXAMPLES[index])} className="gc-chip max-w-full truncate text-left">{(example || FALLBACK_EXAMPLES[index]).slice(0, 22)}</button>)}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => void generate()} disabled={busy !== "idle" || prompt.trim().length < 2} className="gc-theme-cta rounded-full px-6 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40">{busy === "generating" ? "正在生成…" : "生成可玩版本"}</button>
              <span className="text-xs text-[var(--gc-text-faint)]">Ctrl / ⌘ + Enter</span>
            </div>
          </section>

          {status.step !== "idle" ? <section aria-live="polite" className="rounded-2xl border border-[color:color-mix(in_srgb,var(--gc-accent)_30%,var(--gc-border))] bg-[var(--gc-surface-glass)] px-4 py-3">
            <div className="flex items-center justify-between gap-4"><p className="text-sm font-medium text-[var(--gc-text-soft)]">{status.message}</p><span className="text-xs tabular-nums text-[var(--gc-muted)]">{hint}</span></div>
            {busy === "generating" ? <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--gc-border)]"><div className="h-full w-2/3 animate-pulse rounded-full bg-[var(--gc-accent)]" /></div> : null}
            {status.lines.length ? <ul className="mt-3 space-y-1 text-xs leading-relaxed text-[var(--gc-muted)]">{status.lines.map((line) => <li key={line}>· {line}</li>)}</ul> : null}
          </section> : null}

          {error ? <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p> : null}

          <section className="border-t border-[color:var(--gc-border)] pt-6" aria-label={t("previewAria")}>
            {spec ? <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">{spec.title}</h2><p className="mt-1 text-xs text-[var(--gc-muted)]">{spec.labels.subtitle}</p></div><button type="button" onClick={() => void saveAndPlay()} disabled={busy !== "idle"} className="rounded-full border border-[color:var(--gc-border)] px-5 py-2 text-sm font-medium hover:bg-[var(--gc-surface-glass)] disabled:opacity-40">{busy === "saving" ? "正在保存…" : "保存并打开"}</button></div>
              <GamePlayer spec={spec} promptHint={prompt} />
            </div> : <div className="gc-card flex min-h-64 items-center justify-center px-6 text-center text-sm text-[var(--gc-muted)]">输入一句玩法说明后，这里会出现可直接试玩的版本。</div>}
          </section>
        </main>
        {QuotaModal}
      </AppMain>
    </AppPageShell>
  );
}
