/**
 * 参考图 / 素材存储：默认仅会话（不在服务端落盘），并预留持久化（云对象存储等）扩展点。
 */

export type ReferenceImageStorageMode = "session" | "cloud";

/** 单次摄取后返回给前端的句柄，用于与「图N」、后续生成或引擎贴图管线对齐 */
export type ReferenceImageHandle = {
  /** 客户端可写入 sessionStorage 的稳定 id */
  refId: string;
  /** 图序（与「参考图 图N」一致） */
  ordinal: number;
  mimeType: string;
  originalName: string;
  /** 用户填写的用途（若有） */
  purpose?: string;
  /** session：默认不在服务端保留像素；persistent：已上传并可公网拉取 */
  tier: "session" | "persistent";
  /** 是否已在对象存储 / CDN 等落地 */
  persisted: boolean;
  /** 持久化后的可访问 URL（签名或公开） */
  publicUrl?: string;
  /** 云模式未配置或未成功时的人类可读说明 */
  notice?: string;
};

export type RegisterIngestedImageInput = {
  buffer: Buffer;
  mimeType: string;
  ordinal: number;
  originalName: string;
  purpose?: string;
};

/**
 * 服务端摄取管线调用的端口。后续接入 S3/R2/OSS 等时实现 persistent 分支即可。
 */
export interface IReferenceImageStorage {
  readonly mode: ReferenceImageStorageMode;

  /**
   * 在视觉解读前后调用均可；默认 session 实现不写入磁盘，仅分配 refId。
   * 云实现可在成功后设置 persisted + publicUrl。
   */
  registerIngestedImage(input: RegisterIngestedImageInput): Promise<ReferenceImageHandle>;
}
