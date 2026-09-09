"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppMain, AppPageShell } from "@/components/AppPageShell";
import { SiteHeader } from "@/components/SiteHeader";
import { useQuotaExceededModal } from "@/components/commerce/QuotaExceededModal";
import { parseQuotaExceeded } from "@/lib/commerce/quota-error";
import { mergeLocaleHeaders } from "@/lib/i18n/client-headers";
import { resolveClientApiError } from "@/lib/i18n/resolve-client-api-error";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

const FALLBACK_EXAMPLES = [
  "设计一个开心消消乐游戏",
  "做一个单手操作的太空躲避游戏",
  "做一个种花、收获、升级的小农场",
];

const BUILD_STEPS = [
  { number: "01", title: "理解玩法", detail: "设计 Agent 把一句话拆成规则、操作和胜负目标" },
  { number: "02", title: "构建游戏", detail: "代码、美术和声音 Agent 生成独立运行时" },
  { number: "03", title: "启动验证", detail: "在真实浏览器中检查启动、操作、胜负和重试" },
  { number: "04", title: "交付试玩", detail: "通过验证后自动开放试玩与后续修改" },
];

/** One request creates one durable production job; progress and delivery live on the play route. */
export default function CreateClient(props: { initialPrompt?: string; replayFromProjectId?: string }) {
  const router = useRouter();
  const locale = useLocale() as AppLocale;
  const t = useTranslations("createFlow");
  const { showQuotaExceeded, QuotaModal } = useQuotaExceededModal();
  const [prompt, setPrompt] = useState(() => props.initialPrompt?.slice(0, 4000) ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reuse only the creator's words. Every new run gets fresh production evidence.
  useEffect(() => {
    const id = props.replayFromProjectId?.trim();
    if (!id) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, { headers: mergeLocaleHeaders(locale) });
        const data = (await res.json()) as { project?: { prompt?: string } };
        if (!cancelled && res.ok && data.project?.prompt) setPrompt(data.project.prompt.slice(0, 4000));
      } catch {
        if (!cancelled) setError(t("errors.network"));
      }
    })();
    return () => { cancelled = true; };
  }, [locale, props.replayFromProjectId, t]);

  const startBuild = useCallback(async () => {
    const trimmed = prompt.trim();
    if (trimmed.length < 2 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: mergeLocaleHeaders(locale, { "Content-Type": "application/json" }),
        body: JSON.stringify({ prompt: trimmed }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        project?: { id?: string };
        error?: string;
        errorKey?: string;
        errorParams?: Record<string, string | number>;
      };
      if (!res.ok) {
        const quota = parseQuotaExceeded(data, res.status);
        if (quota) showQuotaExceeded(quota);
        else setError(resolveClientApiError(locale, data, "saveFailed"));
        return;
      }
      const id = data.project?.id;
      if (!id) {
        setError(t("errors.noProjectId"));
        return;
      }
      router.push(withLocalePath(`/play/${id}`, locale));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("errors.network"));
    } finally {
      setBusy(false);
    }
  }, [busy, locale, prompt, router, showQuotaExceeded, t]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        void startBuild();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [startBuild]);

  const examples = [t("examples.0"), t("examples.1"), t("examples.2")];

  return (
    <AppPageShell className="text-[var(--gc-text)]">
      <SiteHeader />
      <AppMain>
        <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:py-16 lg:px-8">
          <section className="relative overflow-hidden rounded-[2rem] border border-[color:color-mix(in_srgb,var(--gc-accent)_28%,var(--gc-border))] bg-[var(--gc-surface-glass)] px-5 py-8 sm:px-10 sm:py-12 lg:px-14">
            <div aria-hidden className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-[color:color-mix(in_srgb,var(--gc-accent)_18%,transparent)] blur-3xl" />
            <div className="relative max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--gc-accent)]">ONE SENTENCE · ONE PLAYABLE GAME</p>
              <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">一句话，生成一个真的能玩的游戏</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--gc-muted)] sm:text-base">提交后，多 Agent 会直接完成玩法设计、独立运行时、美术声音和浏览器验证。你可以离开页面，任务会在后台继续。</p>
            </div>

            <div className="relative mt-8 rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)] p-3 shadow-2xl shadow-black/10 sm:p-4">
              <label htmlFor="prompt" className="sr-only">{t("promptLabel")}</label>
              <textarea id="prompt" rows={5} value={prompt} onChange={(event) => setPrompt(event.target.value.slice(0, 4000))} placeholder="例如：创建一个开心消消乐游戏，糖果连成三个即可消除" className="min-h-40 w-full resize-y bg-transparent px-2 py-2 text-base leading-7 outline-none placeholder:text-[var(--gc-text-faint)] sm:px-3" />
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--gc-border)] pt-3">
                <span className="text-xs tabular-nums text-[var(--gc-text-faint)]">{prompt.length} / 4000</span>
                <div className="flex items-center gap-3">
                  <span className="hidden text-xs text-[var(--gc-text-faint)] sm:inline">Ctrl / ⌘ + Enter</span>
                  <button type="button" onClick={() => void startBuild()} disabled={busy || prompt.trim().length < 2} className="gc-theme-cta rounded-full px-6 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40">{busy ? "正在创建任务…" : "开始生成游戏"}</button>
                </div>
              </div>
            </div>

            <div className="relative mt-4 flex flex-wrap gap-2">
              {examples.map((example, index) => <button key={example} type="button" disabled={busy} onClick={() => setPrompt(example || FALLBACK_EXAMPLES[index])} className="gc-chip max-w-full truncate text-left">{(example || FALLBACK_EXAMPLES[index]).slice(0, 24)}</button>)}
            </div>
            {error ? <p className="relative mt-5 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p> : null}
          </section>

          <section className="mt-12" aria-labelledby="build-flow-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gc-muted)]">完整生产流程</p><h2 id="build-flow-title" className="mt-2 text-2xl font-semibold">从想法到可玩，只有一次提交</h2></div>
              <p className="text-xs text-[var(--gc-muted)]">通常需要 10–25 分钟 · 后台自动继续</p>
            </div>
            <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {BUILD_STEPS.map((step) => <li key={step.number} className="rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-5"><span className="text-xs font-semibold tabular-nums text-[var(--gc-accent)]">{step.number}</span><h3 className="mt-5 font-semibold">{step.title}</h3><p className="mt-2 text-xs leading-5 text-[var(--gc-muted)]">{step.detail}</p></li>)}
            </ol>
          </section>
        </main>
        {QuotaModal}
      </AppMain>
    </AppPageShell>
  );
}
