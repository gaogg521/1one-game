/** 浏览器会话内带入 Phaser 的参考图（由创作台解析后写入 sessionStorage） */
export type RuntimeReferencePayload = {
  ordinal: number;
  purpose: string;
  dataUrl: string;
};
