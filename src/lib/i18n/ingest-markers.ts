import type { AppLocale } from "@/i18n/routing";
import { locales } from "@/i18n/routing";
import { formatMessage } from "@/lib/i18n/format-message";
import { getMessageValue, getMessages, tMessage } from "@/lib/i18n/messages";

function marker(locale: AppLocale, key: string): string {
  return tMessage(locale, `ingestMarkers.${key}`);
}

export function ingestMaterialHeader(locale: AppLocale): string {
  return marker(locale, "materialHeader");
}

export function ingestImageLinePrefix(locale: AppLocale): string {
  return marker(locale, "imageLinePrefix");
}

export function ingestImageCaption(
  locale: AppLocale,
  ordinal: number,
  role: string,
  body?: string,
): string {
  const head = formatMessage(marker(locale, "imageCaptionHead"), {
    ordinal: String(ordinal),
    role,
  });
  return body ? `${head}\n${body}` : head;
}

export function ingestImageCaptionStub(
  locale: AppLocale,
  key: "missingKey" | "visionOff",
  ordinal: number,
  role: string,
  fileName: string,
): string {
  return formatMessage(marker(locale, `imageCaption${key === "missingKey" ? "MissingKey" : "VisionOff"}`), {
    ordinal: String(ordinal),
    role,
    name: fileName,
  });
}

export function ingestWebChunk(
  locale: AppLocale,
  title: string | null | undefined,
  url: string,
  text: string,
): string {
  const head = title
    ? formatMessage(marker(locale, "webWithTitle"), { title })
    : formatMessage(marker(locale, "webUrlOnly"), { url });
  return `${head}${text}`;
}

export function ingestPdfChunk(locale: AppLocale, name: string, text: string): string {
  return `${formatMessage(marker(locale, "pdfHead"), { name })}\n${text}`;
}

export function ingestDocxChunk(locale: AppLocale, name: string, text: string): string {
  return `${formatMessage(marker(locale, "docxHead"), { name })}\n${text}`;
}

export function ingestTextChunk(locale: AppLocale, name: string, text: string): string {
  return `${formatMessage(marker(locale, "textHead"), { name })}\n${text}`;
}

export function ingestImageNumberLegend(locale: AppLocale): string {
  return marker(locale, "imageNumberLegend");
}

export function mergeReferenceBlockIntoPrompt(locale: AppLocale, head: string, block: string): string {
  const t = head.trim();
  const header = ingestMaterialHeader(locale);
  const piece = t ? `\n\n---\n${header}\n${block}` : `${header}\n${block}`;
  return `${t}${piece}`.slice(0, 4000);
}

function allMaterialHeaders(): string[] {
  return locales.map((loc) => ingestMaterialHeader(loc));
}

export function extractReferenceMaterialSection(locale: AppLocale, merged: string): string {
  for (const header of [...new Set([ingestMaterialHeader(locale), ...allMaterialHeaders()])]) {
    const i = merged.indexOf(header);
    if (i >= 0) return merged.slice(i + header.length).trim();
  }
  return "";
}

export function splitReferenceImageCaptions(locale: AppLocale, section: string): string[] {
  if (!section.trim()) return [];
  const prefixes = [...new Set([ingestImageLinePrefix(locale), ...locales.map(ingestImageLinePrefix)])];
  const chunks: string[] = [];
  for (const prefix of prefixes) {
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = section
      .split(new RegExp(`(?=${escaped}\\d+)`, "g"))
      .map((s) => s.trim())
      .filter((s) => prefixes.some((p) => s.startsWith(p)));
    if (parts.length > chunks.length) chunks.splice(0, chunks.length, ...parts);
  }
  return chunks;
}

export function findReferenceMaterialIndex(locale: AppLocale, merged: string): number {
  let best = -1;
  for (const header of allMaterialHeaders()) {
    const i = merged.indexOf(header);
    if (i >= 0 && (best < 0 || i < best)) best = i;
  }
  return best;
}

export function getIngestPurposeFallback(locale: AppLocale): string {
  return getMessageValue(getMessages(locale), "ingestWarnings.purposeUnlabeled") ?? "Unlabeled";
}
