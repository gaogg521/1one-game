"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ComicChapterScope } from "@/lib/comic-chapter-scope";
import type { ComicCharacterRoster } from "@/lib/comic-character-roster";
import type { ComicReadMode } from "@/lib/comic-format";
import {
  consumeComicGenerateStream,
  type ComicGenerateStreamEvent,
} from "@/lib/comic-generate-stream.client";

type Props = {
  novelId?: string;
  content?: string;
  title?: string;
  lengthTier?: string;
  pageCount?: number;
  stylePreset?: string;
  readMode?: ComicReadMode;
  chapterScope?: ComicChapterScope | null;
  characterRoster?: ComicCharacterRoster | null;
  label?: string;
  className?: string;
  style?: CSSProperties;
  onError?: (message: string) => void;
};

export function ComicGenerateButton({
  novelId,
  content,
  title,
  lengthTier,
  pageCount,
  stylePreset,
  readMode,
  chapterScope,
  characterRoster,
  label = "生成漫画",
  className,
  style,
  onError,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    setProgress("连接漫画生成服务…");
    onError?.("");

    const body: Record<string, unknown> = {};
    if (novelId) body.novelId = novelId;
    if (content) body.content = content;
    if (title) body.title = title;
    if (lengthTier) body.lengthTier = lengthTier;
    if (pageCount) body.pageCount = pageCount;
    if (stylePreset) body.stylePreset = stylePreset;
    if (readMode) body.readMode = readMode;
    if (chapterScope) body.chapterScope = chapterScope;
    if (characterRoster?.characters.length) body.characterRoster = characterRoster;

    const result = await consumeComicGenerateStream(body, (ev: ComicGenerateStreamEvent) => {
      if (ev.message) setProgress(ev.message);
    });

    setLoading(false);

    if (!result.ok) {
      onError?.(result.error);
      setProgress("");
      return;
    }

    setProgress("正在跳转…");
    router.push(
      result.needsPanelRender
        ? `/comic/${result.comicId}?renderPanels=1`
        : `/comic/${result.comicId}`,
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={className}
        style={style}
      >
        {loading ? progress || "生成中…" : label}
      </button>
    </div>
  );
}
