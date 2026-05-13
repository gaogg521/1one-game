/** 从 Phaser 挂载容器内找到 canvas，缩放后导出 JPEG Data URL（用于作品封面）。 */
export function captureCanvasAsJpegDataUrl(
  container: HTMLElement,
  maxWidth = 520,
  quality = 0.72,
): string | null {
  const canvas = container.querySelector("canvas");
  if (!canvas || canvas.width < 32 || canvas.height < 32) return null;
  const w = canvas.width;
  const h = canvas.height;
  const scale = Math.min(1, maxWidth / w);
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));
  const out = document.createElement("canvas");
  out.width = tw;
  out.height = th;
  const ctx = out.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(canvas, 0, 0, tw, th);
  try {
    const url = out.toDataURL("image/jpeg", quality);
    return url.startsWith("data:image/jpeg") ? url : null;
  } catch {
    return null;
  }
}
