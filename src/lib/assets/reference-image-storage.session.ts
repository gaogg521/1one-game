import { randomUUID } from "node:crypto";
import type { IReferenceImageStorage, RegisterIngestedImageInput, ReferenceImageHandle } from "./reference-image-storage.types";

/** 默认：不持久化字节，仅生成本次会话内可用的 refId（由前端写入 sessionStorage 等） */
export class SessionReferenceImageStorage implements IReferenceImageStorage {
  readonly mode = "session" as const;

  async registerIngestedImage(input: RegisterIngestedImageInput): Promise<ReferenceImageHandle> {
    return {
      refId: randomUUID(),
      ordinal: input.ordinal,
      mimeType: input.mimeType,
      originalName: input.originalName,
      purpose: input.purpose?.trim() || undefined,
      tier: "session",
      persisted: false,
    };
  }
}
