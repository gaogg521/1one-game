import type { RuntimeReferencePayload } from "@/game/engine/runtime-reference-payload";

const KEY = "gc:refImagePayloads:v1";

/** 浏览器 sessionStorage 单 key 常见上限约 5MiB，无法通过代码「调大」；靠压缩与条数控制写入。 */
export const REFERENCE_SESSION_JSON_MAX_BYTES = 4_850_000;

/** 写入会话前：长边上限（对应常见「1080p」量级，即最长边 1920） */
export const REFERENCE_IMAGE_MAX_LONG_EDGE = 1920;

/** JPEG 质量（0–1），略压体积 */
export const REFERENCE_IMAGE_JPEG_QUALITY = 0.82;

/** 弹窗「再降画质」时的 JPEG 质量下限 */
export const REFERENCE_IMAGE_JPEG_QUALITY_MIN = 0.32;

/** 角色/敌军等贴片：居中收入方形精灵格的长边像素（越小越省 session，过大易超配额） */
export const REFERENCE_SPRITE_CELL_PX = 416;

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("read failed"));
    r.readAsDataURL(file);
  });
}

function loadHtmlImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load"));
    img.src = dataUrl;
  });
}

function dataUrlLooksLikeJpeg(dataUrl: string): boolean {
  return dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg");
}

/** PNG/WebP 等编码为浏览器支持的带透明格式（优先 WebP 压体积）；失败则用 PNG */
function rasterCanvasToPackedDataUrl(canvas: HTMLCanvasElement, webpQuality: number): string {
  const webp = canvas.toDataURL("image/webp", webpQuality);
  if (webp.startsWith("data:image/webp")) return webp;
  return canvas.toDataURL("image/png");
}

/**
 * 将「可走行单位 / 塔 / 主角」类参考图收进正方形精灵格：居中 contain，透明边，适配塔防贴片。
 */
export async function fitReferenceImageToSquareSpriteCell(dataUrl: string, cellPx: number): Promise<string | null> {
  if (!dataUrl.startsWith("data:image/")) return null;
  if (dataUrl.startsWith("data:image/svg+xml")) return null;
  const cell = Math.max(64, Math.min(768, Math.floor(cellPx)));
  try {
    const img = await loadHtmlImageFromDataUrl(dataUrl);
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (iw <= 0 || ih <= 0) return null;
    const canvas = document.createElement("canvas");
    canvas.width = cell;
    canvas.height = cell;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.clearRect(0, 0, cell, cell);
    const scale = Math.min(cell / iw, cell / ih);
    const dw = Math.max(1, Math.round(iw * scale));
    const dh = Math.max(1, Math.round(ih * scale));
    const ox = (cell - dw) / 2;
    const oy = (cell - dh) / 2;
    ctx.drawImage(img, ox, oy, dw, dh);
    return rasterCanvasToPackedDataUrl(canvas, 0.84);
  } catch {
    return null;
  }
}

/** 用途文本是否更应走「居中方形精灵」管线（≠ 整张地图背景） */
export function purposeSuggestsSpriteCell(purpose: string): boolean {
  const u = purpose.trim().toLowerCase();
  return (
    /怪|敌|小兵|野怪|mob|monster|creep|hazard|精英|enemy|invader/.test(u) ||
      /主角|玩家|守护者|水晶|萝卜|老家|能量核心|vip|protect|被保护|citadel|carry|npc|hero|道具|tower|炮台|防御塔|箭塔|炮塔|\bturret\b|\btower\b/.test(u)
  );
}

