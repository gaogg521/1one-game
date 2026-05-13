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
import type { ReferenceImageHandle } from "@/lib/assets/reference-image-storage.types";
import { describeReferenceImage } from "@/lib/vision-reference";

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
  const warnings: string[] = [];
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
        warnings.push("imageRoles 格式无效，已忽略每张图的用途标注");
      }
    }

    if (typeof urlField === "string" && urlField.trim()) {
      try {
        const { title, text } = await fetchUrlPlainText(urlField.trim());
        const head = title ? `【网页】${title}\n` : `【网页】${urlField.trim()}\n`;
        chunks.push(truncateDocText(`${head}${text}`));
      } catch (e) {
        warnings.push(`网页抓取失败：${e instanceof Error ? e.message : "未知错误"}`);
      }
    }

    let imageOrdinal = 0;

    const roleLabel = (fileIndex: number | undefined): string => {
      if (fileIndex === undefined || fileIndex < 0) return "未标注用途";
      const r = (imageRoles[fileIndex] ?? "").trim();
      return r.length ? r : "未标注用途";
    };

    const decodeOne = async (name: string, mime: string, buf: Buffer, fileIndex?: number) => {
      const lower = name.toLowerCase();
      const mt = (mime || "").toLowerCase();

      if (mt === "application/zip" || lower.endsWith(".zip")) {
        if (buf.byteLength > MAX_ZIP_BYTES) {
          warnings.push(`${name}：zip 过大（>${MAX_ZIP_BYTES >> 20}MB），已跳过`);
          return;
        }
        let zip: JSZip;
        try {
          zip = await JSZip.loadAsync(buf);
        } catch {
          warnings.push(`${name}：zip 解包失败`);
          return;
        }
        let innerCount = 0;
        const entries = Object.values(zip.files);
        for (const entry of entries) {
          if (entry.dir) continue;
          if (!isAllowedInnerPath(entry.name)) continue;
          if (innerCount >= 30) {
            warnings.push(`${name}：压缩包文件过多，仅解析前 30 个`);
            break;
          }
          const eext = extOf(entry.name);
          if (!["png", "jpg", "jpeg", "webp", "gif", "pdf", "docx", "txt", "md"].includes(eext)) continue;
          const b = Buffer.from(await entry.async("uint8array"));
          // 递归复用同一套规则（但禁止嵌套 zip）
          if (eext === "zip") continue;
          await decodeOne(`${name}:${entry.name}`, "", b, undefined);
          innerCount += 1;
        }
        if (innerCount === 0) warnings.push(`${name}：未发现可解析文件（支持图片/pdf/docx/txt/md）`);
        return;
      }

      if (IMAGE_TYPES.has(mt) || /\.(png|jpe?g|webp|gif)$/i.test(lower)) {
        if (buf.byteLength > MAX_IMAGE_BYTES) {
          warnings.push(`${name}：图片过大（>${MAX_IMAGE_BYTES >> 20}MB），已跳过`);
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

        if (!process.env.OPENAI_API_KEY?.trim()) {
          warnings.push(`${name}：未配置 OPENAI_API_KEY，无法解读参考图`);
          chunks.push(
            `【参考图 图${imageOrdinal}（用户用途：${roleLabel(fileIndex)}）】${name}（缺少 OPENAI_API_KEY，未解析）`,
          );
          return;
        }
        if (!visionOn) {
          warnings.push(`${name}：未开启「解读参考图」，仅记录文件名`);
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
        });
        chunks.push(`【参考图 图${ord}（用户用途：${roleLabel(fileIndex)}）】\n${cap}`);
        return;
      }

      if (mt === "application/pdf" || lower.endsWith(".pdf")) {
        if (buf.byteLength > MAX_DOC_BYTES) {
          warnings.push(`${name}：PDF 过大，已跳过`);
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
          warnings.push(`${name}：文档过大，已跳过`);
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

      warnings.push(`${name}：不支持的格式（请用 pdf / docx / txt / md / 图片 / zip）`);
    };

    for (let fi = 0; fi < Math.min(files.length, 12); fi += 1) {
      const file = files[fi];
      const buf = Buffer.from(await file.arrayBuffer());
      try {
        await decodeOne(file.name, file.type || "", buf, fi);
      } catch (e) {
        warnings.push(`${file.name}：解析失败（${e instanceof Error ? e.message : "未知"}）`);
      }
    }

    const firstRef = chunks.findIndex((c) => c.startsWith("【参考图 图"));
    if (firstRef >= 0) {
      chunks.splice(
        firstRef,
        0,
        "【参考图编号说明】下文「图1」「图2」…按本次提交的文件列表顺序，仅对「图片」递增编号（与「参考图 图N」一致；PDF/纯文本不参与计数）。生成规格时请把每张图的「用户用途」落实到 theme 配色、labels（player/hazard/collectible）与整体氛围；当前试玩主要为程序图形，不直接贴入原图像素，但视觉与命名应尽量贴合各图描述。\n",
      );
    }

    let text = chunks.join("\n\n").trim();
    if (text.length > MAX_APPEND) {
      text = `${text.slice(0, MAX_APPEND)}\n…（总长已截断）`;
    }

    if (!text && warnings.length === 0) {
      return NextResponse.json({ error: "未提供可解析的文件或链接" }, { status: 400 });
    }

    if (
      referenceAssets.length > 0 &&
      assetStorage.mode === "cloud" &&
      !process.env.REFERENCE_ASSET_CLOUD_UPLOAD_URL?.trim()
    ) {
      warnings.push(
        "REFERENCE_ASSET_STORAGE=cloud 但未配置 REFERENCE_ASSET_CLOUD_UPLOAD_URL，参考图未上传云端（等同仅会话）。",
      );
    }

    if (
      referenceAssets.some((h) => h.tier === "persistent" && !h.persisted) &&
      assetStorage.mode === "cloud" &&
      process.env.REFERENCE_ASSET_CLOUD_UPLOAD_URL?.trim()
    ) {
      warnings.push(
        "REFERENCE_ASSET_CLOUD_UPLOAD_URL 已配置但服务端上传逻辑尚未完成，对象未写入；仍为仅会话语义。",
      );
    }

    return NextResponse.json({
      text: text || "",
      warnings,
      referenceAssetStorageMode: assetStorage.mode,
      referenceAssets: referenceAssets.length ? referenceAssets : undefined,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "摄取失败" },
      { status: 500 },
    );
  }
}
