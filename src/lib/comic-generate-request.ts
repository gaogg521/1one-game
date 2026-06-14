import type { ComicChapterScope } from "@/lib/comic-chapter-scope";
import type { ComicCharacterRoster } from "@/lib/comic-character-roster";
import type { ComicReadMode } from "@/lib/comic-format";
import type { NovelBriefUserRevision, NovelCreativeBrief } from "@/lib/literary-brief";
import type { ComicSourceMode } from "@/lib/comic-pipeline-mode";

/** POST /api/comic/generate/stream 请求体（客户端与服务端共享字段） */
export type ComicGenerateStreamBody = {
  sourceMode?: ComicSourceMode;
  novelId?: string;
  content?: string;
  creativePrompt?: string;
  creativeBrief?: NovelCreativeBrief;
  briefRevision?: NovelBriefUserRevision;
  title?: string;
  pageCount?: number;
  layoutId?: string;
  lengthTier?: string;
  stylePreset?: string;
  readMode?: ComicReadMode;
  chapterScope?: ComicChapterScope | null;
  characterRoster?: ComicCharacterRoster | null;
  resumeComicId?: string;
  forceLightStoryboard?: boolean;
};
