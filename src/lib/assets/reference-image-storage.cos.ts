import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { IReferenceImageStorage, RegisterIngestedImageInput, ReferenceImageHandle } from "./reference-image-storage.types";

export type CosReferenceImageStorageConfig = {
  bucket: string;
  region: string;
  endpoint: string;
  publicBaseUrl: string;
  prefix: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export type PutCosReferenceObject = (
  config: CosReferenceImageStorageConfig,
  key: string,
  input: RegisterIngestedImageInput,
) => Promise<void>;

function sessionHandle(input: RegisterIngestedImageInput, refId: string, notice: string): ReferenceImageHandle {
  return {
    refId,
    ordinal: input.ordinal,
    mimeType: input.mimeType,
    originalName: input.originalName,
    purpose: input.purpose?.trim() || undefined,
    tier: "session",
    persisted: false,
    notice,
  };
}

function trimmed(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function normalizePrefix(raw: string | undefined): string {
  return (raw || "operone/references").replace(/^\/+|\/+$/g, "");
}

function publicObjectUrl(base: string, key: string): string {
  const safeKey = key.split("/").map(encodeURIComponent).join("/");
  return `${base.replace(/\/+$/, "")}/${safeKey}`;
}

function extensionFor(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "png";
  }
}

/** Reads only runtime secrets. A public base URL is deliberately required: private COS object URLs must not be claimed usable across jobs. */
export function getCosReferenceImageStorageConfig(): CosReferenceImageStorageConfig | null {
  const bucket = trimmed("COS_REFERENCE_BUCKET");
  const region = trimmed("COS_REFERENCE_REGION");
  const publicBaseUrl = trimmed("COS_REFERENCE_PUBLIC_BASE_URL");
  const accessKeyId = trimmed("COS_REFERENCE_SECRET_ID");
  const secretAccessKey = trimmed("COS_REFERENCE_SECRET_KEY");
  if (!bucket || !region || !publicBaseUrl || !accessKeyId || !secretAccessKey) return null;
  try {
    const parsed = new URL(publicBaseUrl);
    if (parsed.protocol !== "https:") return null;
  } catch {
    return null;
  }
  return {
    bucket,
    region,
    endpoint: trimmed("COS_REFERENCE_ENDPOINT") || `https://cos.${region}.myqcloud.com`,
    publicBaseUrl,
    prefix: normalizePrefix(trimmed("COS_REFERENCE_PREFIX")),
    accessKeyId,
    secretAccessKey,
  };
}

const putCosReferenceObject: PutCosReferenceObject = async (config, key, input) => {
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: input.buffer,
      ContentType: input.mimeType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
};

/** Direct Tencent COS adapter. Failed or incomplete configuration never reports a persisted reference. */
export class CosReferenceImageStorage implements IReferenceImageStorage {
  readonly mode = "cos" as const;

  constructor(private readonly putObject: PutCosReferenceObject = putCosReferenceObject) {}

  async registerIngestedImage(input: RegisterIngestedImageInput): Promise<ReferenceImageHandle> {
    const refId = randomUUID();
    const config = getCosReferenceImageStorageConfig();
    if (!config) return sessionHandle(input, refId, "cos_upload_unconfigured");

    const key = `${config.prefix}/${refId}.${extensionFor(input.mimeType)}`;
    try {
      await this.putObject(config, key, input);
      return {
        refId,
        ordinal: input.ordinal,
        mimeType: input.mimeType,
        originalName: input.originalName,
        purpose: input.purpose?.trim() || undefined,
        tier: "persistent",
        persisted: true,
        publicUrl: publicObjectUrl(config.publicBaseUrl, key),
      };
    } catch {
      return sessionHandle(input, refId, "cos_upload_failed");
    }
  }
}
