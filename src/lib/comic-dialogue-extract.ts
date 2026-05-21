import type { ComicPage } from "@/lib/comic-format";
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

/** LLM 漏标时：用段落对白补全占位格 */
export function enrichPagesFromSegmentDialogues(
  pages: ComicPage[],
  segments: NovelStorySegment[],
): ComicPage[] {
  const segMap = new Map(segments.map((s) => [s.index, s]));
  let dialogueCursor = new Map<number, number>();

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
