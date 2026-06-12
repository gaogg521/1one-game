import { NextResponse } from "next/server";
import JSZip from "jszip";
import {
  extractDocxText,
  extractPdfText,
  extractUtf8Text,
  truncateDocText,
} from "@/lib/extract-document";
import { fetchUrlPlainText } from "@/lib/fetch-url-text";
import { getReferenceImageStorage } from "@/lib/assets/reference-image-storage.factory";
import { cacheIngestReferenceBuffer } from "@/lib/reference-ingest-server-cache";
import type { ReferenceImageHandle } from "@/lib/assets/reference-image-storage.types";
import { describeReferenceImage } from "@/lib/vision-reference";
import { localizedApiErrorText, localizedJsonError } from "@/lib/api/localized-error";
import { apiKeyedErrorText, isApiKeyedError } from "@/lib/api/api-keyed-error";
import { ingestWarningMessage } from "@/lib/i18n/progress-message";
import { tMessage } from "@/lib/i18n/messages";
import { resolveRequestLocaleSync } from "@/lib/i18n/request-locale";

export const runtime = "nodejs";

const MAX_APPEND = 14_000;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_DOC_BYTES = 8 * 1024 * 1024;
const MAX_ZIP_BYTES = 18 * 1024 * 1024;

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);

function boolFrom(v: FormDataEntryValue | null): boolean {
  if (typeof v !== "string") return false;
  return v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "yes";
}

