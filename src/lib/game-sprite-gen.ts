/**
 * 游戏实体精灵图生成。
 * 用 GameSpec 的 labels + theme 生成文生图 sprite → 落盘 public/game-sprites/{projectId}/
 * Phaser 引擎通过同名 texture 加载（texPlayer/texHazard/texGem/texPower），
 * 若 sprites 不存在则回退现有几何体生成，零破坏。
 */
import fs from "fs";
import path from "path";
import type { GameSpec } from "@/lib/game-spec";
import { generateImageDetailed } from "@/lib/image-generation";
import { getImageGenAvailability } from "@/lib/image-generation";

const SPRITE_DIR = path.join(process.cwd(), "public", "game-sprites");

function ensureDir(projectId: string) {
  const dir = path.join(SPRITE_DIR, projectId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

type SpriteKind = "player" | "hazard" | "gem" | "power" | "boss";

function buildSpritePrompt(spec: GameSpec, kind: SpriteKind): string {
  const bgColor = spec.theme.backgroundColor || "#1a1a2e";

  switch (kind) {
    case "player": {
      const name = spec.labels?.player || "hero";
      const color = spec.theme.playerColor || "#4a90d9";
      return [
        `2D game character sprite for "${name}", a cute chibi game hero`,
        `centered front-facing, simple clean vector game art style`,
        `dominant color ${color}, rounded friendly shapes`,
        `isolated on solid ${bgColor} background, flat design`,
        `suitable for casual mobile web game, 1:1 aspect ratio`,
        `no text, no UI, no weapons unless thematically required`,
      ].join(", ");
    }
    case "hazard": {
      const name = spec.labels?.hazard || "enemy";
      const color = spec.theme.hazardColor || "#e74c3c";
      return [
        `2D game enemy sprite for "${name}", a menacing but cute game monster`,
        `centered front-facing, simple clean vector game art style`,
        `dominant color ${color}, angular spiky shapes`,
        `isolated on solid ${bgColor} background, flat design`,
        `suitable for casual mobile web game, 1:1 aspect ratio`,
        `no text, no UI`,
      ].join(", ");
    }
    case "gem": {
      const name = spec.labels?.collectible || "gem";
      const color = spec.theme.collectibleColor || spec.theme.playerColor || "#f1c40f";
      return [
        `2D game collectible item sprite for "${name}", a shiny pickup item`,
        `centered, simple clean vector game art style`,
        `dominant color ${color}, glowing radiant`,
        `isolated on solid ${bgColor} background`,
        `suitable for casual mobile web game, 1:1 aspect ratio`,
        `no text, no UI`,
      ].join(", ");
    }
    case "power": {
      const color = spec.theme.collectibleColor || spec.theme.playerColor || "#f1c40f";
      return [
        `2D game power-up item sprite, a glowing star-shaped power-up`,
        `centered, simple clean vector game art style`,
        `dominant color ${color}, bright sparkle`,
        `isolated on solid ${bgColor} background`,
        `suitable for casual mobile web game, 1:1 aspect ratio`,
        `no text, no UI`,
      ].join(", ");
    }
    case "boss": {
      const name = spec.labels?.hazard || "boss";
      const color = spec.theme.hazardColor || "#cc0000";
      return [
        `2D game boss enemy sprite for "${name}", a large intimidating boss monster`,
        `centered front-facing, towering menacing design`,
        `dominant color ${color}, dark shadows, glowing red eyes`,
        `isolated on solid ${bgColor} background`,
        `suitable for casual mobile web game, 1:1 aspect ratio`,
        `no text, no UI`,
      ].join(", ");
    }
    default:
      return "";
  }
}

export type SpriteGenResult = {
  kind: SpriteKind;
  url: string | null;
  error?: string;
};

export async function generateGameSprites(
  projectId: string,
  spec: GameSpec,
): Promise<SpriteGenResult[]> {
  const availability = getImageGenAvailability();
  if (!availability.ok) {
    return (["player", "hazard", "gem", "power"] as SpriteKind[]).map((kind) => ({
      kind,
      url: null,
      error: availability.message,
    }));
  }

  const dir = ensureDir(projectId);
  const results: SpriteGenResult[] = [];

  for (const kind of ["player", "hazard", "gem", "power", "boss"] as SpriteKind[]) {
    const filePath = path.join(dir, `${kind}.png`);
    const publicUrl = `/game-sprites/${projectId}/${kind}.png`;

    // 已有缓存则跳过
    if (fs.existsSync(filePath)) {
      console.info(`[game-sprite] 复用缓存 ${projectId}/${kind}`);
      results.push({ kind, url: publicUrl });
      continue;
    }

    const prompt = buildSpritePrompt(spec, kind);
    console.info(`[game-sprite] 生成 ${projectId}/${kind}…`);

    try {
      const result = await generateImageDetailed(prompt, {
        size: "1024x1024",
        quality: "standard",
      });

      if (!result.ok || !result.url) {
        results.push({ kind, url: null, error: result.error ?? "生成失败" });
        continue;
      }

      const res = await fetch(result.url);
      if (!res.ok) {
        results.push({ kind, url: null, error: `下载失败 HTTP ${res.status}` });
        continue;
      }

      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(filePath, buf);
      console.info(`[game-sprite] ${projectId}/${kind} 已保存`);
      results.push({ kind, url: publicUrl });
    } catch (e) {
      results.push({
        kind,
        url: null,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return results;
}
