import { randomUUID } from "node:crypto";
import type { IReferenceImageStorage, RegisterIngestedImageInput, ReferenceImageHandle } from "./reference-image-storage.types";

/**
 * 云持久化占位实现：通过环境变量接入实际上传逻辑。
 *
 * 预留钩子（实现时在此文件内补全即可）：
 * - REFERENCE_ASSET_CLOUD_UPLOAD_URL：接收 multipart 或 JSON 的上传端点
 * - REFERENCE_ASSET_CLOUD_AUTH_HEADER：可选，如 `Bearer xxx` 或 `Authorization: ...`
 *
 * 未配置时：不抛错，回退为与 session 相同的「不落盘」句柄（摄取接口会汇总一条警告）。
 */
export class CloudReferenceImageStorage implements IReferenceImageStorage {
  readonly mode = "cloud" as const;

  async registerIngestedImage(input: RegisterIngestedImageInput): Promise<ReferenceImageHandle> {
    const uploadUrl = process.env.REFERENCE_ASSET_CLOUD_UPLOAD_URL?.trim();
    const refId = randomUUID();

    if (!uploadUrl) {
      return {
        refId,
        ordinal: input.ordinal,
        mimeType: input.mimeType,
        originalName: input.originalName,
        purpose: input.purpose?.trim() || undefined,
        tier: "session",
        persisted: false,
      };
    }

    // TODO: 实现 multipart 上传至对象存储，并回填 publicUrl / persisted
    void input.buffer;
    void uploadUrl;
    return {
      refId,
      ordinal: input.ordinal,
      mimeType: input.mimeType,
      originalName: input.originalName,
      purpose: input.purpose?.trim() || undefined,
      tier: "persistent",
      persisted: false,
    };
  }
}
