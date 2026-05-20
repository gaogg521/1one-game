import fs from "node:fs/promises";
import path from "node:path";
import type { RuntimeReferencePayload } from "@/game/engine/runtime-reference-payload";
import type { ReferenceImageHandle } from "@/lib/assets/reference-image-storage.types";

const CACHE_ROOT = path.join(process.cwd(), "workspaces", "reference-ingest");

function extForMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  return "jpg";
}

/** 摄取时把参考图字节落在服务端，供 Godot 导出（不依赖浏览器 sessionStorage）。 */
export async function cacheIngestReferenceBuffer(
  refId: string,
  buffer: Buffer,
  mimeType: string,
): Promise<void> {
  const safe = refId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  if (!safe) return;
  await fs.mkdir(CACHE_ROOT, { recursive: true });
  const filePath = path.join(CACHE_ROOT, `${safe}.${extForMime(mimeType)}`);
  await fs.writeFile(filePath, buffer);
}

async function readCachedBuffer(refId: string): Promise<{ buffer: Buffer; mime: string } | null> {
  const safe = refId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  if (!safe) return null;
  for (const ext of ["png", "jpg", "jpeg", "webp", "gif"]) {
    const filePath = path.join(CACHE_ROOT, `${safe}.${ext}`);
    try {
      const buffer = await fs.readFile(filePath);
      const mime =
        ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/jpeg";
      return { buffer, mime };
    } catch {
      /* try next */
    }
  }
  return null;
}

type IngestHandleRef = Pick<ReferenceImageHandle, "refId" | "ordinal"> & { purpose?: string };

export async function loadReferencePayloadsFromIngestCache(
  handles: IngestHandleRef[] | undefined,
): Promise<RuntimeReferencePayload[]> {
  if (!handles?.length) return [];
  const out: RuntimeReferencePayload[] = [];
  for (const h of handles.slice(0, 8)) {
    const cached = await readCachedBuffer(h.refId);
    if (!cached) continue;
    const dataUrl = `data:${cached.mime};base64,${cached.buffer.toString("base64")}`;
    out.push({
      ordinal: h.ordinal,
      purpose: h.purpose ?? "",
      dataUrl,
    });
  }
  return out;
}

/** 合并客户端 session 像素与摄取服务端缓存（同 ordinal 优先 session）。 */
export function mergeReferencePayloads(
  primary: RuntimeReferencePayload[],
  secondary: RuntimeReferencePayload[],
): RuntimeReferencePayload[] {
  const byOrd = new Map<number, RuntimeReferencePayload>();
  for (const p of secondary) byOrd.set(p.ordinal, p);
  for (const p of primary) byOrd.set(p.ordinal, p);
  return [...byOrd.values()].sort((a, b) => a.ordinal - b.ordinal).slice(0, 8);
}
