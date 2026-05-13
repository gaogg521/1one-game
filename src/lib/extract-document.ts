import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

const MAX_CHARS = 48_000;

export function truncateDocText(s: string): string {
  const t = s.replace(/\u0000/g, "").trim();
  if (t.length <= MAX_CHARS) return t;
  return `${t.slice(0, MAX_CHARS)}\n…（已截断）`;
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  return truncateDocText(result.text ?? "");
}

export async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return truncateDocText(result.value ?? "");
}

export function extractUtf8Text(buffer: Buffer): string {
  return truncateDocText(buffer.toString("utf8"));
}