async function rasterDataUrlShrink(dataUrl: string, scale: number, jpegQuality: number): Promise<string | null> {
  if (scale <= 0.08 || scale > 1.001) return null;
  try {
    const img = await loadHtmlImageFromDataUrl(dataUrl);
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    if (w <= 12 || h <= 12) return null;
    w = Math.max(12, Math.round(w * scale));
    h = Math.max(12, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const opaqueJpeg = dataUrlLooksLikeJpeg(dataUrl);
    if (!opaqueJpeg) {
      ctx.clearRect(0, 0, w, h);
    }
    ctx.drawImage(img, 0, 0, w, h);

    if (opaqueJpeg) {
      const q = Math.min(1, Math.max(0.24, jpegQuality));
      return canvas.toDataURL("image/jpeg", q);
    }
    return rasterCanvasToPackedDataUrl(canvas, 0.78);
  } catch {
    return null;
  }
}

/** 将已有 data URL 做一轮瘦身：JPEG 降低质量；带透明格式则缩小画布（仍可保留 alpha）；SVG 原样返回 */
export async function recompressPayloadsJpegQuality(
  payloads: RuntimeReferencePayload[],
  quality: number,
): Promise<RuntimeReferencePayload[]> {
  const q = Math.min(1, Math.max(0.2, quality));
  const out: RuntimeReferencePayload[] = [];
  for (const p of payloads) {
    const { dataUrl } = p;
    if (!dataUrl.startsWith("data:") || dataUrl.startsWith("data:image/svg+xml")) {
      out.push(p);
      continue;
    }
    try {
      if (dataUrlLooksLikeJpeg(dataUrl)) {
        const img = await loadHtmlImageFromDataUrl(dataUrl);
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (w <= 0 || h <= 0) {
          out.push(p);
          continue;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          out.push(p);
          continue;
        }
        ctx.drawImage(img, 0, 0, w, h);
        out.push({ ...p, dataUrl: canvas.toDataURL("image/jpeg", q) });
      } else {
        const shrunk = await rasterDataUrlShrink(dataUrl, 0.9, q);
        out.push({ ...p, dataUrl: shrunk ?? dataUrl });
      }
    } catch {
      out.push(p);
    }
  }
  return out;
}

/**
 * 多轮降低 JPEG 质量，直到 JSON 体积低于上限或达到质量下限（仍超则由调用方继续删张或放弃）。
 */
export async function recompressPayloadsMultiPass(
  payloads: RuntimeReferencePayload[],
  maxBytes: number,
  minQuality = REFERENCE_IMAGE_JPEG_QUALITY_MIN,
): Promise<RuntimeReferencePayload[]> {
  let cur = payloads;
  let q = 0.78;
  for (let round = 0; round < 14; round += 1) {
    if (measureReferencePayloadsJsonLength(cur) <= maxBytes) return cur;
    cur = await recompressPayloadsJpegQuality(cur, q);
    q = Math.max(minQuality, q * 0.86);
    if (q <= minQuality + 0.001 && measureReferencePayloadsJsonLength(cur) > maxBytes) {
      cur = await recompressPayloadsJpegQuality(cur, minQuality);
      break;
    }
  }
  return cur;
}

export function measureReferencePayloadsJsonLength(payloads: RuntimeReferencePayload[]): number {
  try {
    return JSON.stringify(payloads).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export type WriteReferencePayloadsResult =
  | { ok: true }
  | { ok: false; kind: "oversize" | "quota"; jsonLen: number; maxBytes: number };

/** 不静默删张：仅当 JSON 未超上限且 setItem 成功时写入 */
export function writeReferencePayloadsToSessionStrict(
  payloads: RuntimeReferencePayload[],
  maxBytes = REFERENCE_SESSION_JSON_MAX_BYTES,
): WriteReferencePayloadsResult {
  if (typeof window === "undefined") {
    return { ok: false, kind: "quota", jsonLen: 0, maxBytes };
  }
  if (!payloads.length) {
    try {
      window.sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    return { ok: true };
  }
  const jsonLen = measureReferencePayloadsJsonLength(payloads);
  if (jsonLen > maxBytes) {
    return { ok: false, kind: "oversize", jsonLen, maxBytes };
  }
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(payloads));
    return { ok: true };
  } catch (e) {
    const isQuota =
      (typeof DOMException !== "undefined" && e instanceof DOMException && e.name === "QuotaExceededError") ||
      (e instanceof Error && /quota/i.test(e.message));
    return { ok: false, kind: isQuota ? "quota" : "quota", jsonLen, maxBytes };
  }
}

/** 从末尾删除 n 张并重新编号 ordinal */
export function dropLastPayloadsRenumber(
  payloads: RuntimeReferencePayload[],
  count: number,
): RuntimeReferencePayload[] {
  const n = Math.max(0, Math.min(payloads.length, Math.floor(count)));
  if (n <= 0) return payloads;
  const sliced = payloads.slice(0, payloads.length - n);
  return sliced.map((p, i) => ({ ...p, ordinal: i + 1 }));
}

/**
 * 默认写入策略：先尝试原样写入 → 多轮降 JPEG 画质 → 仍失败则每次删末尾 1 张并再压画质，直到写入成功或删光。
 */
export async function autoFitAndWriteReferencePayloadsToSession(
  initialPayloads: RuntimeReferencePayload[],
  maxBytes = REFERENCE_SESSION_JSON_MAX_BYTES,
): Promise<{
  saved: RuntimeReferencePayload[];
  removedCount: number;
  qualityReduced: boolean;
}> {
  const originalCount = initialPayloads.length;
  if (originalCount === 0) {
    void writeReferencePayloadsToSessionStrict([]);
    return { saved: [], removedCount: 0, qualityReduced: false };
  }

  let p = initialPayloads;
  let qualityReduced = false;

  const runMultiPass = async (inputs: RuntimeReferencePayload[]) => {
    const before = measureReferencePayloadsJsonLength(inputs);
    const next = await recompressPayloadsMultiPass(inputs, maxBytes);
    if (measureReferencePayloadsJsonLength(next) < before) qualityReduced = true;
    return next;
  };

  let wr = writeReferencePayloadsToSessionStrict(p, maxBytes);
  if (wr.ok) {
    return { saved: p, removedCount: 0, qualityReduced: false };
  }

  p = await runMultiPass(p);
  wr = writeReferencePayloadsToSessionStrict(p, maxBytes);
  if (wr.ok) {
    return { saved: p, removedCount: originalCount - p.length, qualityReduced };
  }

  const maxDropIterations = originalCount + 12;
  let safety = 0;
  while (p.length > 0 && safety < maxDropIterations) {
    safety += 1;
    p = dropLastPayloadsRenumber(p, 1);
    p = await runMultiPass(p);
    wr = writeReferencePayloadsToSessionStrict(p, maxBytes);
    if (wr.ok) {
      return {
        saved: p,
        removedCount: originalCount - p.length,
        qualityReduced,
      };
    }
  }

  void writeReferencePayloadsToSessionStrict([]);
  return {
    saved: [],
    removedCount: originalCount,
    qualityReduced,
  };
}

/**
 * 会话用参考图缩放：JPEG 仍为 JPEG（无透明度）；PNG/WebP/GIF 等在透明画布上绘制并输出 WebP→PNG，
 * **不再**铺满白底后转 JPEG（那会抹掉 Alpha，塔防贴片周围出现整块白矩形）。
 */
export async function compressReferenceImageToSessionDataUrl(
  file: File,
  options?: { maxLongEdge?: number; quality?: number },
): Promise<string> {
  const maxLongEdge = options?.maxLongEdge ?? REFERENCE_IMAGE_MAX_LONG_EDGE;
  let quality = options?.quality ?? REFERENCE_IMAGE_JPEG_QUALITY;

  if (typeof createImageBitmap !== "function") {
    return fileToDataUrl(file);
  }

  const mime = (file.type || "").toLowerCase();
  const isJpeg = mime === "image/jpeg" || mime === "image/jpg";

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return fileToDataUrl(file);
  }

  try {
    let { width, height } = bitmap;
    const long = Math.max(width, height);
    if (long > maxLongEdge) {
      const s = maxLongEdge / long;
      width = Math.max(1, Math.round(width * s));
      height = Math.max(1, Math.round(height * s));
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return fileToDataUrl(file);
    }

    if (isJpeg) {
      ctx.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const url = canvas.toDataURL("image/jpeg", quality);
        if (url.length <= 900_000 || attempt >= 3) return url;
        quality = Math.max(0.45, quality * 0.72);
      }
      return canvas.toDataURL("image/jpeg", 0.45);
    }

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return rasterCanvasToPackedDataUrl(canvas, Math.min(0.9, quality + 0.04));
  } catch {
    try {
      bitmap.close();
    } catch {
      /* ignore */
    }
    return fileToDataUrl(file);
  }
}

