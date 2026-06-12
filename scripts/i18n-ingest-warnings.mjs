/** Ingest API warning messages — merge via i18n-bulk-catalog.mjs */

export const ingestWarningsZhHans = {
  purposeUnlabeled: "未标注用途",
  imageRolesInvalid: "imageRoles 格式无效，已忽略每张图的用途标注",
  urlFetchFailed: "网页抓取失败：{reason}",
  zipTooLarge: "{name}：zip 过大（>{maxMb}MB），已跳过",
  zipUnpackFailed: "{name}：zip 解包失败",
  zipTooManyFiles: "{name}：压缩包文件过多，仅解析前 30 个",
  zipNoParseable: "{name}：未发现可解析文件（支持图片/pdf/docx/txt/md）",
  imageTooLarge: "{name}：图片过大（>{maxMb}MB），已跳过",
  refCacheFailed: "{name}：参考图未能写入服务端缓存，Godot 导出可能无法使用贴图",
  noOpenAiKey: "{name}：未配置 OPENAI_API_KEY，无法解读参考图",
  visionOff: "{name}：未开启「解读参考图」，仅记录文件名",
  pdfTooLarge: "{name}：PDF 过大，已跳过",
  docTooLarge: "{name}：文档过大，已跳过",
  unsupportedFormat: "{name}：不支持的格式（请用 pdf / docx / txt / md / 图片 / zip）",
  parseFailed: "{name}：解析失败（{reason}）",
  cloudUploadUrlMissing:
    "REFERENCE_ASSET_STORAGE=cloud 但未配置 REFERENCE_ASSET_CLOUD_UPLOAD_URL，参考图未上传云端（等同仅会话）。",
  cloudUploadIncomplete:
    "REFERENCE_ASSET_CLOUD_UPLOAD_URL 已配置但服务端上传逻辑尚未完成，对象未写入；仍为仅会话语义。",
  unknownError: "未知错误",
  textTruncated: "…（总长已截断）",
};

export const ingestWarningsEn = {
  purposeUnlabeled: "Usage not set",
  imageRolesInvalid: "Invalid imageRoles JSON — per-image purpose labels were ignored",
  urlFetchFailed: "Web fetch failed: {reason}",
  zipTooLarge: "{name}: zip too large (>{maxMb}MB), skipped",
  zipUnpackFailed: "{name}: failed to unpack zip",
  zipTooManyFiles: "{name}: too many files in archive — only the first 30 were parsed",
  zipNoParseable: "{name}: no parseable files (supports images/pdf/docx/txt/md)",
  imageTooLarge: "{name}: image too large (>{maxMb}MB), skipped",
  refCacheFailed: "{name}: reference image could not be cached on server — Godot export may miss textures",
  noOpenAiKey: "{name}: OPENAI_API_KEY is not set — cannot interpret reference image",
  visionOff: "{name}: vision interpretation is off — filename recorded only",
  pdfTooLarge: "{name}: PDF too large, skipped",
  docTooLarge: "{name}: document too large, skipped",
  unsupportedFormat: "{name}: unsupported format (use pdf / docx / txt / md / image / zip)",
  parseFailed: "{name}: parse failed ({reason})",
  cloudUploadUrlMissing:
    "REFERENCE_ASSET_STORAGE=cloud but REFERENCE_ASSET_CLOUD_UPLOAD_URL is not set — references stay session-only.",
  cloudUploadIncomplete:
    "REFERENCE_ASSET_CLOUD_UPLOAD_URL is set but server upload is not implemented — still session-only.",
  unknownError: "Unknown error",
  textTruncated: "…(truncated)",
};

function hantify(obj) {
  const map = {
    无效: "無效",
    忽略: "忽略",
    每张: "每張",
    用途: "用途",
    标注: "標註",
    网页: "網頁",
    抓取: "抓取",
    失败: "失敗",
    过大: "過大",
    跳过: "跳過",
    解包: "解包",
    压缩包: "壓縮包",
    文件: "檔案",
    过多: "過多",
    仅: "僅",
    解析: "解析",
    前: "前",
    个: "個",
    未发现: "未發現",
    可: "可",
    支持: "支持",
    图片: "圖片",
    参考: "參考",
    未能: "未能",
    写入: "寫入",
    服务端: "伺服器端",
    缓存: "快取",
    导出: "匯出",
    可能: "可能",
    无法: "無法",
    使用: "使用",
    贴图: "貼圖",
    未配置: "未配置",
    无法解读: "無法解讀",
    未开启: "未開啟",
    解读: "解讀",
    仅记录: "僅記錄",
    文件名: "檔名",
    文档: "文件",
    不支持: "不支持",
    格式: "格式",
    请用: "請用",
    总长: "總長",
    已截断: "已截斷",
    未知: "未知",
    错误: "錯誤",
  };
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    let s = v;
    for (const [from, to] of Object.entries(map)) {
      s = s.replaceAll(from, to);
    }
    out[k] = s;
  }
  return out;
}

export const ingestWarningsByLocale = {
  "zh-Hans": ingestWarningsZhHans,
  "zh-Hant": hantify(ingestWarningsZhHans),
  en: ingestWarningsEn,
  ms: ingestWarningsEn,
  th: ingestWarningsEn,
};
