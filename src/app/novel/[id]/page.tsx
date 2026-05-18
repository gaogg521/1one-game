"use client";

import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { NovelReader } from "@/components/novel/NovelReader";
import { NovelEditor } from "@/components/novel/NovelEditor";
import { NovelSynopsisBlurb } from "@/components/novel/NovelSynopsisBlurb";
import { parseNovelChapters } from "@/lib/novel-chapters";
import { displayNovelSummary, normalizeNovelTitle } from "@/lib/novel-display";
import {
  NOVEL_READER_THEMES,
  novelReaderChromeCssVars,
  type NovelReaderThemeId,
} from "@/lib/novel-reader-theme";

interface Novel {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  prompt: string;
  coverPath: string | null;
  lengthTier: string | null;
  createdAt: string;
  comics: { id: string; title: string }[];
  shareCode: string | null;
  isOwner?: boolean;
}

function ShareButton({ novelId }: { novelId: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      const res = await fetch(`/api/novel/${novelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ensureShareCode: true }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { novel?: { shareCode?: string | null } };
      const code = data.novel?.shareCode;
      if (!code) return;
      const url = `${window.location.origin}/s/${code}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="rounded-lg border border-[color:var(--gc-border)] px-3 py-2 text-xs font-medium text-[var(--gc-muted)] transition hover:border-[color:var(--gc-accent)]/40 hover:text-[var(--gc-text)]"
    >
      {copied ? "已复制" : "分享"}
    </button>
  );
}

export default function NovelDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [novel, setNovel] = useState<Novel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [generatingComic, setGeneratingComic] = useState(false);
  const [coverLoading, setCoverLoading] = useState(false);
  const [coverRegenerating, setCoverRegenerating] = useState(false);
  const [readerTheme, setReaderTheme] = useState<NovelReaderThemeId>("paper");
  const coverRequested = useRef(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/novel/${encodeURIComponent(id as string)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.novel) setNovel(data.novel);
        else setError("小说不存在");
      })
      .catch(() => setError("加载失败"))
      .finally(() => setLoading(false));

    void fetch(`/api/novel/${encodeURIComponent(id as string)}/play`, { method: "POST" });
  }, [id]);

  useEffect(() => {
    if (!novel?.id || novel.coverPath || coverRequested.current || editing) return;
    coverRequested.current = true;
    setCoverLoading(true);
    void fetch(`/api/novel/${novel.id}/cover`, { method: "POST" })
      .then((r) => r.json())
      .then((data: { coverPath?: string; novel?: { coverPath?: string } }) => {
        const path = data.coverPath ?? data.novel?.coverPath;
        if (path) setNovel((prev) => (prev ? { ...prev, coverPath: path } : prev));
      })
      .finally(() => setCoverLoading(false));
  }, [novel?.id, novel?.coverPath, editing]);

  const displayMeta = useMemo(() => {
    if (!novel) return null;
    const displayTitle = normalizeNovelTitle(novel.title, novel.prompt);
    const blurb = displayNovelSummary(novel.summary, displayTitle, novel.prompt, novel.content);
    const chapters = parseNovelChapters(novel.content);
    return { displayTitle, blurb, chapters };
  }, [novel]);

  async function handleRegenerateCover() {
    if (!novel || coverRegenerating) return;
    setCoverRegenerating(true);
    setError("");
    try {
      const res = await fetch(`/api/novel/${novel.id}/cover?force=1`, { method: "POST" });
      const data = (await res.json()) as { coverPath?: string; error?: string };
      if (!res.ok) {
        setError(data.error || "封面生成失败");
        return;
      }
      if (data.coverPath) {
        setNovel((prev) => (prev ? { ...prev, coverPath: data.coverPath! } : prev));
        coverRequested.current = true;
      }
    } catch {
      setError("封面生成请求失败");
    } finally {
      setCoverRegenerating(false);
    }
  }

  async function handleGenerateComic() {
    if (!novel || generatingComic) return;
    setGeneratingComic(true);
    try {
      const res = await fetch("/api/comic/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novelId: novel.id }),
      });
      const ct = res.headers.get("content-type") ?? "";
      const data = ct.includes("application/json")
        ? ((await res.json()) as {
            error?: string;
            comic?: { id: string };
            imagesWarning?: string;
            panelsRendered?: number;
            panelCount?: number;
          })
        : {};
      if (!res.ok) {
        const msg = data.error || "漫画生成失败";
        setError(
          res.status === 403
            ? "当前账号与创建该小说时不一致，无法生成漫画。请用创作时的浏览器登录态，或在「我的小说」中打开自己的作品。"
            : msg,
        );
        return;
      }
      if (!data.comic?.id) {
        setError("服务端未返回漫画 ID");
        return;
      }
      const needsPanelRender =
        Boolean(data.imagesWarning) ||
        (typeof data.panelsRendered === "number" &&
          typeof data.panelCount === "number" &&
          data.panelsRendered < data.panelCount);
      router.push(
        needsPanelRender ? `/comic/${data.comic.id}?renderPanels=1` : `/comic/${data.comic.id}`,
      );
    } catch {
      setError("网络错误");
    } finally {
      setGeneratingComic(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-1 flex-col bg-[var(--gc-bg)] lg:flex-row">
        <SiteHeader />
        <main className="flex flex-1 px-6 py-10 lg:px-10">
          <p className="text-[var(--gc-muted)]">加载中…</p>
        </main>
      </div>
    );
  }

  if (error && !novel) {
    return (
      <div className="flex min-h-screen flex-1 flex-col bg-[var(--gc-bg)] lg:flex-row">
        <SiteHeader />
        <main className="flex flex-1 px-6 py-10 lg:px-10">
          <p className="text-red-400">{error || "未找到"}</p>
        </main>
      </div>
    );
  }

  if (!novel || !displayMeta) return null;

  const { displayTitle, blurb, chapters } = displayMeta;
  const stripTitles = [novel.title, displayTitle].filter(Boolean);
  const headerTitle = editing ? novel.title : displayTitle;
  const readPalette = NOVEL_READER_THEMES[readerTheme];

  const shellClass = "flex min-h-screen flex-1 flex-col lg:flex-row";
  const shellStyle =
    !editing ?
      ({
        ...novelReaderChromeCssVars(readPalette),
        backgroundColor: readPalette.bg,
      } as CSSProperties)
    : undefined;

  return (
    <div className={`${shellClass} ${editing ? "bg-[var(--gc-bg)]" : ""}`} style={shellStyle}>
      <SiteHeader />
      <div
        className="flex min-h-screen min-w-0 flex-1 flex-col"
        style={!editing ? { backgroundColor: readPalette.bg } : undefined}
      >
        <header
          className={`shrink-0 border-b ${editing ? "border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)]" : ""}`}
          style={
            !editing ?
              { borderColor: readPalette.border, backgroundColor: readPalette.panel }
            : undefined
          }
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3 lg:px-6">
            {novel.coverPath ? (
              <img
                src={novel.coverPath}
                alt=""
                className="h-[4.5rem] w-12 shrink-0 rounded-md object-cover shadow-sm"
                style={!editing ? { boxShadow: `0 0 0 1px ${readPalette.border}` } : undefined}
              />
            ) : coverLoading ? (
              <div
                className={`flex h-[4.5rem] w-12 shrink-0 items-center justify-center rounded-md text-[10px] ${editing ? "bg-[var(--gc-surface-glass)] text-[var(--gc-muted)]" : ""}`}
                style={
                  !editing ?
                    {
                      backgroundColor: `color-mix(in srgb, ${readPalette.text} 8%, transparent)`,
                      color: readPalette.muted,
                    }
                  : undefined
                }
              >
                封面
              </div>
            ) : null}

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
                {editing ? "编辑模式" : new Date(novel.createdAt).toLocaleDateString("zh-CN")} · 共{" "}
                {chapters.length} 章
              </p>
              {!editing && blurb && (
                <NovelSynopsisBlurb text={blurb} mutedColor={readPalette.muted} />
              )}
            </div>

            <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto">
              {novel.isOwner && !editing && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="rounded-lg border px-3 py-2 text-xs font-medium transition"
                  style={{
                    borderColor: `${readPalette.tocActive}55`,
                    color: readPalette.tocActive,
                    backgroundColor: `${readPalette.tocActive}12`,
                  }}
                >
                  编辑
                </button>
              )}
              {!editing && (
                <>
                  {novel.comics.length > 0 ? (
                    <Link
                      href={`/comic/${novel.comics[0].id}`}
                      className="rounded-lg border px-3 py-2 text-xs font-medium transition"
                      style={{
                        borderColor: `${readPalette.tocActive}55`,
                        color: readPalette.tocActive,
                      }}
                    >
                      查看漫画版
                    </Link>
                  ) : (
                    <button
                      onClick={handleGenerateComic}
                      disabled={generatingComic}
                      className="rounded-lg border px-3 py-2 text-xs font-medium transition disabled:opacity-50"
                      style={{
                        borderColor: `${readPalette.tocActive}55`,
                        color: readPalette.tocActive,
                      }}
                    >
                      {generatingComic ? "生成漫画中…" : "生成漫画"}
                    </button>
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
                      {coverRegenerating ? "封面生成中…" : "重做封面"}
                    </button>
                  )}
                  <ShareButton novelId={novel.id} />
                </>
              )}
            </div>
          </div>
          {error && (
            <p className="mx-auto max-w-6xl px-4 pb-2 text-sm text-red-500 lg:px-6">{error}</p>
          )}
        </header>

        {editing ? (
          <NovelEditor
            novelId={novel.id}
            initialTitle={novel.title}
            initialContent={novel.content}
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
              setError("");
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <NovelReader
            content={novel.content}
            stripTitles={stripTitles}
            theme={readerTheme}
            onThemeChange={setReaderTheme}
          />
        )}
      </div>
    </div>
  );
}
