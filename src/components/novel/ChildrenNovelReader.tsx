"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { localizedReaderThemeLabel } from "@/lib/i18n/localized-data";
import {
  childrenInterpretSectionLabel,
  childrenParentReadingSectionLabel,
  childrenStorySectionLabel,
} from "@/lib/i18n/chapter-labels";
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
  palette,
  locale,
}: {
  theme: NovelReaderThemeId;
  onChange: (id: NovelReaderThemeId) => void;
  palette: NovelReaderPalette;
  locale: AppLocale;
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
            border: `1px solid ${theme === id ? palette.tocActive : palette.border}`,
            color: theme === id ? palette.tocActive : palette.muted,
            backgroundColor: theme === id ? `${palette.tocActive}18` : "transparent",
          }}
        >
          {localizedReaderThemeLabel(id, locale)}
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
  const tr = useTranslations("childrenReader");
  const locale = useLocale() as AppLocale;
  const parsed = useMemo(() => parseChildrenStoryOutput(content, undefined, locale), [content, locale]);
  const storyBody = useMemo(() => {
    let body = parsed.body;
    if (stripTitles.length) body = stripLeadingTitleFromBody(body, stripTitles);
    return body;
  }, [parsed.body, stripTitles]);

  const controlled = themeProp !== undefined && onThemeChange !== undefined;
  const theme = controlled ? themeProp! : "paper";
  const setTheme = controlled ? onThemeChange! : () => {};
  const palette = NOVEL_READER_THEMES[theme];

  const interpretLabel = childrenInterpretSectionLabel(locale);
  const storyLabel = childrenStorySectionLabel(locale, parsed.storyTitle);
  const closingLabel = childrenParentReadingSectionLabel(locale);

  return (
    <div className="novel-reader min-h-[calc(100vh-8rem)]" style={{ backgroundColor: palette.bg }}>
      <div className="sticky top-0 z-20 flex items-center justify-end gap-2 border-b px-4 py-2.5 lg:hidden"
        style={{ borderColor: palette.border, backgroundColor: palette.panel }}
      >
        <ThemePicker theme={theme} onChange={setTheme} palette={palette} locale={locale} />
      </div>

      <div className="mx-auto flex max-w-6xl gap-0 lg:gap-6 lg:px-6 lg:py-6">
        <aside className="hidden w-52 shrink-0 lg:block" style={{ color: palette.text }}>
          <div
            className="sticky top-20 rounded-xl border p-3"
            style={{ borderColor: palette.border, backgroundColor: palette.panel }}
          >
            <p className="mb-2 px-1 text-xs font-medium" style={{ color: palette.muted }}>
              {tr("structure")}
            </p>
            <ul className="space-y-1 text-xs" style={{ color: palette.text }}>
              <li>① {interpretLabel}</li>
              <li>② {storyLabel}</li>
              {parsed.parentReadingTip ? (
                <li>③ {closingLabel}</li>
              ) : null}
            </ul>
            <div className="mt-4 border-t pt-3" style={{ borderColor: palette.border }}>
              <p className="mb-2 px-1 text-xs" style={{ color: palette.muted }}>
                {tr("readingBg")}
              </p>
              <ThemePicker theme={theme} onChange={setTheme} palette={palette} locale={locale} />
            </div>
          </div>
        </aside>

        <article className="min-w-0 flex-1 pt-4 pb-16 lg:pt-0">
          <div
            className="mx-auto max-w-[42rem] rounded-none px-5 py-8 sm:px-10 sm:py-10 lg:rounded-2xl lg:shadow-sm"
            style={{ backgroundColor: palette.panel, color: palette.text }}
          >
            {parsed.interpretation ? (
              <section className="mb-12">
                <h2
                  className="mb-6 text-center text-base font-semibold tracking-wide sm:text-lg"
                  style={{ color: palette.tocActive }}
                >
                  {interpretLabel.replace(/【|】/g, "")}
                </h2>
                <ParagraphBlock text={parsed.interpretation} color={palette.text} />
              </section>
            ) : null}

            <section className={parsed.interpretation ? "border-t pt-10" : ""} style={parsed.interpretation ? { borderColor: palette.border } : undefined}>
              {parsed.storyTitle && parsed.storyTitle !== tr("unnamed") ? (
                <h1
                  className="mb-8 text-center text-xl font-bold tracking-wide sm:text-2xl"
                  style={{ color: palette.text }}
                >
                  {parsed.storyTitle}
                </h1>
              ) : null}
              <h2
                className="mb-6 text-center text-base font-semibold tracking-wide sm:text-lg"
                style={{ color: palette.tocActive }}
              >
                {storyLabel.replace(/【|】/g, "")}
              </h2>
              <ParagraphBlock text={storyBody} color={palette.text} />
            </section>

            {parsed.parentReadingTip ? (
              <section className="mt-12 border-t pt-10" style={{ borderColor: palette.border }}>
                <h2
                  className="mb-4 text-center text-sm font-medium"
                  style={{ color: palette.muted }}
                >
                  {closingLabel?.replace(/【|】/g, "") ?? tr("parentReading")}
                </h2>
                <p className="text-center text-[16px] leading-relaxed" style={{ color: palette.muted }}>
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
