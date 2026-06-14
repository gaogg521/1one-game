import type { ComicPage } from "@/lib/comic-format";
import { isPlaceholderComicPanel } from "@/lib/comic-panel-prompt-urban";
import type { NovelStorySegment } from "@/lib/comic-storyboard-segments";

export type ExtractedDialogue = {
  speaker?: string;
  line: string;
};

/** 从段落正文提取对白（「」、“” 与「xxx说」） */
export function extractDialoguesFromText(text: string): ExtractedDialogue[] {
  const out: ExtractedDialogue[] = [];
  const seen = new Set<string>();

  const patterns: RegExp[] = [
    /([\u4e00-\u9fa5A-Za-z0-9·]{1,8})[：:]\s*[「“]([^」”]{1,80})[」”]/g,
    /[「“]([^」”]{1,80})[」”]/g,
  ];

  for (const re of patterns) {
    let m: RegExpExecArray | null;
    const r = new RegExp(re.source, re.flags);
    while ((m = r.exec(text)) !== null) {
      const speaker = m.length > 2 ? m[1]?.trim() : undefined;
      const line = (m.length > 2 ? m[2] : m[1])?.trim();
      if (!line || line.length < 1) continue;
      const key = `${speaker ?? ""}|${line}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ...(speaker ? { speaker } : {}), line });
      if (out.length >= 12) return out;
    }
  }
  return out;
}

export function formatDialogueHintsForSegment(segment: NovelStorySegment): string {
  const lines = extractDialoguesFromText(segment.text);
  if (lines.length === 0) return "";
  return lines
    .map((d, i) => `${i + 1}. ${d.speaker ? `${d.speaker}：` : ""}「${d.line}」`)
    .join("\n");
}

function stripSegmentBoilerplate(text: string): string {
  return text
    .replace(/^#+\s*.+$/gm, "")
    .replace(/^={2,}\s*.+?={2,}\s*$/gm, "")
    .replace(/^第[0-9零一二三四五六七八九十百千两]+章\s*.+$/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function excerptNarration(text: string, maxLen = 52): string {
  const clean = stripSegmentBoilerplate(text).replace(/[「」“”]/g, "").trim();
  if (!clean) return "";
  const sentence = clean.split(/(?<=[。！？!?])/)[0]?.trim() || clean;
  return sentence.slice(0, maxLen);
}

/** 为分镜格按顺序绑定小说段落索引（LLM 未填 sourceSegmentIndex 时） */
export function assignSourceSegmentIndicesToPages(
  pages: ComicPage[],
  segments: NovelStorySegment[],
): ComicPage[] {
  if (segments.length === 0) return pages;
  const flat = pages.flatMap((p) => p.panels);
  const total = flat.length;
  let cursor = 0;

  return pages.map((page) => ({
    ...page,
    panels: page.panels.map((panel) => {
      const idx = cursor++;
      const segIdx = Math.min(
        segments.length - 1,
        Math.floor((idx / Math.max(1, total)) * segments.length),
      );
      if (panel.sourceSegmentIndex !== undefined) return panel;
      return { ...panel, sourceSegmentIndex: segIdx };
    }),
  }));
}

/** 对白补完后仍占位：用段落旁白摘录填充 narration 格 */
export function enrichPagesFromSegmentNarration(
  pages: ComicPage[],
  segments: NovelStorySegment[],
): ComicPage[] {
  const segMap = new Map(segments.map((s) => [s.index, s]));
  return pages.map((page) => ({
    ...page,
    panels: page.panels.map((panel) => {
      if (!isPlaceholderComicPanel(panel)) return panel;
      const idx = panel.sourceSegmentIndex;
      if (idx === undefined || !segMap.has(idx)) return panel;
      const excerpt = excerptNarration(segMap.get(idx)!.text);
      if (!excerpt) return panel;
      return {
        ...panel,
        textType: panel.textType ?? "narration",
        caption: excerpt,
        sceneDescriptionEn:
          panel.sceneDescriptionEn?.trim() ||
          segMap.get(idx)!.text.slice(0, 160).replace(/\n/g, " "),
      };
    }),
  }));
}

export function comicPagesAreAllPlaceholders(pages: ComicPage[]): boolean {
  const panels = pages.flatMap((p) => p.panels);
  if (panels.length === 0) return true;
  return panels.every((p) => isPlaceholderComicPanel(p));
}

/** 绑定段落 → 对白回填 → 旁白回填（pipeline 与 generate-run 共用） */
export function enrichPagesFromNovelSegments(
  pages: ComicPage[],
  segments: NovelStorySegment[],
): ComicPage[] {
  if (segments.length === 0) return pages;
  let next = assignSourceSegmentIndicesToPages(pages, segments);
  next = enrichPagesFromSegmentDialogues(next, segments);
  next = enrichPagesFromSegmentNarration(next, segments);
  return next;
}

/** LLM 漏标时：用段落对白补全占位格 */
export function enrichPagesFromSegmentDialogues(
  pages: ComicPage[],
  segments: NovelStorySegment[],
): ComicPage[] {
  const segMap = new Map(segments.map((s) => [s.index, s]));
  const dialogueCursor = new Map<number, number>();

  return pages.map((page) => ({
    ...page,
    panels: page.panels.map((panel) => {
      const idx = panel.sourceSegmentIndex;
      if (idx === undefined || !segMap.has(idx)) return panel;
      const seg = segMap.get(idx)!;
      const dialogues = extractDialoguesFromText(seg.text);
      if (dialogues.length === 0) return panel;

      const cap = panel.caption?.trim() ?? "";
      const isPlaceholder = !cap || cap === "……" || cap.endsWith("（续）");
      if (!isPlaceholder && panel.textType === "dialogue") return panel;

      const cursor = dialogueCursor.get(idx) ?? 0;
      const d = dialogues[cursor % dialogues.length]!;
      dialogueCursor.set(idx, cursor + 1);

      if (isPlaceholder || panel.textType !== "dialogue") {
        return {
          ...panel,
          textType: "dialogue" as const,
          speaker: d.speaker ?? panel.speaker,
          caption: d.line.slice(0, 48),
        };
      }
      return panel;
    }),
  }));
}
