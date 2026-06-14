/**
 * 游戏背景图生成：从 GameSpec 提取视觉描述 → 文生图 → 落盘到 public/。
 * 异步后台调用，失败不影响游戏可玩性（回退纯色背景）。
 */
import fs from "fs";
import path from "path";
import type { GameSpec } from "@/lib/game-spec";
import { generateImageDetailed } from "@/lib/image-generation";
import { getImageGenAvailability } from "@/lib/image-generation";
import {
  specTextForStyleDetection,
  buildAssetMoodLine,
  templateVisualStyle,
} from "@/lib/assets/template-visual-styles";

const BG_DIR = path.join(process.cwd(), "public", "game-bg");

function ensureDir() {
  if (!fs.existsSync(BG_DIR)) {
    fs.mkdirSync(BG_DIR, { recursive: true });
  }
}

export function resolveBackgroundTemplateStyle(spec: GameSpec): string {
  const allText = specTextForStyleDetection(spec);
  const isPvZ = /植物|僵尸|pvz|豌豆|向日葵|坚果|zombie|plant|温室|防线|射手|阳光|塔防|腐化|变异|植/.test(allText);
  let templateStyle = templateVisualStyle(spec.templateId);
  if (spec.templateId === "towerDefense" && isPvZ) {
    templateStyle =
      "Plants vs Zombies style garden lawn background, green grassy yard with curved dirt paths, wooden fence, small flower beds, daytime bright and cheerful";
  }
  return templateStyle;
}

export function buildBackgroundPrompt(spec: GameSpec): string {
  const mood = buildAssetMoodLine(spec);
  const bgColor = spec.theme.backgroundColor || "#1a1a2e";
  const templateStyle = resolveBackgroundTemplateStyle(spec);

  return [
    `2D game background scene, ${templateStyle}`,
    `game title mood: ${mood}`,
    `template: ${spec.templateId}`,
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
    let buffer: Buffer;
    if (result.localPath && fs.existsSync(result.localPath)) {
      buffer = fs.readFileSync(result.localPath);
    } else {
      const res = await fetch(result.url);
      if (!res.ok) {
        console.warn(`[game-bg] 下载背景失败 HTTP ${res.status}`);
        return null;
      }
      buffer = Buffer.from(await res.arrayBuffer());
    }
    const destPath = path.join(BG_DIR, `${projectId}.png`);
    fs.writeFileSync(destPath, buffer);
    console.info(`[game-bg] 背景已保存 ${destPath}`);

    return `/game-bg/${projectId}.png`;
  } catch (e) {
    console.warn(`[game-bg] 背景生成异常：${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}