function isAllowedInnerPath(name: string): boolean {
  const n = name.replace(/\\/g, "/");
  if (n.includes("..")) return false;
  if (n.startsWith("/") || /^[a-zA-Z]:\//.test(n)) return false;
  return true;
}

function extOf(name: string): string {
  const lower = name.toLowerCase();
  const idx = lower.lastIndexOf(".");
  return idx >= 0 ? lower.slice(idx + 1) : "";
}

export async function POST(req: Request): Promise<NextResponse> {
  const uiLocale = resolveRequestLocaleSync(req);
  const warnings: string[] = [];
  const warn = (key: string, params?: Record<string, string | number | undefined | null>) => {
    warnings.push(ingestWarningMessage(uiLocale, key, params));
  };
  const chunks: string[] = [];
  const referenceAssets: ReferenceImageHandle[] = [];
  const assetStorage = getReferenceImageStorage();

  try {
    const fd = await req.formData();
    const urlField = fd.get("url");
    const visionOn = boolFrom(fd.get("vision"));

    const files = fd.getAll("files").filter((x): x is File => x instanceof File && x.size > 0);

    let imageRoles: string[] = [];
    const rolesRaw = fd.get("imageRoles");
    if (typeof rolesRaw === "string" && rolesRaw.trim()) {
      try {
        const parsed = JSON.parse(rolesRaw) as unknown;
        if (Array.isArray(parsed)) imageRoles = parsed.map((x) => (typeof x === "string" ? x : ""));
      } catch {
        warn("imageRolesInvalid");
      }
    }

    if (typeof urlField === "string" && urlField.trim()) {
      try {
        const { title, text } = await fetchUrlPlainText(urlField.trim());
        const head = title ? `【网页】${title}\n` : `【网页】${urlField.trim()}\n`;
        chunks.push(truncateDocText(`${head}${text}`));
      } catch (e) {
        const reason = isApiKeyedError(e)
          ? apiKeyedErrorText(uiLocale, e)
          : e instanceof Error
            ? e.message
            : ingestWarningMessage(uiLocale, "unknownError");
        warn("urlFetchFailed", { reason });
      }
    }

    let imageOrdinal = 0;

    const purposeFallback = tMessage(uiLocale, "ingestWarnings.purposeUnlabeled");
    const roleLabel = (fileIndex: number | undefined): string => {
      if (fileIndex === undefined || fileIndex < 0) return purposeFallback;
      const r = (imageRoles[fileIndex] ?? "").trim();
      return r.length ? r : purposeFallback;
    };

    const decodeOne = async (name: string, mime: string, buf: Buffer, fileIndex?: number) => {
      const lower = name.toLowerCase();
      const mt = (mime || "").toLowerCase();

      if (mt === "application/zip" || lower.endsWith(".zip")) {
        if (buf.byteLength > MAX_ZIP_BYTES) {
          warn("zipTooLarge", { name, maxMb: MAX_ZIP_BYTES >> 20 });
          return;
        }
        let zip: JSZip;
        try {
          zip = await JSZip.loadAsync(buf);
        } catch {
          warn("zipUnpackFailed", { name });
          return;
        }
        let innerCount = 0;
        const entries = Object.values(zip.files);
        for (const entry of entries) {
          if (entry.dir) continue;
          if (!isAllowedInnerPath(entry.name)) continue;
          if (innerCount >= 30) {
            warn("zipTooManyFiles", { name });
            break;
          }
          const eext = extOf(entry.name);
          if (!["png", "jpg", "jpeg", "webp", "gif", "pdf", "docx", "txt", "md"].includes(eext)) continue;
          const b = Buffer.from(await entry.async("uint8array"));
          if (eext === "zip") continue;
          await decodeOne(`${name}:${entry.name}`, "", b, undefined);
          innerCount += 1;
        }
        if (innerCount === 0) warn("zipNoParseable", { name });
        return;
      }

      if (IMAGE_TYPES.has(mt) || /\.(png|jpe?g|webp|gif)$/i.test(lower)) {
        if (buf.byteLength > MAX_IMAGE_BYTES) {
          warn("imageTooLarge", { name, maxMb: MAX_IMAGE_BYTES >> 20 });
          return;
        }
        const mt2 = mt.startsWith("image/") ? mt : "image/png";
        imageOrdinal += 1;
        const ord = imageOrdinal;
        const purpose = fileIndex !== undefined ? imageRoles[fileIndex] : undefined;
        const handle = await assetStorage.registerIngestedImage({
          buffer: buf,
          mimeType: mt2,
          ordinal: ord,
          originalName: name,
          purpose,
        });
        referenceAssets.push(handle);
        try {
          await cacheIngestReferenceBuffer(handle.refId, buf, mt2);
        } catch {
          warn("refCacheFailed", { name });
        }

        if (!process.env.OPENAI_API_KEY?.trim()) {
          warn("noOpenAiKey", { name });
          chunks.push(
            `【参考图 图${imageOrdinal}（用户用途：${roleLabel(fileIndex)}）】${name}（缺少 OPENAI_API_KEY，未解析）`,
          );
          return;
        }
        if (!visionOn) {
          warn("visionOff", { name });
          chunks.push(
            `【参考图 图${imageOrdinal}（用户用途：${roleLabel(fileIndex)}）】${name}（未开启视觉解读）`,
          );
          return;
        }
        const b64 = buf.toString("base64");
        const cap = await describeReferenceImage({
          mimeType: mt2,
          base64: b64,
          roleHint: purpose,
          imageOrdinal: ord,
          uiLocale,
        });
        chunks.push(`【参考图 图${ord}（用户用途：${roleLabel(fileIndex)}）】\n${cap}`);
        return;
      }

      if (mt === "application/pdf" || lower.endsWith(".pdf")) {
        if (buf.byteLength > MAX_DOC_BYTES) {
          warn("pdfTooLarge", { name });
          return;
        }
        const t = await extractPdfText(buf);
        chunks.push(`【PDF ${name}】\n${t}`);
        return;
      }

      if (
        mt === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        lower.endsWith(".docx")
      ) {
        if (buf.byteLength > MAX_DOC_BYTES) {
          warn("docTooLarge", { name });
          return;
        }
        const t = await extractDocxText(buf);
        chunks.push(`【DOCX ${name}】\n${t}`);
        return;
      }

      if (mt === "text/plain" || mt === "text/markdown" || lower.endsWith(".txt") || lower.endsWith(".md")) {
        chunks.push(`【文本 ${name}】\n${extractUtf8Text(buf)}`);
        return;
      }

      warn("unsupportedFormat", { name });
    };

    for (let fi = 0; fi < Math.min(files.length, 12); fi += 1) {
      const file = files[fi];
      const buf = Buffer.from(await file.arrayBuffer());
      try {
        await decodeOne(file.name, file.type || "", buf, fi);
      } catch (e) {
        warn("parseFailed", {
          name: file.name,
          reason: e instanceof Error ? e.message : ingestWarningMessage(uiLocale, "unknownError"),
        });
      }
    }

    const firstRef = chunks.findIndex((c) => c.startsWith("【参考图 图"));
    if (firstRef >= 0) {
      chunks.splice(
        firstRef,
        0,
        "【参考图编号说明】下文「图1」「图2」…按本次提交的文件列表顺序，仅对「图片」递增编号（与「参考图 图N」一致；PDF/纯文本不参与计数）。生成规格时请把每张图的「用户用途」落实到 title/subtitle、theme 配色、labels（player/hazard/collectible）：主色与环境氛围须与每张参考图的**文字摘录**和用户用途一致。**塔防守卫等模板：**创作台解析成功后，浏览器同一会话下试玩会使用参考图**像素贴片**（按用途分拣：背景地图类→全屏底图、怪物类→行军敌兵、主角/萝卜/水晶等到路径终点）；因此 JSON 里 theme、hazard/player 色相与称谓不要走向与参考图描述相冲突的默认「霓虹/赛博」（除非创意或参考明确要该风格）。**浏览器侧修饰（与视觉模型解读配合）：**PNG/WebP/GIF 会话像素会**保留透明通道**（不再铺白底压成 JPEG）；对用户标注为「怪/敌/主角/塔」等贴片类用途的图，会**自动居中收入固定边长的方形精灵格**（透明留白）以与塔防行军贴片更一致；服务端**不**做 AI 自动抠图——若图为复杂实拍底仍需人工出透明 PNG 或后期在 DCC 里抠图。\n",
      );
    }

    let text = chunks.join("\n\n").trim();
    if (text.length > MAX_APPEND) {
      text = `${text.slice(0, MAX_APPEND)}\n${ingestWarningMessage(uiLocale, "textTruncated")}`;
    }

    if (!text && warnings.length === 0) {
      return localizedJsonError(req, "noIngestInput", 400);
    }

    if (
      referenceAssets.length > 0 &&
      assetStorage.mode === "cloud" &&
      !process.env.REFERENCE_ASSET_CLOUD_UPLOAD_URL?.trim()
    ) {
      warn("cloudUploadUrlMissing");
    }

    if (
      referenceAssets.some((h) => h.tier === "persistent" && !h.persisted) &&
      assetStorage.mode === "cloud" &&
      process.env.REFERENCE_ASSET_CLOUD_UPLOAD_URL?.trim()
    ) {
      warn("cloudUploadIncomplete");
    }

    return NextResponse.json({
      text: text || "",
      warnings,
      referenceAssetStorageMode: assetStorage.mode,
      referenceAssets: referenceAssets.length ? referenceAssets : undefined,
    });
  } catch {
    return localizedJsonError(req, "ingestFailed", 500);
  }
}
