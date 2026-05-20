import fs from "node:fs/promises";
import path from "node:path";
const GODOT_MOTHER_UNIVERSAL_DIR = "godot-templates/ai-mother-universal";

const FONT_REL = "fonts/NotoSansSC-Regular.woff2";
/** @fontsource/noto-sans-sc 简体中文常规体（Godot Web 需打包进 PCK） */
const FONT_CDN =
  "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc@5.2.5/files/noto-sans-sc-chinese-simplified-400-normal.woff2";

export function godotUiFontPath(repoRoot: string): string {
  return path.join(repoRoot, GODOT_MOTHER_UNIVERSAL_DIR, FONT_REL);
}

/** 母版导出前确保中文字体存在（缺失则从 node_modules 复制或 CDN 下载） */
export async function ensureGodotUiFont(repoRoot: string): Promise<void> {
  const dest = godotUiFontPath(repoRoot);
  try {
    const st = await fs.stat(dest);
    if (st.size > 100_000) return;
  } catch {
    /* fetch */
  }

  await fs.mkdir(path.dirname(dest), { recursive: true });
  const bundled = path.join(
    repoRoot,
    "node_modules",
    "@fontsource",
    "noto-sans-sc",
    "files",
    "noto-sans-sc-chinese-simplified-400-normal.woff2",
  );
  try {
    const st = await fs.stat(bundled);
    if (st.size > 100_000) {
      await fs.copyFile(bundled, dest);
      return;
    }
  } catch {
    /* download */
  }

  const res = await fetch(FONT_CDN);
  if (!res.ok) {
    throw new Error(`无法下载 Godot 中文字体: HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 100_000) {
    throw new Error("Godot 中文字体下载不完整");
  }
  await fs.writeFile(dest, buf);
}
