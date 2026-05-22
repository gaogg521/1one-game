"use client";

import { useMemo } from "react";
import { isChildrenFormattedNovelContent } from "@/lib/children-comic-sections";
import { parseChildrenStoryOutput } from "@/lib/children-story-output";

export { isChildrenFormattedNovelContent };
import { splitNovelParagraphs } from "@/lib/novel-paragraphs";
import { stripLeadingTitleFromBody } from "@/lib/novel-display";
import {
  NOVEL_READER_THEMES,
  type NovelReaderPalette,
  type NovelReaderThemeId,
} from "@/lib/novel-reader-theme";

interface ChildrenNovelReaderProps {
  content: string;
  stripTitles?: string[];
  theme?: NovelReaderThemeId;
  onThemeChange?: (id: NovelReaderThemeId) => void;
}

function ThemePicker({
  theme,
  onChange,
  t,
}: {
  theme: NovelReaderThemeId;
  onChange: (id: NovelReaderThemeId) => void;
  t: NovelReaderPalette;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.keys(NOVEL_READER_THEMES) as NovelReaderThemeId[]).map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className="rounded-md px-2 py-1 text-[11px] font-medium transition"
          style={{
            border: `1px solid ${theme === id ? t.tocActive : t.border}`,
            color: theme === id ? t.tocActive : t.muted,
            backgroundColor: theme === id ? `${t.tocActive}18` : "transparent",
          }}
        >
          {NOVEL_READER_THEMES[id].label}
        </button>
      ))}
    </div>
  );
}

function ParagraphBlock({ text, color }: { text: string; color: string }) {
  const paras = splitNovelParagraphs(text);
  const blocks = paras.length > 0 ? paras : text.trim() ? [text.trim()] : [];
  return (
    <div className="space-y-6 text-[18px] leading-[2] tracking-[0.02em] sm:text-[19px]">
      {blocks.map((para, idx) => (
        <p key={idx} className="indent-[2em] text-justify" style={{ color }}>
          {para}
        </p>
      ))}
    </div>
  );
}

export function ChildrenNovelReader({
  content,
  stripTitles = [],
  theme: themeProp,
  onThemeChange,
}: ChildrenNovelReaderProps) {
  const parsed = useMemo(() => parseChildrenStoryOutput(content), [content]);
  const storyBody = useMemo(() => {
    let body = parsed.body;
    if (stripTitles.length) body = stripLeadingTitleFromBody(body, stripTitles);
    return body;
  }, [parsed.body, stripTitles]);

  const controlled = themeProp !== undefined && onThemeChange !== undefined;
  const theme = controlled ? themeProp! : "paper";
  const setTheme = controlled ? onThemeChange! : () => {};
  const t = NOVEL_READER_THEMES[theme];

  const interpretLabel = content.match(/【[^】]*解读[^】]*】/)?.[0] ?? "创意解读";
  const storyLabel = content.match(/【[^】]*故事[^】]*】/)?.[0] ?? "儿童故事";
  const closingLabel = content.match(/【[^】]*(道理|共读|感悟|软语)[^】]*】/)?.[0];

  return (
    <div className="novel-reader min-h-[calc(100vh-8rem)]" style={{ backgroundColor: t.bg }}>
      <div className="sticky top-0 z-20 flex items-center justify-end gap-2 border-b px-4 py-2.5 lg:hidden"
        style={{ borderColor: t.border, backgroundColor: t.panel }}
      >
        <ThemePicker theme={theme} onChange={setTheme} t={t} />
      </div>

      <div className="mx-auto flex max-w-6xl gap-0 lg:gap-6 lg:px-6 lg:py-6">
        <aside className="hidden w-52 shrink-0 lg:block" style={{ color: t.text }}>
          <div
            className="sticky top-20 rounded-xl border p-3"
            style={{ borderColor: t.border, backgroundColor: t.panel }}
          >
            <p className="mb-2 px-1 text-xs font-medium" style={{ color: t.muted }}>
              本篇结构
            </p>
            <ul className="space-y-1 text-xs" style={{ color: t.text }}>
              <li>① {interpretLabel.replace(/【|】/g, "")}</li>
              <li>② {storyLabel.replace(/【|】/g, "")}</li>
              {parsed.parentReadingTip ? (
                <li>③ {closingLabel?.replace(/【|】/g, "") ?? "结尾"}</li>
              ) : null}
            </ul>
            <div className="mt-4 border-t pt-3" style={{ borderColor: t.border }}>
              <p className="mb-2 px-1 text-xs" style={{ color: t.muted }}>
                阅读背景
              </p>
              <ThemePicker theme={theme} onChange={setTheme} t={t} />
            </div>
          </div>
        </aside>

        <article className="min-w-0 flex-1 pt-4 pb-16 lg:pt-0">
          <div
            className="mx-auto max-w-[42rem] rounded-none px-5 py-8 sm:px-10 sm:py-10 lg:rounded-2xl lg:shadow-sm"
            style={{ backgroundColor: t.panel, color: t.text }}
          >
            {parsed.interpretation ? (
              <section className="mb-12">
                <h2
                  className="mb-6 text-center text-base font-semibold tracking-wide sm:text-lg"
                  style={{ color: t.tocActive }}
                >
                  {interpretLabel.replace(/【|】/g, "")}
                </h2>
                <ParagraphBlock text={parsed.interpretation} color={t.text} />
              </section>
            ) : null}

            <section className={parsed.interpretation ? "border-t pt-10" : ""} style={parsed.interpretation ? { borderColor: t.border } : undefined}>
              {parsed.storyTitle && parsed.storyTitle !== "未命名" ? (
                <h1
                  className="mb-8 text-center text-xl font-bold tracking-wide sm:text-2xl"
                  style={{ color: t.text }}
                >
                  {parsed.storyTitle}
                </h1>
              ) : null}
              <h2
                className="mb-6 text-center text-base font-semibold tracking-wide sm:text-lg"
                style={{ color: t.tocActive }}
              >
                {storyLabel.replace(/【|】/g, "")}
              </h2>
              <ParagraphBlock text={storyBody} color={t.text} />
            </section>

            {parsed.parentReadingTip ? (
              <section className="mt-12 border-t pt-10" style={{ borderColor: t.border }}>
                <h2
                  className="mb-4 text-center text-sm font-medium"
                  style={{ color: t.muted }}
                >
                  {closingLabel?.replace(/【|】/g, "") ?? "亲子共读"}
                </h2>
                <p className="text-center text-[16px] leading-relaxed" style={{ color: t.muted }}>
                  {parsed.parentReadingTip}
                </p>
              </section>
            ) : null}
          </div>
        </article>
      </div>
    </div>
  );
}
