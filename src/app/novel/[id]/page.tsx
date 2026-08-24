"use client";

import type { CSSProperties } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { withLocalePath } from "@/i18n/navigation";
import { AppMain, AppPageShell } from "@/components/AppPageShell";
import { SiteHeader } from "@/components/SiteHeader";
import { ResultMomentBanner } from "@/components/ResultMomentBanner";
import {
  ChildrenNovelReader,
  isChildrenFormattedNovelContent,
} from "@/components/novel/ChildrenNovelReader";
import { NovelReader } from "@/components/novel/NovelReader";
import { NovelEditor } from "@/components/novel/NovelEditor";
import { ComicChapterAdaptationBanner } from "@/components/comic/ComicChapterAdaptationBanner";
import { LiteraryAdaptationTrustBadge } from "@/components/LiteraryAdaptationTrustBadge";
import { ComicGeneratePanel } from "@/components/comic/ComicGeneratePanel";
import { inferStoryGenre } from "@/lib/cover-genre";
import { resolveLiteraryAdaptationUserInfo } from "@/lib/literary-adaptation-user";
import type { ComicChapterAdaptationProgress } from "@/lib/comic-chapter-adaptation";
import type { ComicChapterScope } from "@/lib/comic-chapter-scope";
import { NovelContinueButton } from "@/components/novel/NovelContinueButton";
import { NovelSynopsisBlurb } from "@/components/novel/NovelSynopsisBlurb";
import { parseNovelChapters } from "@/lib/novel-chapters";
import { isChildrenNovelTier, parseNovelLengthTier } from "@/lib/novel-length";
import { displayNovelSummary, normalizeNovelTitle } from "@/lib/novel-display";
import {
  NOVEL_READER_THEMES,
  novelReaderChromeCssVars,
  type NovelReaderThemeId,
} from "@/lib/novel-reader-theme";
import { WorkShareBar } from "@/components/share/WorkShareBar";
import { WorkEngagementStats } from "@/components/work/WorkEngagementStats";
import { WorkLikeButton } from "@/components/work/WorkLikeButton";
import { PublishWorkButton } from "@/components/work/PublishWorkButton";
import { WorkCommentSection } from "@/components/work/WorkCommentSection";
import { NovelResumeBanner } from "@/components/novel/NovelResumeBanner";
import { NovelReadCoverThumb, type NovelReadCoverHandle } from "@/components/novel/NovelReadCoverThumb";
import { NovelCharacterRosterPanel } from "@/components/literary/NovelCharacterRosterPanel";
import { NovelStoryPlanPanel } from "@/components/novel/NovelStoryPlanPanel";
import type { NovelBible, NovelChapterPlan } from "@/lib/novel-long-pipeline-types";
import { NovelContinuityPanel } from "@/components/novel/NovelContinuityPanel";
import type { ConsistencyReport } from "@/lib/novel-long-consistency";
import type { ComicCharacterRoster } from "@/lib/comic-character-roster";
import { mergeLocaleHeaders } from "@/lib/i18n/client-headers";
import type { CreatorQualityReport } from "@/lib/creator-workflow";
import { CreatorConsumptionPanel, type CreatorConsumptionSummary } from "@/components/work/CreatorConsumptionPanel";
import { CreatorVersionStatus } from "@/components/work/CreatorVersionStatus";

interface Novel {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  prompt: string;
  coverPath: string | null;
  lengthTier: string | null;
  createdAt: string;
  comics: { id: string; title: string; status?: string }[];
  shareCode: string | null;
  isOwner?: boolean;
  playCount?: number;
  likeCount?: number;
  chapterAdaptation?: ComicChapterAdaptationProgress;
  draftStoryboardComics?: { id: string; title: string }[];
  canContinue?: boolean;
  continuationReason?: string;
  remainingChapterCount?: number;
  status?: string;
  visibility?: string;
  characterRoster?: ComicCharacterRoster | null;
  quality?: CreatorQualityReport;
  storyPlan?: { bible: NovelBible; chapterPlan: NovelChapterPlan };
  continuity?: ConsistencyReport | null;
  continueJob?: {
    id: string;
    status: string;
    attempts: number;
    maxAttempts: number;
    progress: { percent?: number; stage?: string } | null;
  } | null;
  literaryEngagement?: CreatorConsumptionSummary;
  creatorCore?: {
    revision?: { id: string; sequence: number; status?: string; summary?: string | null; finalizedAt?: string | null } | null;
    project?: {
      acceptedRevisionId?: string | null;
      acceptedRevision?: { id: string; sequence: number; status?: string; summary?: string | null; finalizedAt?: string | null } | null;
      publications?: Array<{ action: string; visibility: string; decision?: string; createdAt?: string }>;
    };
  } | null;
}

