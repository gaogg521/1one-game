import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const MAX_BYTES = 320_000;
const COVERS_DIR = path.join(process.cwd(), "public", "covers");

/** 将 base64（可带 data:image/jpeg;base64, 前缀）写入 public/covers/{id}.jpg，返回公开路径。 */
export async function saveProjectCoverJpeg(projectId: string, raw: string): Promise<string> {
  const trimmed = raw.trim();
  const b64 = trimmed.includes(",") ? trimmed.split(",").pop()!.trim() : trimmed;
  if (b64.length < 80) {
    throw new Error("封面数据过短");
  }
  let buf: Buffer;
  try {
    buf = Buffer.from(b64, "base64");
  } catch {
    throw new Error("封面不是有效的 Base64");
  }
  if (buf.length < 512) {
    throw new Error("封面文件过小");
  }
  if (buf.length > MAX_BYTES) {
    throw new Error("封面过大，请压缩后重试");
  }
  if (buf[0] !== 0xff || buf[1] !== 0xd8) {
    throw new Error("仅支持 JPEG 封面");
  }
  await fs.mkdir(COVERS_DIR, { recursive: true });
  const rel = `/covers/${projectId}.jpg`;
  const abs = path.join(process.cwd(), "public", "covers", `${projectId}.jpg`);
  await fs.writeFile(abs, buf, { mode: 0o644 });
  return rel;
}

/** Comfy / 文生图返回的 PNG/JPEG 缓冲，统一落盘为 public/covers/{id}.jpg */
export async function saveProjectCoverFromBuffer(projectId: string, raw: Buffer): Promise<string> {
  if (raw.length < 512) {
    throw new Error("封面文件过小");
  }
  if (raw.length > MAX_BYTES * 2) {
    throw new Error("封面过大");
  }
  let jpeg: Buffer;
  try {
    jpeg = await sharp(raw).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
  } catch {
    throw new Error("无法处理封面图像");
  }
  if (jpeg.length > MAX_BYTES) {
    throw new Error("封面过大，请压缩后重试");
  }
  await fs.mkdir(COVERS_DIR, { recursive: true });
  const rel = `/covers/${projectId}.jpg`;
  const abs = path.join(process.cwd(), "public", "covers", `${projectId}.jpg`);
  await fs.writeFile(abs, jpeg, { mode: 0o644 });
  return rel;
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
