"use client";

import { useMemo, useState } from "react";
import { parseNovelChapters } from "@/lib/novel-chapters";
import { NOVEL_TITLE_MAX_LEN, validateNovelTitleInput } from "@/lib/novel-display";

export interface ChapterEdit {
  num: number;
  title: string;
  body: string;
}

interface NovelEditorProps {
  novelId: string;
  initialTitle: string;
  initialContent: string;
  onSaved: (data: { title: string; content: string; summary?: string | null }) => void;
  onCancel: () => void;
}

export function NovelEditor({ novelId, initialTitle, initialContent, onSaved, onCancel }: NovelEditorProps) {
  const parsed = useMemo(() => parseNovelChapters(initialContent), [initialContent]);

  const [title, setTitle] = useState(() => {
    const t = initialTitle.trim();
    return t.length > NOVEL_TITLE_MAX_LEN ? t.slice(0, NOVEL_TITLE_MAX_LEN) : t;
  });
  const [chapters, setChapters] = useState<ChapterEdit[]>(() =>
    parsed.map((ch) => ({ num: ch.num, title: ch.title, body: ch.body })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateChapter(index: number, patch: Partial<ChapterEdit>) {
    setChapters((prev) => prev.map((ch, i) => (i === index ? { ...ch, ...patch } : ch)));
  }

  async function handleSave() {
    const tv = validateNovelTitleInput(title);
    if (!tv.ok) {
      setError(tv.error);
      return;
    }
    if (chapters.length === 0) {
      setError("至少保留一章内容");
      return;
    }
    for (const ch of chapters) {
      if (!ch.body.trim()) {
        setError(`第${ch.num}章正文不能为空`);
        return;
      }
    }

    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/novel/${novelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: tv.value,
          chapters: chapters.map((ch, i) => ({
            num: i + 1,
            title: ch.title.trim() || `第${i + 1}章`,
            body: ch.body,
          })),
        }),
      });
      const data = (await res.json()) as {
        novel?: { title?: string; content?: string; summary?: string | null };
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "保存失败");
        return;
      }
      onSaved({
        title: data.novel?.title ?? tv.value,
        content: data.novel?.content ?? initialContent,
        summary: data.novel?.summary,
      });
    } catch {
      setError("网络错误");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-6">
      <div className="mb-6 rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-5">
        <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--gc-muted)]">
          书名（{title.length}/{NOVEL_TITLE_MAX_LEN} 字）
        </label>
        <input
          type="text"
          value={title}
          maxLength={NOVEL_TITLE_MAX_LEN}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-bg)] px-4 py-2.5 text-lg font-semibold text-[var(--gc-text)] outline-none focus:border-[color:var(--gc-accent)]"
          placeholder="请输入书名"
        />
      </div>

      <div className="flex flex-col gap-6">
        {chapters.map((ch, idx) => (
          <section
            key={idx}
            className="rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-5"
          >
            <div className="mb-3 flex items-center gap-3">
              <span className="text-xs font-medium text-[var(--gc-muted)]">第 {idx + 1} 章</span>
              <input
                type="text"
                value={ch.title}
                onChange={(e) => updateChapter(idx, { title: e.target.value })}
                className="min-w-0 flex-1 rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-bg)] px-3 py-1.5 text-sm font-medium text-[var(--gc-text)] outline-none focus:border-[color:var(--gc-accent)]"
                placeholder="章节标题"
              />
            </div>
            <textarea
              value={ch.body}
              onChange={(e) => updateChapter(idx, { body: e.target.value })}
              rows={12}
              className="w-full resize-y rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-bg)] px-3 py-2 text-sm leading-relaxed text-[var(--gc-text)] outline-none focus:border-[color:var(--gc-accent)]"
              placeholder="章节正文…"
            />
          </section>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="gc-theme-cta rounded-xl px-6 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {saving ? "保存中…" : "保存修改"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-xl border border-[color:var(--gc-border)] px-6 py-2.5 text-sm text-[var(--gc-muted)] hover:text-[var(--gc-text)]"
        >
          取消
        </button>
      </div>
    </div>
  );
}
