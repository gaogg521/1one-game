"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { parseNovelChapters, type NovelChapter } from "@/lib/novel-chapters";
import { stripLeadingTitleFromBody } from "@/lib/novel-display";
import { splitNovelParagraphs } from "@/lib/novel-paragraphs";
import { NOVEL_READER_THEMES, type NovelReaderPalette, type NovelReaderThemeId } from "@/lib/novel-reader-theme";

interface NovelReaderProps {
  content: string;
  /** 用于剔除正文开头重复标题 */
  stripTitles?: string[];
  /** 受控：与页面顶栏、站点导航统一阅读配色 */
  theme?: NovelReaderThemeId;
  onThemeChange?: (id: NovelReaderThemeId) => void;
}

export function NovelReader({ content, stripTitles = [], theme: themeProp, onThemeChange }: NovelReaderProps) {
  const chapters = useMemo(() => {
    const parsed = parseNovelChapters(content);
    if (stripTitles.length === 0) return parsed;
    return parsed.map((ch) => ({
      ...ch,
      body: stripLeadingTitleFromBody(ch.body, stripTitles),
    }));
  }, [content, stripTitles]);

  const [internalTheme, setInternalTheme] = useState<NovelReaderThemeId>("paper");
  const controlled = themeProp !== undefined && onThemeChange !== undefined;
  const theme = controlled ? themeProp! : internalTheme;
  const setTheme = controlled ? onThemeChange! : setInternalTheme;
  const [activeId, setActiveId] = useState("");
  const [tocOpen, setTocOpen] = useState(false);
  const t = NOVEL_READER_THEMES[theme];

  useEffect(() => {
    if (chapters[0]?.id) setActiveId(chapters[0].id);
  }, [chapters]);

  const scrollToChapter = useCallback((ch: NovelChapter) => {
    const el = document.getElementById(ch.id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveId(ch.id);
    }
    setTocOpen(false);
  }, []);

  useEffect(() => {
    if (chapters.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target.id) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-15% 0px -65% 0px", threshold: [0, 0.2, 0.5] },
    );
    for (const ch of chapters) {
      const el = document.getElementById(ch.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [chapters]);

  return (
    <div className="novel-reader min-h-[calc(100vh-8rem)]" style={{ backgroundColor: t.bg }}>
      {/* 移动端顶栏 */}
      <div
        className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b px-4 py-2.5 lg:hidden"
        style={{ borderColor: t.border, backgroundColor: t.panel }}
      >
        <button
          type="button"
          onClick={() => setTocOpen(true)}
          className="rounded-md px-3 py-1.5 text-sm font-medium"
          style={{ border: `1px solid ${t.border}`, color: t.text }}
        >
          目录 · {chapters.length}
        </button>
        <ThemePicker theme={theme} onChange={setTheme} t={t} compact />
      </div>

      {tocOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/45 lg:hidden"
          onClick={() => setTocOpen(false)}
          role="presentation"
        >
          <nav
            className="absolute left-0 top-0 h-full w-[min(300px,88vw)] overflow-y-auto p-4 shadow-2xl"
            style={{ backgroundColor: t.panel, borderRight: `1px solid ${t.border}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 text-xs font-medium" style={{ color: t.muted }}>
              章节目录
            </p>
            <ChapterList
              chapters={chapters}
              activeId={activeId}
              tocActive={t.tocActive}
              muted={t.muted}
              onSelect={scrollToChapter}
            />
          </nav>
        </div>
      )}

      <div className="mx-auto flex max-w-6xl gap-0 lg:gap-6 lg:px-6 lg:py-6">
        {/* 桌面目录 */}
        <aside
          className="hidden w-52 shrink-0 lg:block"
          style={{ color: t.text }}
        >
          <div
            className="sticky top-20 rounded-xl border p-3"
            style={{ borderColor: t.border, backgroundColor: t.panel, maxHeight: "calc(100vh - 6rem)" }}
          >
            <p className="mb-2 px-1 text-xs font-medium" style={{ color: t.muted }}>
              目录 · {chapters.length} 章
            </p>
            <div className="max-h-[50vh] overflow-y-auto pr-1">
              <ChapterList
                chapters={chapters}
                activeId={activeId}
                tocActive={t.tocActive}
                muted={t.muted}
                onSelect={scrollToChapter}
              />
            </div>
            <div className="mt-4 border-t pt-3" style={{ borderColor: t.border }}>
              <p className="mb-2 px-1 text-xs" style={{ color: t.muted }}>
                阅读背景
              </p>
              <ThemePicker theme={theme} onChange={setTheme} t={t} />
            </div>
          </div>
        </aside>

        {/* 正文区 */}
        <article className="min-w-0 flex-1 pb-16 pt-4 lg:pt-0">
          <div
            className="mx-auto max-w-[42rem] rounded-none px-5 py-8 sm:px-10 sm:py-10 lg:rounded-2xl lg:shadow-sm"
            style={{ backgroundColor: t.panel, color: t.text }}
          >
            {chapters.length === 0 ? (
              <div className="whitespace-pre-wrap text-[18px] leading-[2]">{content}</div>
            ) : (
              chapters.map((ch, chIdx) => (
                <section
                  key={ch.id}
                  id={ch.id}
                  className={chIdx > 0 ? "mt-14 border-t pt-12" : ""}
                  style={chIdx > 0 ? { borderColor: t.border } : undefined}
                >
                  <h2
                    className="mb-8 text-center text-lg font-semibold tracking-wide sm:text-xl"
                    style={{ color: t.text }}
                  >
                    第{ch.num}章 {ch.title}
                  </h2>
                  <div className="space-y-6 text-[18px] leading-[2] tracking-[0.02em] sm:text-[19px]">
                    {(() => {
                      const paras = splitNovelParagraphs(ch.body);
                      return paras.length > 0 ? paras : ch.body.trim() ? [ch.body.trim()] : [];
                    })().map((para, idx) => (
                      <p key={idx} className="indent-[2em] text-justify">
                        {para}
                      </p>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </article>
      </div>
    </div>
  );
}

function ThemePicker({
  theme,
  onChange,
  t,
  compact,
}: {
  theme: NovelReaderThemeId;
  onChange: (k: NovelReaderThemeId) => void;
  t: NovelReaderPalette;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "flex gap-1" : "flex flex-col gap-1"}>
      {(Object.keys(NOVEL_READER_THEMES) as NovelReaderThemeId[]).map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={compact ? "rounded px-2 py-1 text-xs" : "rounded-lg px-2 py-1.5 text-left text-xs"}
          style={{
            backgroundColor: theme === k ? `${t.tocActive}22` : "transparent",
            color: theme === k ? t.tocActive : t.muted,
            fontWeight: theme === k ? 600 : 400,
          }}
        >
          {NOVEL_READER_THEMES[k].label}
        </button>
      ))}
    </div>
  );
}

function ChapterList({
  chapters,
  activeId,
  tocActive,
  muted,
  onSelect,
}: {
  chapters: NovelChapter[];
  activeId: string;
  tocActive: string;
  muted: string;
  onSelect: (ch: NovelChapter) => void;
}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {chapters.map((ch) => {
        const active = ch.id === activeId;
        return (
          <li key={ch.id}>
            <button
              type="button"
              onClick={() => onSelect(ch)}
              className="w-full rounded-lg px-2 py-2 text-left text-sm transition"
              style={{
                color: active ? tocActive : muted,
                fontWeight: active ? 600 : 400,
                backgroundColor: active ? `${tocActive}14` : "transparent",
              }}
            >
              <span className="line-clamp-2">
                第{ch.num}章 {ch.title}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
