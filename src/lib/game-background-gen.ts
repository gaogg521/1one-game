/**
 * 游戏背景图生成：从 GameSpec 提取视觉描述 → 文生图 → 落盘到 public/。
 * 异步后台调用，失败不影响游戏可玩性（回退纯色背景）。
 */
import fs from "fs";
import path from "path";
import type { GameSpec } from "@/lib/game-spec";
import { generateImageDetailed } from "@/lib/image-generation";
import { getImageGenAvailability } from "@/lib/image-generation";

const BG_DIR = path.join(process.cwd(), "public", "game-bg");

function ensureDir() {
  if (!fs.existsSync(BG_DIR)) {
    fs.mkdirSync(BG_DIR, { recursive: true });
  }
}

function buildBackgroundPrompt(spec: GameSpec): string {
  const title = spec.title || "game";
  const subtitle = spec.labels?.subtitle?.trim() || "";
  const mood = subtitle || title;
  const bgColor = spec.theme.backgroundColor || "#1a1a2e";

  const templateStyle =
    spec.templateId === "platformer"
      ? "side-scrolling platformer game background, layered parallax scenery"
      : spec.templateId === "towerDefense"
        ? "top-down tactical game background, gridded terrain with path"
        : spec.templateId === "shooter"
          ? "top-down space shooter background, starfield with nebulae"
          : "abstract geometric game background, clean flat design";

  return [
    `2D game background scene, ${templateStyle}`,
    `mood: ${mood}`,
    `dominant color: ${bgColor}, smooth gradients, atmospheric depth`,
    `simple clean vector game art style, no text, no UI elements, no characters`,
    `seamless and tileable, suitable for a casual web game`,
  ].join(", ");
}

export async function generateGameBackground(
  projectId: string,
  spec: GameSpec,
): Promise<string | null> {
  const availability = getImageGenAvailability();
  if (!availability.ok) {
    console.warn(`[game-bg] 跳过背景生成：${availability.message}`);
    return null;
  }

  const prompt = buildBackgroundPrompt(spec);
  console.info(`[game-bg] 开始为 ${projectId} 生成背景…`);

  try {
    const result = await generateImageDetailed(prompt, {
      size: "1024x1024",
      quality: "standard",
    });

    if (!result.ok || !result.url) {
      console.warn(`[game-bg] 背景生成失败：${result.error ?? "无返回"}`);
      return null;
    }

    // 下载图片到 public/game-bg/
    ensureDir();
    const res = await fetch(result.url);
    if (!res.ok) {
      console.warn(`[game-bg] 下载背景失败 HTTP ${res.status}`);
      return null;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const destPath = path.join(BG_DIR, `${projectId}.png`);
    fs.writeFileSync(destPath, buffer);
    console.info(`[game-bg] 背景已保存 ${destPath}`);

    return `/game-bg/${projectId}.png`;
  } catch (e) {
    console.warn(`[game-bg] 背景生成异常：${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}