export default function NovelDetailPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const locale = useLocale() as AppLocale;
  const t = useTranslations("novelRead");
  const tc = useTranslations("common");
  const ts = useTranslations("studio");
  const requestedChapter = Number(searchParams.get("comicChapter"));
  const requestedChapterNumber = Number.isFinite(requestedChapter) && requestedChapter >= 1 ? requestedChapter : null;
  const requestedResumeComic = searchParams.get("resumeComic")?.trim() || undefined;
  const [novel, setNovel] = useState<Novel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [comicSetupOpen, setComicSetupOpen] = useState(
    () => searchParams.get("adaptComic") === "1" || Boolean(requestedResumeComic) || requestedChapterNumber !== null,
  );
  const [initialChapterScope, setInitialChapterScope] = useState<ComicChapterScope | null>(() =>
    requestedChapterNumber === null
      ? null
      : { fromChapter: requestedChapterNumber, toChapter: requestedChapterNumber, label: t("chapterLabel", { num: requestedChapterNumber }) },
  );
  const [resumeComicId, setResumeComicId] = useState<string | undefined>(() => requestedResumeComic);
  const [editing, setEditing] = useState(false);
  const [repairChapter, setRepairChapter] = useState<number | null>(null);
  const [coverRegenerating, setCoverRegenerating] = useState(false);
  const [readerTheme, setReaderTheme] = useState<NovelReaderThemeId>("paper");
  const coverRef = useRef<NovelReadCoverHandle>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/novel/${encodeURIComponent(id as string)}`, { headers: mergeLocaleHeaders(locale) })
      .then((r) => r.json())
      .then((data) => {
        if (data.novel) setNovel(data.novel);
        else setError(t("notFound"));
      })
      .catch(() => setError(t("loadFailed")))
      .finally(() => setLoading(false));

    void fetch(`/api/novel/${encodeURIComponent(id as string)}/play`, {
      method: "POST",
      headers: mergeLocaleHeaders(locale),
    }).then(() => {
      setNovel((prev) =>
        prev ? { ...prev, playCount: (prev.playCount ?? 0) + 1 } : prev,
      );
    });
  }, [id, locale, t]);

  useEffect(() => {
    if (!novel?.isOwner || !novel.continueJob || !id) return;
    const timer = window.setTimeout(() => {
      void fetch(`/api/novel/${encodeURIComponent(id as string)}`, { headers: mergeLocaleHeaders(locale) })
        .then((r) => r.json())
        .then((data: { novel?: Novel }) => {
          if (data.novel) setNovel(data.novel);
        });
    }, 3_000);
    return () => window.clearTimeout(timer);
  }, [id, locale, novel?.continueJob, novel?.isOwner]);

  const displayMeta = useMemo(() => {
    if (!novel) return null;
    const displayTitle = normalizeNovelTitle(novel.title, novel.prompt, undefined, locale);
    const blurb = displayNovelSummary(novel.summary, displayTitle, novel.prompt, novel.content, locale);
    const isChildrenReader =
      isChildrenNovelTier(parseNovelLengthTier(novel.lengthTier)) ||
      isChildrenFormattedNovelContent(novel.content);
    const chapters = isChildrenReader ? [] : parseNovelChapters(novel.content, locale);
    return { displayTitle, blurb, chapters, isChildrenReader };
  }, [novel, locale]);

  const adaptationPreview = useMemo(() => {
    if (!novel) return null;
    const storyGenre = inferStoryGenre({
      title: novel.title,
      summary: novel.summary ?? "",
      prompt: novel.prompt,
      contentSnippet: novel.content.slice(0, 1200),
    });
    return resolveLiteraryAdaptationUserInfo({
      novelTitle: displayMeta?.displayTitle ?? novel.title,
      chapterScope: initialChapterScope,
      readMode: "segment",
      storyGenre,
      uiLocale: locale,
    });
  }, [novel, displayMeta?.displayTitle, initialChapterScope, locale]);

  function handleRegenerateCover() {
    if (!novel || coverRegenerating) return;
    setError("");
    setCoverRegenerating(true);
    coverRef.current?.regenerate();
  }

  if (loading) {
    return (
      <AppPageShell className="bg-[var(--gc-bg)] text-[var(--gc-text)]">
        <SiteHeader />
        <AppMain>
        <main className="px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
          <p className="text-[var(--gc-muted)]">{tc("loading")}</p>
        </main>
        </AppMain>
      </AppPageShell>
    );
  }

  if (error && !novel) {
    return (
      <AppPageShell className="bg-[var(--gc-bg)] text-[var(--gc-text)]">
        <SiteHeader />
        <AppMain>
        <main className="px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
          <p className="text-red-400">{error || t("notFoundShort")}</p>
        </main>
        </AppMain>
      </AppPageShell>
    );
  }

  if (!novel || !displayMeta) return null;

  const { displayTitle, blurb, chapters, isChildrenReader } = displayMeta;
  const stripTitles = [novel.title, displayTitle].filter(Boolean);
  const headerTitle = editing ? novel.title : displayTitle;
  const readPalette = NOVEL_READER_THEMES[readerTheme];

  const shellStyle =
    !editing ?
      ({
        ...novelReaderChromeCssVars(readPalette),
        backgroundColor: readPalette.bg,
      } as CSSProperties)
    : undefined;

  return (
    <AppPageShell className={`${editing ? "bg-[var(--gc-bg)]" : ""}`} style={shellStyle}>
      <SiteHeader />
      <AppMain>
      <div
        className="flex min-h-[100dvh] min-w-0 flex-col"
        style={!editing ? { backgroundColor: readPalette.bg } : undefined}
      >
        {!editing ? (
          <div className="mx-auto w-full max-w-6xl px-4 pt-4 lg:px-6">
            {novel.isOwner && novel.status === "draft_generating" ? (
              <NovelResumeBanner novelId={novel.id} title={novel.title} className="mb-4" />
            ) : null}
            <ResultMomentBanner
              mode="novel"
              title={displayTitle}
              subtitle={blurb ?? undefined}
              actions={
                <>
                  <WorkEngagementStats
                    kind="novel"
                    playCount={novel.playCount ?? 0}
                    likeCount={novel.likeCount ?? 0}
                    hideLikes
                    size="md"
                  />
                  <WorkLikeButton
                    kind="novel"
                    id={novel.id}
                    initialCount={novel.likeCount ?? 0}
                    variant="banner"
                  />
                  {novel.isOwner ? (
                    <PublishWorkButton
                      type="novel"
                      id={novel.id}
                      visibility={novel.visibility}
                      onVisibilityChange={(visibility) => setNovel((current) => current ? { ...current, visibility } : current)}
                    />
                  ) : null}
                  {novel.isOwner ? (
                    <button
                      type="button"
                      onClick={() => setComicSetupOpen(true)}
                      className="gc-theme-cta rounded-lg px-4 py-2 text-xs font-semibold"
                    >
                      {novel.comics.length > 0 ? t("regenerateStoryboard") : t("adaptStoryboard")}
                    </button>
                  ) : null}
                  {novel.comics.length > 0 ? (
                    <Link
                      href={withLocalePath(`/comic/${novel.comics[novel.comics.length - 1]!.id}`, locale)}
                      className="rounded-lg border border-[color:var(--gc-border)] px-3 py-2 text-xs font-medium text-[var(--gc-text-soft)] transition hover:border-[color:var(--gc-accent)]/40"
                    >
                      {t("viewLatestComic")}
                    </Link>
                  ) : null}
                  {novel.isOwner ? (
                    <button
                      type="button"
                      onClick={() => {
                        setRepairChapter(null);
                        setEditing(true);
                      }}
                      className="rounded-lg border border-[color:var(--gc-border)] px-3 py-2 text-xs font-medium text-[var(--gc-muted)] transition hover:text-[var(--gc-text)]"
                    >
                      {t("editContent")}
                    </button>
                  ) : null}
                </>
              }
            />
            {novel.isOwner ? <CreatorVersionStatus core={novel.creatorCore} work={{ type: "novel", id: novel.id }} className="mt-4" /> : null}
          </div>
        ) : null}
        <header
          className={`shrink-0 border-b ${editing ? "border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)]" : ""}`}
          style={
            !editing ?
              { borderColor: readPalette.border, backgroundColor: readPalette.panel }
            : undefined
          }
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3 lg:px-6">
            <NovelReadCoverThumb
              ref={coverRef}
              novelId={novel.id}
              coverPath={novel.coverPath}
              locale={locale}
              editing={editing}
              readPalette={readPalette}
              onCoverUpdate={(path) => {
                setNovel((prev) => (prev ? { ...prev, coverPath: path } : prev));
                setError("");
              }}
              onCoverFailed={() => setError(t("coverFailed"))}
              onRegenerateSettled={() => setCoverRegenerating(false)}
            />

            <div className="min-w-0 flex-1">
              <h1
                className={`line-clamp-2 text-lg font-bold leading-snug sm:text-xl ${editing ? "text-[var(--gc-text)]" : ""}`}
                style={!editing ? { color: readPalette.text } : undefined}
              >
                {headerTitle}
              </h1>
              <p
                className={`mt-1 text-xs ${editing ? "text-[var(--gc-muted)]" : ""}`}
                style={!editing ? { color: readPalette.muted } : undefined}
              >
                {editing ? t("editMode") : new Date(novel.createdAt).toLocaleDateString(locale)}
                {!editing && !isChildrenReader ? ` · ${t("chapterCount", { count: chapters.length })}` : null}
                {!editing && isChildrenReader ? ` · ${t("childrenShort")}` : null}
              </p>
              {!editing && blurb && (
                <NovelSynopsisBlurb text={blurb} mutedColor={readPalette.muted} />
              )}
            </div>

            <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto">
              {novel.isOwner && !editing && (
                <button
                  type="button"
                  onClick={() => {
                    setRepairChapter(null);
                    setEditing(true);
                  }}
                  className="rounded-lg border px-3 py-2 text-xs font-medium transition"
                  style={{
                    borderColor: `${readPalette.tocActive}55`,
                    color: readPalette.tocActive,
                    backgroundColor: `${readPalette.tocActive}12`,
                  }}
                >
                  {t("edit")}
                </button>
              )}
              {!editing && (
                <>
                  {novel.comics.map((c, idx) => (
                    <Link
                      key={c.id}
                      href={withLocalePath(`/comic/${c.id}`, locale)}
                      className="rounded-lg border px-3 py-2 text-xs font-medium transition"
                      style={{
                        borderColor: `${readPalette.tocActive}55`,
                        color: readPalette.tocActive,
                      }}
                    >
                      {novel.comics.length > 1 ? t("comicIndex", { index: idx + 1 }) : t("comic")}
                    </Link>
                  ))}
                  {novel.isOwner ? (
                    <button
                      type="button"
                      onClick={() => setComicSetupOpen((v) => !v)}
                      className="rounded-lg border px-3 py-2 text-xs font-medium transition"
                      style={{
                        borderColor: `${readPalette.tocActive}55`,
                        color: readPalette.tocActive,
                        backgroundColor: comicSetupOpen ? `${readPalette.tocActive}18` : undefined,
                      }}
                    >
                      {comicSetupOpen
                        ? t("hideComicOptions")
                        : novel.comics.length > 0
                          ? t("regenerateComic")
                          : t("generateComic")}
                    </button>
                  ) : null}
                  {novel.isOwner && novel.canContinue && (
                    <NovelContinueButton
                      novelId={novel.id}
                      initialContent={novel.content}
                      lengthTier={novel.lengthTier}
                      canContinue={Boolean(novel.canContinue)}
                      continuationReason={novel.continuationReason ?? t("continueLongForm")}
                      remainingChapterCount={novel.remainingChapterCount}
                      onCompleted={async (data) => {
                        setNovel((prev) =>
                          prev
                            ? {
                                ...prev,
                                content: data.content,
                                ...(data.summary !== undefined ? { summary: data.summary } : {}),
                              }
                            : prev,
                        );
                        setError("");
                        try {
                          const r = await fetch(`/api/novel/${encodeURIComponent(novel.id)}`);
                          const j = (await r.json()) as { novel?: Novel };
                          if (j.novel) setNovel(j.novel);
                        } catch {
                          /* 保留本地已更新正文 */
                        }
                      }}
                      onError={setError}
                      activeJob={novel.continueJob}
                      onQueued={(job) => {
                        setNovel((current) => current ? {
                          ...current,
                          continueJob: { ...job, attempts: 0, maxAttempts: 3, progress: { percent: 1, stage: "queued" } },
                        } : current);
                      }}
                      className="rounded-lg border px-3 py-2 text-xs font-medium transition disabled:opacity-50"
                      style={{
                        borderColor: `${readPalette.tocActive}88`,
                        color: readPalette.tocActive,
                        backgroundColor: `${readPalette.tocActive}18`,
                      }}
                    />
                  )}
                  {novel.isOwner && (
                    <button
                      type="button"
                      onClick={handleRegenerateCover}
                      disabled={coverRegenerating}
                      className="rounded-lg border px-3 py-2 text-xs font-medium transition disabled:opacity-50"
                      style={{
                        borderColor: readPalette.border,
                        color: readPalette.muted,
                      }}
                    >
                      {coverRegenerating ? t("coverGenerating") : t("regenerateCover")}
                    </button>
                  )}
                  <WorkShareBar
                    workType="novel"
                    workId={novel.id}
                    title={novel.title}
                    patchUrl={`/api/novel/${novel.id}`}
                    initialShareCode={novel.shareCode}
                  />
                </>
              )}
            </div>
          </div>
          {error && (
            <p className="mx-auto max-w-6xl px-4 pb-2 text-sm text-red-500 lg:px-6">{error}</p>
          )}
        </header>

        {!editing && novel.isOwner && novel.quality?.units?.length ? (
          <section className="mx-auto max-w-2xl px-4 pb-4 lg:px-6" data-testid="novel-chapter-quality">
            <div className="rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--gc-muted)]">{ts("qualityReview")}</p>
              <div className="mt-3 space-y-2">
                {novel.quality.units.map((unit) => {
                  const chapter = Number(unit.id.replace("chapter-", ""));
                  const needsRepair = unit.verdict !== "ready";
                  return (
                    <div key={unit.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[color:var(--gc-border)] px-3 py-2 text-xs">
                      <div className="min-w-0">
                        <span className={needsRepair ? "text-amber-300" : "text-emerald-400"}>
                          {unit.label} · {ts("qualityScore", { score: unit.score })}
                        </span>
                        {unit.evidence[0] ? <p className="mt-0.5 truncate font-mono text-[10px] text-[var(--gc-text-faint)]">{unit.evidence[0]}</p> : null}
                      </div>
                      {needsRepair && Number.isFinite(chapter) ? (
                        <button
                          type="button"
                          onClick={() => {
                            setRepairChapter(chapter);
                            setEditing(true);
                          }}
                          className="rounded-full border border-amber-400/35 bg-amber-400/10 px-3 py-1.5 font-medium text-amber-300 hover:bg-amber-400/15"
                        >
                          {ts("repairNow")}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        {!editing && novel.isOwner && novel.literaryEngagement ? (
          <CreatorConsumptionPanel summary={novel.literaryEngagement} className="mx-auto mb-4 max-w-2xl" />
        ) : null}

        {!editing && novel.isOwner && novel.chapterAdaptation ? (
          <div className="mx-auto max-w-2xl px-4 pb-3 lg:px-6">
            <ComicChapterAdaptationBanner
              progress={novel.chapterAdaptation}
              draftComics={novel.draftStoryboardComics}
              onContinueNext={(scope) => {
                setInitialChapterScope(scope);
                setResumeComicId(undefined);
                setComicSetupOpen(true);
              }}
              onResumeDraft={(comicId) => {
                setResumeComicId(comicId);
                setComicSetupOpen(true);
              }}
            />
          </div>
        ) : null}

        {!editing && comicSetupOpen && novel.isOwner ? (
          <div className="mx-auto max-w-2xl px-4 pb-4 lg:px-6">
            {adaptationPreview ? (
              <div className="mb-3">
                <LiteraryAdaptationTrustBadge info={adaptationPreview} compact />
              </div>
            ) : null}
            <ComicGeneratePanel
              novelId={novel.id}
              novelContent={novel.content}
              novelPrompt={novel.prompt}
              lengthTier={novel.lengthTier ?? undefined}
              initialChapterScope={initialChapterScope}
              resumeComicId={resumeComicId}
              label={novel.comics.length > 0 ? t("generateNewStoryboard") : t("startStoryboard")}
              onError={(msg) =>
                setError(
                  /unauthorized|forbidden|sign in|please log in|not logged|无权|未授权|请先登录/i.test(msg)
                    ? t("loginToAdapt")
                    : msg,
                )
              }
            />
          </div>
        ) : null}

        {!editing && novel.isOwner && !isChildrenReader ? (
          <div className="mx-auto max-w-2xl px-4 pb-3 lg:px-6">
            <NovelContinuityPanel report={novel.continuity} />
          </div>
        ) : null}

        {!editing && novel.isOwner && !isChildrenReader ? (
          <div className="mx-auto max-w-2xl px-4 pb-3 lg:px-6">
            <NovelStoryPlanPanel
              key={JSON.stringify(novel.storyPlan)}
              novelId={novel.id}
              initialBible={novel.storyPlan?.bible}
              initialChapterPlan={novel.storyPlan?.chapterPlan}
            />
          </div>
        ) : null}

        {!editing && novel.isOwner && !isChildrenReader ? (
          <div className="mx-auto max-w-2xl px-4 pb-6 lg:px-6">
            <NovelCharacterRosterPanel
              novelId={novel.id}
              isOwner={Boolean(novel.isOwner)}
              initialRoster={novel.characterRoster}
            />
          </div>
        ) : null}

        {editing ? (
          <NovelEditor
            novelId={novel.id}
            initialTitle={novel.title}
            initialContent={novel.content}
            initialFocusChapter={repairChapter}
            onSaved={(data) => {
              setNovel((prev) =>
                prev
                  ? {
                      ...prev,
                      title: data.title,
                      content: data.content,
                      ...(data.summary !== undefined ? { summary: data.summary } : {}),
                    }
                  : prev,
              );
              setEditing(false);
              setRepairChapter(null);
              setError("");
            }}
            onCancel={() => {
              setEditing(false);
              setRepairChapter(null);
            }}
          />
        ) : isChildrenReader ? (
          <ChildrenNovelReader
            content={novel.content}
            stripTitles={stripTitles}
            theme={readerTheme}
            onThemeChange={setReaderTheme}
          />
        ) : (
          <NovelReader
            workId={novel.id}
            content={novel.content}
            stripTitles={stripTitles}
            theme={readerTheme}
            onThemeChange={setReaderTheme}
          />
        )}
        <div className="mx-auto max-w-2xl px-4 pb-10 lg:px-6">
          <WorkCommentSection workType="novel" workId={novel.id} />
        </div>
      </div>
      </AppMain>
    </AppPageShell>
  );
}
