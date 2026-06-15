import fs from "node:fs/promises";
import path from "node:path";
import { ApiKeyedError } from "@/lib/api/api-keyed-error";
import { loadSharp } from "@/lib/sharp-loader";
import { getBlobStore } from "@/lib/storage/blob-store";

const MAX_BYTES = 320_000;
const COVERS_DIR = path.join(process.cwd(), "public", "covers");

async function persistCoverJpeg(projectId: string, jpeg: Buffer): Promise<string> {
  const key = `covers/${projectId}.jpg`;
  const store = await getBlobStore();
  return store.put(key, jpeg, "image/jpeg");
}

/** 将 base64（可带 data:image/jpeg;base64, 前缀）写入 public/covers/{id}.jpg，返回公开路径。 */
export async function saveProjectCoverJpeg(projectId: string, raw: string): Promise<string> {
  const trimmed = raw.trim();
  const b64 = trimmed.includes(",") ? trimmed.split(",").pop()!.trim() : trimmed;
  if (b64.length < 80) {
    throw new ApiKeyedError("coverDataTooShort");
  }
  let buf: Buffer;
  try {
    buf = Buffer.from(b64, "base64");
  } catch {
    throw new ApiKeyedError("coverInvalidBase64");
  }
  if (buf.length < 512) {
    throw new ApiKeyedError("coverFileTooSmall");
  }
  if (buf.length > MAX_BYTES) {
    throw new ApiKeyedError("coverTooLarge");
  }
  if (buf[0] !== 0xff || buf[1] !== 0xd8) {
    throw new ApiKeyedError("coverJpegOnly");
  }
  return persistCoverJpeg(projectId, buf);
}

/** Comfy / 文生图返回的 PNG/JPEG 缓冲，统一落盘为 public/covers/{id}.jpg */
export async function saveProjectCoverFromBuffer(projectId: string, raw: Buffer): Promise<string> {
  if (raw.length < 512) {
    throw new ApiKeyedError("coverFileTooSmall");
  }
  if (raw.length > MAX_BYTES * 2) {
    throw new ApiKeyedError("coverTooLarge");
  }
  let jpeg: Buffer;
  try {
    const sharp = await loadSharp();
    jpeg = await sharp(raw).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
  } catch {
    throw new ApiKeyedError("coverImageProcessFailed");
  }
  if (jpeg.length > MAX_BYTES) {
    throw new ApiKeyedError("coverTooLarge");
  }
  return persistCoverJpeg(projectId, jpeg);
}

export function coverAbsPathFromPublicRel(rel: string): string {
  const clean = rel.replace(/^\//, "");
  return path.join(process.cwd(), "public", clean);
}

export async function copyProjectCoverFile(sourceProjectId: string, targetProjectId: string): Promise<string | null> {
  const src = path.join(process.cwd(), "public", "covers", `${sourceProjectId}.jpg`);
  const dst = path.join(process.cwd(), "public", "covers", `${targetProjectId}.jpg`);
  try {
    await fs.access(src);
  } catch {
    return null;
  }
  await fs.mkdir(COVERS_DIR, { recursive: true });
  await fs.copyFile(src, dst);
  return `/covers/${targetProjectId}.jpg`;
}

export async function deleteProjectCoverFile(projectId: string): Promise<void> {
  const abs = path.join(process.cwd(), "public", "covers", `${projectId}.jpg`);
  try {
    await fs.unlink(abs);
  } catch {
    /* 忽略不存在 */
  }
}
