"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

type Comment = {
  id: string;
  nickname: string;
  content: string;
  createdAt: string;
  isOwn: boolean;
};

type Props = {
  workType: "game" | "novel" | "comic";
  workId: string;
};

function relativeTime(iso: string, t: ReturnType<typeof useTranslations<"workComment">>): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return t("justNow");
  if (mins < 60) return t("minutesAgo", { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("hoursAgo", { n: hours });
  return t("daysAgo", { n: Math.floor(hours / 24) });
}

export function WorkCommentSection({ workType, workId }: Props) {
  const t = useTranslations("workComment");
  const [comments, setComments] = useState<Comment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nickname, setNickname] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchComments = useCallback(async (cursor?: string) => {
    const params = new URLSearchParams({ workType, workId, limit: "20" });
    if (cursor) params.set("cursor", cursor);
    const res = await fetch(`/api/comments?${params.toString()}`);
    if (!res.ok) return;
    const data = (await res.json()) as { comments: Comment[]; nextCursor: string | null };
    setComments((prev) => (cursor ? [...prev, ...data.comments] : data.comments));
    setNextCursor(data.nextCursor);
  }, [workType, workId]);

  useEffect(() => {
    setLoading(true);
    setComments([]);
    setNextCursor(null);
    void fetchComments().finally(() => setLoading(false));
  }, [fetchComments]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    await fetchComments(nextCursor);
    setLoadingMore(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workType, workId, content: content.trim(), nickname: nickname.trim() }),
      });
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as { comment: Comment };
      setComments((prev) => [data.comment, ...prev]);
      setContent("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    } catch {
      setError(t("submitError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteComment(id: string) {
    if (!confirm(t("deleteConfirm"))) return;
    const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
    if (res.ok) setComments((prev) => prev.filter((c) => c.id !== id));
  }

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${e.target.scrollHeight}px`;
  }

  return (
    <section className="mt-8 border-t border-[color:var(--gc-border)] pt-6">
      <h3 className="mb-4 text-base font-semibold text-[var(--gc-text)]">
        {t("title")}
        {comments.length > 0 && (
          <span className="ml-2 text-sm font-normal text-[var(--gc-muted)]">({comments.length})</span>
        )}
      </h3>

      {/* Comment form */}
      <form onSubmit={(e) => void submit(e)} className="mb-6">
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder={t("nicknamePlaceholder")}
          maxLength={30}
          className="mb-2 w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-3 py-2 text-sm text-[var(--gc-text)] placeholder:text-[var(--gc-muted)] focus:border-[color:var(--gc-accent)] focus:outline-none"
        />
        <textarea
          ref={textareaRef}
          value={content}
          onChange={autoResize}
          placeholder={t("placeholder")}
          maxLength={500}
          rows={3}
          className="w-full resize-none rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-3 py-2 text-sm text-[var(--gc-text)] placeholder:text-[var(--gc-muted)] focus:border-[color:var(--gc-accent)] focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between">
          {error && <p className="text-xs text-red-400">{error}</p>}
          <span className="text-xs text-[var(--gc-muted)]">{content.length}/500</span>
          <button
            type="submit"
            disabled={!content.trim() || submitting}
            className="rounded-full bg-[var(--gc-accent)] px-5 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {submitting ? t("submitting") : t("submit")}
          </button>
        </div>
      </form>

      {/* Comment list */}
      {loading ? (
        <div className="flex justify-center py-6">
          <span className="text-sm text-[var(--gc-muted)]">{t("loading")}</span>
        </div>
      ) : comments.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--gc-muted)]">{t("empty")}</p>
      ) : (
        <ul className="space-y-4">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--gc-accent)]/20 text-sm font-medium text-[var(--gc-accent)]">
                {(c.nickname || t("guestName")).charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-[var(--gc-text)]">{c.nickname || t("guestName")}</span>
                  <span className="text-[11px] text-[var(--gc-muted)]">{relativeTime(c.createdAt, t)}</span>
                  {c.isOwn && (
                    <button
                      onClick={() => void deleteComment(c.id)}
                      className="ml-auto text-[11px] text-[var(--gc-muted)] hover:text-red-400"
                    >
                      {t("delete")}
                    </button>
                  )}
                </div>
                <p className="mt-1 break-words text-sm leading-relaxed text-[var(--gc-text-soft)]">
                  {c.content}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {nextCursor && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="rounded-full border border-[color:var(--gc-border)] px-5 py-2 text-sm text-[var(--gc-text-soft)] hover:border-[color:var(--gc-accent)]/40 disabled:opacity-50"
          >
            {loadingMore ? t("loading") : t("loadMore")}
          </button>
        </div>
      )}
    </section>
  );
}
