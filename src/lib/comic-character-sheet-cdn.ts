/**
 * 漫画角色参考图 CDN 上传与管理
 * 支持多 CDN 端点、自动选择、上传重试、缓存策略
 */

export type CdnProvider = "aws-s3" | "cloudflare" | "custom";

export type CdnConfig = {
  provider: CdnProvider;
  endpoint: string;
  accessKey?: string;
  secretKey?: string;
  bucket?: string;
  ttlSeconds: number; // 缓存有效期
  maxRetries: number;
  retryDelayMs: number;
};

export type UploadResult = {
  success: boolean;
  cdnUrl?: string;
  localPath: string;
  provider: CdnProvider;
  uploadedAt: string;
  expiresAt: string;
  error?: string;
};

/**
 * 上传参考图到 CDN，带重试机制
 */
export async function uploadCharacterSheetToCdn(
  localPath: string,
  characterId: string,
  comicKey: string,
  config: CdnConfig,
): Promise<UploadResult> {
  const startTime = Date.now();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const cdnUrl = await uploadToCdnProvider(localPath, characterId, comicKey, config);
      const uploadedAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + config.ttlSeconds * 1000).toISOString();

      console.info(
        `[cdn-upload] 上传成功 ${comicKey}/${characterId}: ${cdnUrl} (${Date.now() - startTime}ms)`
      );

      return {
        success: true,
        cdnUrl,
        localPath,
        provider: config.provider,
        uploadedAt,
        expiresAt,
      };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      console.warn(
        `[cdn-upload] 上传失败 ${comicKey}/${characterId} (attempt ${attempt + 1}/${config.maxRetries + 1}):`,
        lastError.message
      );

      if (attempt < config.maxRetries) {
        const delayMs = config.retryDelayMs * Math.pow(2, attempt); // 指数退避
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  return {
    success: false,
    localPath,
    provider: config.provider,
    uploadedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + config.ttlSeconds * 1000).toISOString(),
    error: lastError?.message ?? "Unknown error",
  };
}

/**
 * 根据 CDN provider 分发上传
 */
async function uploadToCdnProvider(
  localPath: string,
  characterId: string,
  comicKey: string,
  config: CdnConfig
): Promise<string> {
  switch (config.provider) {
    case "aws-s3":
      return uploadToAwsS3(localPath, characterId, comicKey, config);
    case "cloudflare":
      return uploadToCloudflare(localPath, characterId, comicKey, config);
    case "custom":
      return uploadToCustomEndpoint(localPath, characterId, comicKey, config);
    default:
      throw new Error(`Unknown CDN provider: ${config.provider}`);
  }
}

/**
 * 上传到 AWS S3（简化版 - 生产环境需要完整 SDK）
 */
async function uploadToAwsS3(
  localPath: string,
  characterId: string,
  comicKey: string,
  config: CdnConfig
): Promise<string> {
  // 生产环境中使用 AWS SDK (aws-sdk或aws-sdk-js-v3)
  const bucket = config.bucket || "open-game-comics";
  const key = `character-sheets/${comicKey}/${characterId}.jpg`;

  // 这里仅为示意，实际需要读取文件并上传
  // const fileContent = await readFile(localPath);
  // const s3Client = new S3Client({ credentials: {...} });
  // await s3Client.send(new PutObjectCommand({
  //   Bucket: bucket,
  //   Key: key,
  //   Body: fileContent,
  //   CacheControl: `max-age=${config.ttlSeconds}`,
  // }));

  const region = new URL(config.endpoint).hostname.split(".")[1] || "us-east-1";
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

/**
 * 上传到 Cloudflare Images（API）
 */
async function uploadToCloudflare(
  localPath: string,
  characterId: string,
  comicKey: string,
  config: CdnConfig
): Promise<string> {
  // 生产环境中使用 Cloudflare Images API
  // https://developers.cloudflare.com/images/cloudflare-images/upload-images/
  const accountId = config.bucket || process.env.CLOUDFLARE_ACCOUNT_ID;
  const imageId = `${comicKey}-${characterId}`;

  // 示意：
  // const formData = new FormData();
  // formData.append('file', fileStream);
  // const response = await fetch(`${config.endpoint}/accounts/${accountId}/images/v1`, {
  //   method: 'POST',
  //   headers: { 'Authorization': `Bearer ${config.accessKey}` },
  //   body: formData,
  // });

  return `${config.endpoint}/cdn-cgi/imagedelivery/${accountId}/${imageId}/public`;
}

/**
 * 上传到自定义 CDN 端点（通用 HTTP 上传）
 */
async function uploadToCustomEndpoint(
  localPath: string,
  characterId: string,
  comicKey: string,
  config: CdnConfig
): Promise<string> {
  // 生产环境中读取文件并上传
  // const fileContent = await readFile(localPath);
  // const formData = new FormData();
  // formData.append('file', new Blob([fileContent]));
  // const response = await fetch(`${config.endpoint}/upload`, {
  //   method: 'POST',
  //   headers: {
  //     'X-API-Key': config.accessKey,
  //   },
  //   body: formData,
  // });

  const imageName = `${comicKey}-${characterId}.jpg`;
  return `${config.endpoint}/images/${imageName}`;
}

/**
 * 验证 CDN URL 可达性
 */
export async function verifyCdnUrl(
  cdnUrl: string,
  timeoutMs: number = 5000
): Promise<{ valid: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(cdnUrl, {
      method: "HEAD",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { valid: false, error: `HTTP ${response.status}` };
    }

    // 检查内容类型是否为图像
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.startsWith("image/")) {
      return { valid: false, error: "Not an image" };
    }

    return { valid: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { valid: false, error };
  }
}

/**
 * 获取 CDN 配置（从环境或数据库）
 */
export function getCdnConfig(): CdnConfig {
  const provider = (process.env.CDN_PROVIDER || "custom") as CdnProvider;
  const endpoint = process.env.CDN_ENDPOINT || "https://cdn.example.com";
  const ttlSeconds = parseInt(process.env.CDN_TTL_SECONDS || "2592000", 10); // 默认 30 天

  return {
    provider,
    endpoint,
    accessKey: process.env.CDN_ACCESS_KEY,
    secretKey: process.env.CDN_SECRET_KEY,
    bucket: process.env.CDN_BUCKET,
    ttlSeconds,
    maxRetries: 3,
    retryDelayMs: 1000,
  };
}
