import fs from "node:fs/promises";
import path from "node:path";

const COVERS_DIR = path.join(process.cwd(), "public", "covers");

function extFromBuffer(buf: Buffer): "jpg" | "png" | "webp" {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8) return "jpg";
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf.length >= 12 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "webp";
  return "png";
}

/** 将文生图结果持久化到 public/covers/{novelId}.{ext}，返回站内可访问路径。 */
export async function persistNovelCoverFile(novelId: string, imageUrl: string): Promise<string | null> {
  try {
    let buf: Buffer;
    if (imageUrl.startsWith("/")) {
      const abs = path.join(process.cwd(), "public", imageUrl.replace(/^\//, ""));
      buf = await fs.readFile(abs);
    } else if (/^https?:\/\//i.test(imageUrl)) {
      const res = await fetch(imageUrl, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) return null;
      buf = Buffer.from(await res.arrayBuffer());
    } else {
      return null;
    }
    if (buf.length < 512) return null;

    const ext = extFromBuffer(buf);
    await fs.mkdir(COVERS_DIR, { recursive: true });
    const rel = `/covers/${novelId}.${ext}`;
    const abs = path.join(COVERS_DIR, `${novelId}.${ext}`);
    await fs.writeFile(abs, buf, { mode: 0o644 });
    return rel;
  } catch {
    return null;
  }
}

/** 直接写入已合成的封面 JPEG */
export async function persistNovelCoverBuffer(novelId: string, buf: Buffer): Promise<string | null> {
  try {
    if (buf.length < 512) return null;
    await fs.mkdir(COVERS_DIR, { recursive: true });
    const rel = `/covers/${novelId}.jpg`;
    const abs = path.join(COVERS_DIR, `${novelId}.jpg`);
    await fs.writeFile(abs, buf, { mode: 0o644 });
    return rel;
  } catch {
    return null;
  }
}

export async function deleteNovelCoverFile(novelId: string): Promise<void> {
  for (const ext of ["jpg", "png", "webp"] as const) {
    const abs = path.join(COVERS_DIR, `${novelId}.${ext}`);
    try {
      await fs.unlink(abs);
    } catch {
      /* ignore */
    }
  }
}
