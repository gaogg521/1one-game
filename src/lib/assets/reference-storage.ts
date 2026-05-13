/**
 * 参考图存储：类型、服务端适配器工厂、浏览器 sessionStorage 辅助。
 * 默认仅会话（不落盘）；云适配见 reference-image-storage.cloud.ts 与环境变量。
 */
export type {
  IReferenceImageStorage,
  ReferenceImageHandle,
  ReferenceImageStorageMode,
  RegisterIngestedImageInput,
} from "./reference-image-storage.types";
export { getReferenceImageStorage, resetReferenceImageStorageForTests } from "./reference-image-storage.factory";
export {
  clearReferenceHandlesSession,
  readReferenceHandlesFromSession,
  saveReferenceHandlesToSession,
} from "./reference-image-storage.client";
