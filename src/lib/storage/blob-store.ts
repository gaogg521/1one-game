import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { repoPublicPath } from "@/lib/public-path";

export type BlobStore = {
  put(key: string, data: Buffer, contentType?: string): Promise<string>;
  getPublicUrl(key: string): string;
};

function localRoot(): string {
  return process.env.BLOB_LOCAL_ROOT?.trim() || repoPublicPath();
}

function publicBaseUrl(): string {
  return process.env.BLOB_PUBLIC_BASE_URL?.trim() || "";
}

export function createLocalBlobStore(): BlobStore {
  return {
    async put(key, data) {
      const rel = key.replace(/^\/+/, "");
      const abs = path.join(localRoot(), rel);
      await mkdir(path.dirname(abs), { recursive: true });
      await writeFile(abs, data, { mode: 0o644 });
      const base = publicBaseUrl();
      return base ? `${base.replace(/\/$/, "")}/${rel}` : `/${rel}`;
    },
    getPublicUrl(key) {
      const rel = key.replace(/^\/+/, "");
      const base = publicBaseUrl();
      return base ? `${base.replace(/\/$/, "")}/${rel}` : `/${rel}`;
    },
  };
}

/** S3 兼容（MinIO / AWS / 阿里云 OSS）— 需 @aws-sdk/client-s3 与 STORAGE_S3_* 环境变量 */
export async function createS3BlobStore(): Promise<BlobStore | null> {
  const bucket = process.env.STORAGE_S3_BUCKET?.trim();
  const region = process.env.STORAGE_S3_REGION?.trim() || "us-east-1";
  const endpoint = process.env.STORAGE_S3_ENDPOINT?.trim();
  const accessKey = process.env.STORAGE_S3_ACCESS_KEY?.trim();
  const secretKey = process.env.STORAGE_S3_SECRET_KEY?.trim();
  if (!bucket || !accessKey || !secretKey) return null;

  try {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      region,
      endpoint: endpoint || undefined,
      forcePathStyle: Boolean(endpoint),
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    });
    const publicBase =
      process.env.STORAGE_S3_PUBLIC_URL?.trim() ||
      (endpoint ? `${endpoint.replace(/\/$/, "")}/${bucket}` : `https://${bucket}.s3.${region}.amazonaws.com`);

    return {
      async put(key, data, contentType) {
        const rel = key.replace(/^\/+/, "");
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: rel,
            Body: data,
            ContentType: contentType,
          }),
        );
        return `${publicBase}/${rel}`;
      },
      getPublicUrl(key) {
        const rel = key.replace(/^\/+/, "");
        return `${publicBase}/${rel}`;
      },
    };
  } catch {
    return null;
  }
}

let storePromise: Promise<BlobStore> | null = null;

export async function getBlobStore(): Promise<BlobStore> {
  if (!storePromise) {
    storePromise = (async () => {
      const mode = process.env.STORAGE_MODE?.trim() || "local";
      if (mode === "s3") {
        const s3 = await createS3BlobStore();
        if (s3) return s3;
      }
      return createLocalBlobStore();
    })();
  }
  return storePromise;
}

export async function readLocalBlobIfExists(key: string): Promise<Buffer | null> {
  try {
    const abs = path.join(localRoot(), key.replace(/^\/+/, ""));
    return await readFile(abs);
  } catch {
    return null;
  }
}