/** @deprecated 使用 compressReferenceImageToSessionDataUrl；历史上该实现曾错误地为 PNG 铺白底。 */
export const compressImageToJpegDataUrl = compressReferenceImageToSessionDataUrl;

/** 与 /api/ingest 提交顺序一致：先「选择文件」列表，再剪贴板行 */
export function buildIngestFileOrder(fileList: FileList | null, pasted: { file: File; purpose: string }[]): {
  file: File;
  purpose: string;
}[] {
  const out: { file: File; purpose: string }[] = [];
  if (fileList?.length) {
    for (let i = 0; i < fileList.length; i += 1) {
      const f = fileList.item(i);
      if (f) out.push({ file: f, purpose: "" });
    }
  }
  for (const row of pasted) {
    out.push({ file: row.file, purpose: row.purpose });
  }
  return out;
}

/**
 * 生成可写入 session 的 payload：长边缩放 +（JPEG→JPEG | 带 Alpha→WebP/PNG）；单位图可选居中方形精灵格。
 */
export async function buildRuntimePayloadsFromIngestOrder(
  ordered: { file: File; purpose: string }[],
  maxOriginalBytes = 16 * 1024 * 1024,
): Promise<RuntimeReferencePayload[]> {
  const payloads: RuntimeReferencePayload[] = [];
  let ord = 0;
  for (const row of ordered) {
    const { file, purpose } = row;
    if (!file.type.startsWith("image/")) continue;
    if (file.size > maxOriginalBytes) continue;
    ord += 1;
    let dataUrl =
      file.type === "image/svg+xml"
        ? await fileToDataUrl(file)
        : await compressReferenceImageToSessionDataUrl(file, {
            maxLongEdge: REFERENCE_IMAGE_MAX_LONG_EDGE,
            quality: REFERENCE_IMAGE_JPEG_QUALITY,
          });

    const cell =
      purposeSuggestsSpriteCell(purpose) && !file.type.includes("svg")
        ? await fitReferenceImageToSquareSpriteCell(dataUrl, REFERENCE_SPRITE_CELL_PX)
        : null;
    if (cell) dataUrl = cell;

    payloads.push({ ordinal: ord, purpose, dataUrl });
  }
  return payloads;
}

/** @deprecated 请使用 writeReferencePayloadsToSessionStrict / autoFitAndWriteReferencePayloadsToSession；保留为兼容旧调用 */
export function saveReferenceImagePayloadsToSession(payloads: RuntimeReferencePayload[]): void {
  void writeReferencePayloadsToSessionStrict(payloads);
}

export function readReferenceImagePayloadsFromSession(): RuntimeReferencePayload[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is RuntimeReferencePayload =>
        x &&
        typeof x === "object" &&
        typeof (x as RuntimeReferencePayload).ordinal === "number" &&
        typeof (x as RuntimeReferencePayload).purpose === "string" &&
        typeof (x as RuntimeReferencePayload).dataUrl === "string" &&
        (x as RuntimeReferencePayload).dataUrl.startsWith("data:"),
    );
  } catch {
    return [];
  }
}

export function clearReferenceImagePayloadsSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
