"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SAMPLE_SHELVES, type Sample, samplesByShelf, shelfConfig } from "@/lib/samples";
import type { GameSpec } from "@/lib/game-spec";
import { prefetchGodotExport } from "@/lib/godot-prefetch.client";
import { prefetchSamplesGodotExports } from "@/lib/samples-godot-prefetch.client";

type BusyMap = Record<string, "idle" | "creating" | "error">;

function PlayGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <path d="M2.5 1.2 10 6 2.5 10.8V1.2Z" />
    </svg>
  );
}

function SampleCard({
  s,
  featured,
  busy,
  onPlay,
  onEdit,
}: {
  s: Sample;
  featured: boolean;
  busy: boolean;
  onPlay: (id: string, prompt: string) => void | Promise<void>;
  onEdit: (prompt: string) => void;
}) {
  const [coverFailed, setCoverFailed] = useState(false);
  const aspect = featured ? "aspect-[3/4] sm:aspect-[10/13]" : "aspect-[4/5]";

  return (
    <article
      className={`group/card flex flex-col ${featured ? "gap-3" : "gap-2.5"}`}
      style={{ minWidth: 0 }}
    >
      <div
        className={`relative overflow-hidden rounded-2xl border border-[color:var(--gc-border)] shadow-[0_20px_50px_-28px_rgba(0,0,0,0.55)] transition duration-300 group-hover/card:-translate-y-0.5 group-hover/card:shadow-[0_28px_60px_-24px_color-mix(in_srgb,var(--gc-accent)_22%,transparent)] ${aspect}`}
      >
        <div className="absolute inset-0" style={{ background: s.coverGradient }} />
        {!coverFailed ? (
          <Image
            src={s.coverImageSrc}
            alt={s.coverAlt}
            fill
            sizes={featured ? "(min-width: 1024px) 22vw, (min-width: 640px) 40vw, 86vw" : "(min-width: 1024px) 18vw, (min-width: 640px) 36vw, 82vw"}
            unoptimized
            className="absolute inset-0 z-[1] h-full w-full object-cover transition duration-500 will-change-transform group-hover/card:scale-[1.04]"
            onError={() => setCoverFailed(true)}
          />
        ) : null}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 20%, ${s.accentGlow}, transparent 45%), radial-gradient(circle at 88% 12%, rgba(255,255,255,0.35), transparent 38%)`,
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgba(0,0,0,0.72)_100%)]" />

        {s.badge === "hot" ? (
          <span className="absolute left-3 top-3 rounded-md bg-gradient-to-r from-rose-600 to-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-md">
            热门
          </span>
        ) : null}
        {s.badge === "new" ? (
          <span className="absolute right-3 top-3 rounded-md bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-md">
            NEW
          </span>
        ) : null}

        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-white backdrop-blur-md">
          <PlayGlyph className="opacity-90" />
          {s.plays}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-3 pt-10 sm:p-4 sm:pt-12">
          <div className="flex items-end gap-2">
            <span className="select-none text-2xl leading-none drop-shadow-md sm:text-3xl" aria-hidden>
              {s.emoji}
            </span>
            <h2
              className={`min-w-0 flex-1 font-semibold leading-tight tracking-tight text-white drop-shadow-sm ${featured ? "text-[15px] sm:text-base" : "text-[13px] sm:text-sm"}`}
            >
              {s.title}
            </h2>
          </div>
          <p className={`mt-1 line-clamp-2 text-white/85 ${featured ? "text-[11px] sm:text-xs" : "text-[10px] sm:text-[11px]"}`}>
            {s.subtitle}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 px-0.5">
        {s.tags.slice(0, featured ? 5 : 3).map((t) => (
          <span
            key={t}
            className="rounded-full border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-2 py-0.5 text-[10px] font-medium text-[var(--gc-muted)]"
          >
            {t}
          </span>
        ))}
      </div>

      <details className="group/prompt px-0.5">
        <summary className="cursor-pointer list-none text-[11px] font-medium text-[var(--gc-muted)] marker:content-none [&::-webkit-details-marker]:hidden hover:text-[var(--gc-accent)]">
          <span className="underline-offset-2 group-open/prompt:underline">提示词</span>
          <span className="ml-1 text-[var(--gc-text-faint)]">（展开）</span>
        </summary>
        <p className="mt-1.5 rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-2.5 text-[11px] leading-relaxed text-[var(--gc-muted)]">
          {s.prompt}
        </p>
      </details>

      <div className="mt-auto flex flex-wrap gap-2 px-0.5">
        <button
          type="button"
          onClick={() => void onPlay(s.id, s.prompt)}
          disabled={busy}
          className="gc-theme-cta rounded-full px-4 py-2 text-xs font-semibold shadow-md hover:brightness-110 disabled:opacity-50 sm:px-5 sm:text-sm"
        >
          {busy ? "创建中…" : "试玩"}
        </button>
        <button
          type="button"
          onClick={() => onEdit(s.prompt)}
          className="rounded-full border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-4 py-2 text-xs font-medium text-[var(--gc-text-soft)] transition hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))] hover:bg-[var(--gc-surface-glass-strong)] sm:text-sm"
        >
          微调
        </button>
      </div>

      <p className="flex items-center gap-2 px-0.5 text-[11px] text-[var(--gc-text-faint)]">
        <span
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--gc-surface-glass-strong)] text-[10px] font-bold text-[var(--gc-accent)]"
          aria-hidden
        >
          1
        </span>
        <span className="truncate">{s.creator}</span>
      </p>
    </article>
  );
}

export default function SamplesPage() {
  const router = useRouter();
  const [busy, setBusy] = useState<BusyMap>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    prefetchSamplesGodotExports();
  }, []);

  const goEdit = useCallback(
    (prompt: string) => {
      router.push(`/create?prefill=${encodeURIComponent(prompt)}`);
    },
    [router],
  );

  const wrappedPlay = useCallback(
    async (id: string, prompt: string) => {
      setError(null);
      setBusy((m) => ({ ...m, [id]: "creating" }));
      try {
        const gen = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });
        const genData = (await gen.json()) as { spec?: GameSpec; error?: string };
        if (!gen.ok || !genData.spec) {
          setError(genData.error ?? "生成失败");
          setBusy((m) => ({ ...m, [id]: "error" }));
          return;
        }

        const save = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, spec: genData.spec }),
        });
        const saveData = (await save.json()) as { project?: { id: string }; error?: string };
        if (!save.ok || !saveData.project?.id) {
          setError(saveData.error ?? "保存失败");
          setBusy((m) => ({ ...m, [id]: "error" }));
          return;
        }
        prefetchGodotExport(genData.spec, { projectId: saveData.project.id });
        router.push(`/play/${saveData.project.id}`);
      } catch {
        setError("网络异常");
        setBusy((m) => ({ ...m, [id]: "error" }));
      } finally {
        setBusy((m) => ({ ...m, [id]: "idle" }));
      }
    },
    [router],
  );

  return (
    <div className="flex min-h-full flex-1 flex-col text-[var(--gc-text)] lg:flex-row">
      <SiteHeader />
      <main className="flex min-w-0 flex-1 flex-col overflow-x-hidden pb-16 pt-8 lg:pt-10">
        <div className="px-4 sm:px-6 lg:px-10 xl:px-12">
          <header className="max-w-3xl space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--gc-text-faint)]">Gallery</p>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--gc-text)] sm:text-4xl">样品馆</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-[var(--gc-muted)] sm:text-base">
              横向浏览灵感卡片，参考{" "}
              <a
                href="https://www.astrocade.com/"
                target="_blank"
                rel="noreferrer"
                className="text-[var(--gc-accent)] underline-offset-4 hover:underline"
              >
                Astrocade
              </a>{" "}
              式陈列：竖版封面可换为试玩截图，改数据里的{" "}
              <code className="rounded bg-[var(--gc-surface-glass)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--gc-text-soft)]">
                coverImageSrc
              </code>{" "}
              即可；当前为 SVG 海报，加载失败时回退渐变。
            </p>
          </header>

          {error ? (
            <p className="mt-6 max-w-xl rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          ) : null}
        </div>

        <div className="mt-10 flex flex-col gap-14 sm:mt-12 sm:gap-16">
          {SAMPLE_SHELVES.map((shelf) => {
            const meta = shelfConfig(shelf);
            const list = samplesByShelf(shelf);
            const featured = shelf === "featured";
            return (
              <section key={shelf} className="min-w-0">
                <div className="mb-4 flex flex-col gap-1 px-4 sm:mb-5 sm:flex-row sm:items-end sm:justify-between sm:px-6 lg:px-10 xl:px-12">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight text-[var(--gc-text)] sm:text-xl">{meta.title}</h2>
                    <p className="mt-0.5 text-sm text-[var(--gc-muted)]">{meta.description}</p>
                  </div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--gc-text-faint)]">左右滑动</p>
                </div>

                <div className="relative">
                  <div
                    className="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-4 pb-2 pt-1 [scrollbar-width:thin] sm:gap-5 sm:px-6 lg:gap-6 lg:px-10 xl:px-12"
                  >
                    {list.map((s) => (
                      <div key={s.id} className={`snap-start ${meta.cardClass}`}>
                        <SampleCard
                          s={s}
                          featured={featured}
                          busy={(busy[s.id] ?? "idle") === "creating"}
                          onPlay={wrappedPlay}
                          onEdit={goEdit}
                        />
                      </div>
                    ))}
                  </div>
                  <div
                    className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[var(--gc-bg)] to-transparent sm:w-24"
                    aria-hidden
                  />
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
