import type { NovelChapter } from "@/lib/novel-chapters";
import { splitNovelParagraphs } from "@/lib/novel-paragraphs";

const MAX_CHUNK_LEN = 180;

/** 章节正文 → 适合朗读的连续文本 */
export function chapterBodyForTts(body: string): string {
  const paras = splitNovelParagraphs(body);
  const parts = (paras.length > 0 ? paras : [body.trim()])
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (parts.length === 0) return "";
  const joined = parts.join("。");
  return /[。！？!?]$/.test(joined) ? joined : `${joined}。`;
}

/** 按句号切分，避免单次 utterance 过长被浏览器截断 */
export function splitTextForTts(text: string): string[] {
  const normalized = text.replace(/\s+/g, "").trim();
  if (!normalized) return [];
  if (normalized.length <= MAX_CHUNK_LEN) return [normalized];

  const parts = normalized.split(/(?<=[。！？；.!?])/);
  const chunks: string[] = [];
  let buf = "";
  for (const part of parts) {
    if (!part) continue;
    if (buf.length + part.length > MAX_CHUNK_LEN && buf.length > 0) {
      chunks.push(buf);
      buf = part;
    } else {
      buf += part;
    }
  }
  if (buf) chunks.push(buf);
  return chunks.length > 0 ? chunks : [normalized.slice(0, MAX_CHUNK_LEN)];
}

export type TtsQueueItem = { text: string; chapterIndex: number };

export function buildNovelTtsQueue(chapters: NovelChapter[], fromChapterIndex: number): TtsQueueItem[] {
  const queue: TtsQueueItem[] = [];
  const start = Math.max(0, Math.min(fromChapterIndex, chapters.length - 1));

  for (let ci = start; ci < chapters.length; ci++) {
    const ch = chapters[ci]!;
    const intro = `第${ch.num}章，${ch.title}。`;
    const body = chapterBodyForTts(ch.body);
    const full = body ? `${intro}${body}` : intro;
    for (const text of splitTextForTts(full)) {
      queue.push({ text, chapterIndex: ci });
    }
  }
  return queue;
}

export function listChineseSpeechVoices(
  voices: SpeechSynthesisVoice[],
): { uri: string; name: string; lang: string }[] {
  return voices
    .filter((v) => v.lang.toLowerCase().startsWith("zh"))
    .map((v) => ({ uri: v.voiceURI, name: v.name, lang: v.lang }))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}

export function pickChineseSpeechVoice(
  voices: SpeechSynthesisVoice[],
  preferredUri?: string | null,
): SpeechSynthesisVoice | null {
  const zh = voices.filter((v) => v.lang.toLowerCase().startsWith("zh"));
  if (zh.length === 0) return null;
  if (preferredUri) {
    const hit = zh.find((v) => v.voiceURI === preferredUri);
    if (hit) return hit;
  }
  return (
    zh.find((v) => /zh-cn|大陆|中国|xiaoxiao|yunxi|kangkang/i.test(`${v.lang} ${v.name}`)) ??
    zh.find((v) => v.lang.toLowerCase() === "zh-cn") ??
    zh[0] ??
    null
  );
}

export function isBrowserTtsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}
