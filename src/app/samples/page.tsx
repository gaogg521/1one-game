"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { AppMain, AppPageShell } from "@/components/AppPageShell";
import { SiteHeader } from "@/components/SiteHeader";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { mergeLocaleHeaders } from "@/lib/i18n/client-headers";
import { resolveClientApiError } from "@/lib/i18n/resolve-client-api-error";
import {
  getLocalizedSamplesByShelf,
  getLocalizedShelfMeta,
} from "@/lib/i18n/samples-localized";
import { sampleProjectId } from "@/lib/sample-gallery";
import { SAMPLE_SHELVES, type Sample } from "@/lib/samples";
import { prefetchSamplesGodotExports } from "@/lib/samples-godot-prefetch.client";

type BusyMap = Record<string, "idle" | "cloning" | "error">;

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
  ready,
  locale,
  onClone,
  ts,
}: {
  s: Sample;
  featured: boolean;
  busy: boolean;
  ready: boolean;
  locale: AppLocale;
  onClone: (sampleId: string) => void | Promise<void>;
  ts: ReturnType<typeof useTranslations<"samples">>;
}) {
  const [coverFailed, setCoverFailed] = useState(false);
  const aspect = featured ? "aspect-[3/4] sm:aspect-[10/13]" : "aspect-[4/5]";
  const projectId = sampleProjectId(s.id);
  const playHref = withLocalePath(`/play/${projectId}`, locale);

  return (
    <article
      className={`group/card flex flex-col ${featured ? "gap-3" : "gap-2.5"}`}
      style={{ minWidth: 0 }}
    >
      <Link
        href={playHref}
        className={`relative block overflow-hidden rounded-2xl border border-[color:var(--gc-border)] shadow-[0_20px_50px_-28px_rgba(0,0,0,0.55)] transition duration-300 group-hover/card:-translate-y-0.5 group-hover/card:shadow-[0_28px_60px_-24px_color-mix(in_srgb,var(--gc-accent)_22%,transparent)] ${aspect}`}
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
            {ts("hot")}
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

        {!s.photoCover ? (
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
        ) : null}
      </Link>

      {s.photoCover ? (
        <div className="px-0.5">
          <Link href={playHref} className="line-clamp-2 font-semibold leading-snug tracking-tight text-[var(--gc-text)] hover:text-[var(--gc-accent)]">
            {s.title}
          </Link>
          <p className={`mt-0.5 line-clamp-1 text-[var(--gc-muted)] ${featured ? "text-[11px] sm:text-xs" : "text-[10px]"}`}>
            {s.subtitle}
          </p>
        </div>
      ) : null}

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
          <span className="underline-offset-2 group-open/prompt:underline">{ts("prompt")}</span>
          <span className="ml-1 text-[var(--gc-text-faint)]">{ts("expand")}</span>
        </summary>
        <p className="mt-1.5 rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-2.5 text-[11px] leading-relaxed text-[var(--gc-muted)]">
          {s.prompt}
        </p>
      </details>

      <div className="mt-auto flex flex-wrap gap-2 px-0.5">
        <Link
          href={playHref}
          className={`gc-theme-cta rounded-full px-4 py-2 text-xs font-semibold shadow-md hover:brightness-110 sm:px-5 sm:text-sm ${ready ? "" : "pointer-events-none opacity-50"}`}
        >
          {ts("play")}
        </Link>
        <button
          type="button"
          disabled={busy || !ready}
          onClick={() => void onClone(s.id)}
          className="rounded-full border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-4 py-2 text-xs font-medium text-[var(--gc-text-soft)] transition hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))] hover:bg-[var(--gc-surface-glass-strong)] disabled:opacity-50 sm:text-sm"
        >
          {busy ? ts("cloning") : ts("clone")}
        </button>
      </div>

      <p className="flex items-center gap-2 px-0.5 text-[11px] text-[var(--gc-text-faint)]">
        <span
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--gc-surface-glass-strong)] text-[10px] font-bold text-[var(--gc-accent)]"
          aria-hidden
        >
          {s.creator.slice(0, 1).toUpperCase()}
        </span>
        <span className="truncate">{s.creator}</span>
      </p>
    </article>
  );
}

export default function SamplesPage() {
  const locale = useLocale() as AppLocale;
  const ts = useTranslations("samples");
  const router = useRouter();
  const [busy, setBusy] = useState<BusyMap>({});
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stale = false;
    void fetch("/api/samples/ensure", {
      method: "POST",
      headers: mergeLocaleHeaders(locale),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(() => {
        if (!stale) {
          setReady(true);
          prefetchSamplesGodotExports();
        }
      })
      .catch(() => {
        if (!stale) setError(ts("networkError"));
      });
    return () => {
      stale = true;
    };
  }, [locale, ts]);

  const handleClone = useCallback(
    async (sampleId: string) => {
      setError(null);
      setBusy((m) => ({ ...m, [sampleId]: "cloning" }));
      const projectId = sampleProjectId(sampleId);
      try {
        const res = await fetch(`/api/projects/${projectId}/duplicate`, {
          method: "POST",
          headers: mergeLocaleHeaders(locale),
        });
        const data = (await res.json()) as {
          project?: { id: string };
          error?: string;
          errorKey?: string;
          errorParams?: Record<string, string | number>;
        };
        if (!res.ok || !data.project?.id) {
          setError(resolveClientApiError(locale, data, "cloneFailed"));
          setBusy((m) => ({ ...m, [sampleId]: "error" }));
          return;
        }
        router.push(withLocalePath(`/play/${data.project.id}`, locale));
      } catch {
        setError(ts("networkError"));
        setBusy((m) => ({ ...m, [sampleId]: "error" }));
      } finally {
        setBusy((m) => ({ ...m, [sampleId]: "idle" }));
      }
    },
    [locale, router, ts],
  );

  return (
    <AppPageShell className="text-[var(--gc-text)]">
      <SiteHeader />
      <AppMain>
      <main className="flex min-w-0 flex-1 flex-col overflow-x-hidden pb-16 pt-8 lg:pt-10">
        <div className="px-4 sm:px-6 lg:px-10 xl:px-12">
          <header className="max-w-3xl space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--gc-text-faint)]">Gallery</p>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--gc-text)] sm:text-4xl">{ts("title")}</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-[var(--gc-muted)] sm:text-base">
              {ts("desc")}
            </p>
            {!ready && !error ? (
              <p className="text-xs text-[var(--gc-text-faint)]">{ts("bootstrapping")}</p>
            ) : null}
          </header>

          {error ? (
            <p className="mt-6 max-w-xl rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          ) : null}
        </div>

        <div className="mt-10 flex flex-col gap-14 sm:mt-12 sm:gap-16">
          {SAMPLE_SHELVES.map((shelf) => {
            const meta = getLocalizedShelfMeta(shelf, locale);
            const list = getLocalizedSamplesByShelf(shelf, locale);
            const featured = shelf === "featured";
            return (
              <section key={shelf} className="min-w-0">
                <div className="mb-4 flex flex-col gap-1 px-4 sm:mb-5 sm:flex-row sm:items-end sm:justify-between sm:px-6 lg:px-10 xl:px-12">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight text-[var(--gc-text)] sm:text-xl">{meta.title}</h2>
                    <p className="mt-0.5 text-sm text-[var(--gc-muted)]">{meta.description}</p>
                  </div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--gc-text-faint)]">{ts("swipeHint")}</p>
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
                          busy={(busy[s.id] ?? "idle") === "cloning"}
                          ready={ready}
                          locale={locale}
                          onClone={handleClone}
                          ts={ts}
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
      </AppMain>
    </AppPageShell>
  );
}
