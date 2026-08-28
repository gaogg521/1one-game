import { readLocalBlobIfExists } from "@/lib/storage/blob-store";
import { loadSharp } from "@/lib/sharp-loader";

const LOCAL_COVER_RE = /^\/covers\/[A-Za-z0-9._-]+$/i;

export function isLocalCoverPath(coverPath: string | null | undefined): boolean {
  const p = coverPath?.trim() ?? "";
  return LOCAL_COVER_RE.test(p.split("?")[0] ?? "");
}

export async function localCoverExists(coverPath: string): Promise<boolean> {
  const rel = coverPath.trim().split("?")[0]?.replace(/^\//, "") ?? "";
  if (!rel.startsWith("covers/")) return false;
  const buf = await readLocalBlobIfExists(rel);
  return Boolean(buf && buf.length >= 512);
}

async function remoteCoverLooksAlive(url: string): Promise<boolean> {
  try {
    const head = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(4_000) });
    if (head.ok) return true;
    if (head.status !== 405 && head.status !== 501) return false;
    const get = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-16" },
      signal: AbortSignal.timeout(4_000),
    });
    return get.ok || get.status === 206;
  } catch {
    return false;
  }
}

/**
 * DB 里有 coverPath 不等于文件还在：本地盘丢失、TOS 过期都应视为无封面。
 * 仅给封面 POST 使用，不要在列表页批量 HEAD。
 */
export async function isStoredCoverUsable(coverPath: string | null | undefined): Promise<boolean> {
  const p = coverPath?.trim() ?? "";
  if (!p) return false;
  const bare = p.split("?")[0] ?? p;
  if (bare.startsWith("/covers/")) return localCoverExists(bare);
  if (/^https?:\/\//i.test(bare)) return remoteCoverLooksAlive(bare);
  return false;
}

/**
 * Seedream / 部分文生图会把 C2PA Content Credentials 烧进左下角（白底十六进制块）。
 * `watermark: false` 挡不住这块；列表封面用邻域涂抹盖住，不改分镜原图。
 */
export async function stripGeneratorCornerMarks(buf: Buffer): Promise<Buffer> {
  try {
    const sharp = await loadSharp();
    const meta = await sharp(buf).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w < 64 || h < 64) return buf;
    const cw = Math.max(32, Math.round(w * 0.24));
    const ch = Math.max(24, Math.round(h * 0.16));
    const srcLeft = Math.min(w - 8, cw);
    const patchW = Math.max(8, Math.min(cw, w - srcLeft));
    const patch = await sharp(buf)
      .extract({ left: srcLeft, top: h - ch, width: patchW, height: ch })
      .blur(16)
      .resize(cw, ch)
      .toBuffer();
    return await sharp(buf)
      .composite([{ input: patch, left: 0, top: h - ch }])
      .jpeg({ quality: 90 })
      .toBuffer();
  } catch {
    return buf;
  }
}
