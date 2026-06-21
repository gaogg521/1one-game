/**
 * 游戏实体精灵图生成。
 * 用 GameSpec 的 labels + theme 生成文生图 sprite → 落盘 public/game-sprites/{projectId}/
 * Phaser 引擎通过同名 texture 加载（texPlayer/texHazard/texGem/texPower），
 * 若 sprites 不存在则回退现有几何体生成，零破坏。
 */
import fs from "fs";
import path from "path";
import type { GameSpec } from "@/lib/game-spec";
import { repoPublicPath } from "@/lib/public-path";
import { generateImageDetailed } from "@/lib/image-generation";
import { getImageGenAvailability } from "@/lib/image-generation";
import type { CreativeBrief } from "@/lib/creative-brief/types";
import {
  appendBriefVisualDirection,
  buildBriefVisualDirection,
} from "@/lib/assets/brief-visual-direction";
import type { AppLocale } from "@/i18n/routing";
import { assetGenMessage } from "@/lib/i18n/progress-message";
import { templateVisualStyle, buildAssetMoodLine } from "@/lib/assets/template-visual-styles";
import { generateComfySpritePngBuffer, isComfyGameSpriteEnabled } from "@/lib/comfy-game-sprite-gen";

const SPRITE_DIR = repoPublicPath("game-sprites");

function ensureDir(projectId: string) {
  const dir = path.join(/*turbopackIgnore: true*/ SPRITE_DIR, projectId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

type SpriteKind = "player" | "hazard" | "gem" | "power" | "boss";

const CARD_GAME_TEMPLATE_IDS = new Set([
  "dou-dizhu", "poker", "mahjong", "mahjong-solitaire", "uno",
  "blackjack", "solitaire", "chess",
]);

export function buildSpritePrompt(spec: GameSpec, kind: SpriteKind): string {
  const bgColor = spec.theme.backgroundColor || "#1a1a2e";
  const templateCtx = templateVisualStyle(spec.templateId, "casual arcade game");
  const mood = buildAssetMoodLine(spec);
  const sceneLine = `game mood: ${mood}, scene: ${templateCtx}`;
  const title = (spec.title || "").toLowerCase();
  const labels = spec.labels || {};
  const playerLabel = (labels.player || "hero").toLowerCase();
  const hazardLabel = (labels.hazard || "enemy").toLowerCase();
  const collLabel = (labels.collectible || "gem").toLowerCase();
  const subtitle = (labels.subtitle || "").toLowerCase();
  const allText = `${title} ${playerLabel} ${hazardLabel} ${collLabel} ${subtitle}`;

  // 卡牌/棋类游戏：贴图主体是牌背/棋子图标，不需要 action 角色精灵
  const isCardGame = CARD_GAME_TEMPLATE_IDS.has(spec.templateId);
  if (isCardGame) {
    const pc = spec.theme.playerColor || "#fbbf24";
    const hc = spec.theme.hazardColor || "#ef4444";
    const cc = spec.theme.collectibleColor || "#a3e635";
    switch (kind) {
      case "player":
        return [
          `2D card game icon, front-facing card back or token symbol, bold graphic style`,
          `dominant color ${pc}, clean flat vector design`,
          `solid ${bgColor} background, suitable for ${templateCtx}`,
          `no text, no UI overlay, 1:1 aspect ratio`,
        ].join(", ");
      case "hazard":
        return [
          `2D card game opponent icon, stylized player avatar or card symbol`,
          `dominant color ${hc}, flat clean vector`,
          `solid ${bgColor} background, suitable for ${templateCtx}`,
          `no text, no UI overlay, 1:1 aspect ratio`,
        ].join(", ");
      case "gem":
      case "power":
        return [
          `2D card game collectible icon, poker chip or score token`,
          `dominant color ${cc}, shiny metallic round token`,
          `solid ${bgColor} background, flat vector style`,
          `no text, no UI overlay, 1:1 aspect ratio`,
        ].join(", ");
      case "boss":
        return [
          `2D card game boss icon, large stylized joker or ace card symbol`,
          `dramatic design, dominant color ${hc}, bold graphic style`,
          `solid ${bgColor} background, flat vector`,
          `no text, 1:1 aspect ratio`,
        ].join(", ");
    }
  }

  // 检测具体游戏风格，生成更有针对性的提示词
  // 注：fighting/moba/strategy 模板排除在外，防止 fighter/射手/防线 等词误触
  const isPvZ =
    spec.templateId !== "strategy" &&
    spec.templateId !== "fighting" &&
    spec.templateId !== "moba" &&
    /植物|僵尸|pvz|豌豆|向日葵|坚果|zombie|plant|温室|阳光|腐化|变异/.test(allText);
  const isSpace =
    spec.templateId !== "fighting" &&
    spec.templateId !== "moba" &&
    spec.templateId !== "strategy" &&
    (/太空|宇宙|星际|飞船|space|galaxy|星云|战舰|飞机|战机|敌机|空战|弹幕|打飞机|plane|aircraft|dogfight/i.test(
      allText,
    ) ||
      spec.templateId === "shooter");
  const isWuxia = /武侠|江湖|剑客|sword|wuxia|门派|内力/.test(allText);
  const isAnime = /二次元|动漫|anime|少女|萌|机甲|manga/.test(allText);
  const isCyber = /赛博|霓虹|cyber|neon|全息|机甲/.test(allText);
  const isFolk = /民俗|节庆|庙会|灯笼|folk|festival|舞狮|舞龙/.test(allText);
  const isSports = /体育|足球|篮球|运动|sport|soccer|basketball/.test(allText);
  const isMinecraft = /方块|我的世界|minecraft|mc|史蒂夫|苦力怕/.test(allText);

  switch (kind) {
    case "player": {
      const color = spec.theme.playerColor || "#4a90d9";
      if (isPvZ) {
        return [
          `2D game plant character sprite, cute cartoon pea-shooter or sunflower style from Plants vs Zombies`,
          `friendly expressive face, rounded leafy body, front-facing or 3/4 view`,
          `dominant color ${color}, colorful casual cartoon game art`,
          `solid ${bgColor} background, flat clean vector style`,
          sceneLine,
          `suitable for casual tower defense mobile game, 1:1 aspect ratio`,
          `no text, no UI, no weapons`,
        ].join(", ");
      }
      if (isSpace) {
        return [
          `2D game spaceship sprite, top-down view, futuristic star-fighter`,
          `sleek sci-fi design with glowing thrusters, metallic details`,
          `dominant color ${color}, clean vector game art`,
          `solid ${bgColor} background, flat design`,
          sceneLine,
          `suitable for space shooter mobile game, 1:1 aspect ratio`,
          `no text, no UI`,
        ].join(", ");
      }
      if (isMinecraft) {
        return [
          `2D Minecraft-style character sprite, blocky pixelated Steve-like hero`,
          `front-facing, simple geometric shapes, iconic square head and body`,
          `dominant color ${color}, retro pixel art aesthetic`,
          `solid ${bgColor} background, crisp edges`,
          sceneLine,
          `suitable for Minecraft-inspired mobile game, 1:1 aspect ratio`,
          `no text, no UI`,
        ].join(", ");
      }
      if (isWuxia) {
        return [
          `2D Chinese martial arts hero sprite, wuxia swordsman in flowing robes`,
          `front-facing, elegant pose, long hair and traditional clothing`,
          `dominant color ${color}, ink-wash and cel-shaded hybrid style`,
          `solid ${bgColor} background, clean game art`,
          sceneLine,
          `suitable for wuxia action mobile game, 1:1 aspect ratio`,
          `no text, no UI`,
        ].join(", ");
      }
      return [
        `2D game character sprite for "${labels.player || "hero"}", a cute chibi game hero`,
        `centered front-facing, simple clean vector game art style`,
        `dominant color ${color}, rounded friendly shapes`,
        `isolated on solid ${bgColor} background, flat design`,
        sceneLine,
        `suitable for casual mobile web game, 1:1 aspect ratio`,
        `no text, no UI, no weapons unless thematically required`,
      ].join(", ");
    }
    case "hazard": {
      const color = spec.theme.hazardColor || "#e74c3c";
      if (isPvZ) {
        return [
          `2D game zombie enemy sprite, funny cartoon zombie with tattered clothes`,
          `front-facing, silly expressive face, arms reaching forward`,
          `dominant color ${color}, Plants vs Zombies cartoon style`,
          `solid ${bgColor} background, flat clean vector style`,
          sceneLine,
          `suitable for casual tower defense mobile game, 1:1 aspect ratio`,
          `no text, no UI`,
        ].join(", ");
      }
      if (isSpace) {
        return [
          `2D alien enemy spaceship sprite, menacing enemy cruiser or drone`,
          `top-down view, angular aggressive design, glowing weapons`,
          `dominant color ${color}, sci-fi vector game art`,
          `solid ${bgColor} background, flat design`,
          sceneLine,
          `suitable for space shooter mobile game, 1:1 aspect ratio`,
          `no text, no UI`,
        ].join(", ");
      }
      if (isMinecraft) {
        return [
          `2D Minecraft-style creeper or zombie monster sprite, blocky pixelated enemy`,
          `front-facing, iconic square body, recognizable Minecraft mob design`,
          `dominant color ${color}, retro pixel art aesthetic`,
          `solid ${bgColor} background, crisp edges`,
          sceneLine,
          `suitable for Minecraft-inspired mobile game, 1:1 aspect ratio`,
          `no text, no UI`,
        ].join(", ");
      }
      if (isWuxia) {
        return [
          `2D Chinese martial arts enemy sprite, bandit or rival swordsman in dark robes`,
          `front-facing, threatening stance, traditional weapons`,
          `dominant color ${color}, ink-wash and cel-shaded hybrid style`,
          `solid ${bgColor} background, clean game art`,
          sceneLine,
          `suitable for wuxia action mobile game, 1:1 aspect ratio`,
          `no text, no UI`,
        ].join(", ");
      }
      return [
        `2D game enemy sprite for "${labels.hazard || "enemy"}", a menacing but cute game monster`,
        `centered front-facing, simple clean vector game art style`,
        `dominant color ${color}, angular spiky shapes`,
        `isolated on solid ${bgColor} background, flat design`,
        sceneLine,
        `suitable for casual mobile web game, 1:1 aspect ratio`,
        `no text, no UI`,
      ].join(", ");
    }
    case "gem": {
      const color = spec.theme.collectibleColor || spec.theme.playerColor || "#f1c40f";
      if (isPvZ) {
        return [
          `2D game sun or coin collectible sprite, shiny golden sun-drop or coin`,
          `glowing radiant, simple clean cartoon style`,
          `dominant color ${color}, Plants vs Zombies inspired`,
          `solid ${bgColor} background`,
          sceneLine,
          `suitable for casual tower defense mobile game, 1:1 aspect ratio`,
          `no text, no UI`,
        ].join(", ");
      }
      if (isSpace) {
        return [
          `2D game energy crystal collectible sprite, glowing sci-fi power orb`,
          `geometric crystalline shape, bright sparkle, energy pulse effect`,
          `dominant color ${color}, vector game art`,
          `solid ${bgColor} background`,
          sceneLine,
          `suitable for space shooter mobile game, 1:1 aspect ratio`,
          `no text, no UI`,
        ].join(", ");
      }
      return [
        `2D game collectible item sprite for "${labels.collectible || "gem"}", a shiny pickup item`,
        `centered, simple clean vector game art style`,
        `dominant color ${color}, glowing radiant`,
        `isolated on solid ${bgColor} background`,
        sceneLine,
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
        sceneLine,
        `suitable for casual mobile web game, 1:1 aspect ratio`,
        `no text, no UI`,
      ].join(", ");
    }
    case "boss": {
      const color = spec.theme.hazardColor || "#cc0000";
      if (isPvZ) {
        return [
          `2D game boss zombie sprite, large intimidating boss zombie with cone or bucket hat`,
          `towering menacing design, front-facing, exaggerated cartoon proportions`,
          `dominant color ${color}, Plants vs Zombies cartoon style`,
          `solid ${bgColor} background, flat clean vector style`,
          sceneLine,
          `suitable for casual tower defense mobile game, 1:1 aspect ratio`,
          `no text, no UI`,
        ].join(", ");
      }
      if (isSpace) {
        return [
          `2D game boss alien mothership sprite, massive enemy flagship`,
          `top-down view, heavy armored design, glowing core weapon`,
          `dominant color ${color}, sci-fi vector game art`,
          `solid ${bgColor} background, flat design`,
          sceneLine,
          `suitable for space shooter mobile game, 1:1 aspect ratio`,
          `no text, no UI`,
        ].join(", ");
      }
      return [
        `2D game boss enemy sprite for "${labels.hazard || "boss"}", a large intimidating boss monster`,
        `centered front-facing, towering menacing design`,
        `dominant color ${color}, dark shadows, glowing red eyes`,
        `isolated on solid ${bgColor} background`,
        sceneLine,
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

async function generateOneSprite(
  projectId: string,
  spec: GameSpec,
  kind: SpriteKind,
  dir: string,
  brief: CreativeBrief | null | undefined,
  ag: (key: string, p?: Record<string, string | number | undefined | null>) => string,
): Promise<SpriteGenResult> {
  const filePath = path.join(/*turbopackIgnore: true*/ dir, `${kind}.png`);
  const publicUrl = `/game-sprites/${projectId}/${kind}.png`;

  if (fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
    console.info(`[game-sprite] 复用缓存 ${projectId}/${kind}`);
    return { kind, url: publicUrl };
  }

  const prompt = appendBriefVisualDirection(
    buildSpritePrompt(spec, kind),
    buildBriefVisualDirection(brief),
  );
  console.info(`[game-sprite] 生成 ${projectId}/${kind}…`);

  try {
    let buf: Buffer | null = null;
    if (isComfyGameSpriteEnabled()) {
      buf = await generateComfySpritePngBuffer(prompt, {
        filenamePrefix: `sprite_${projectId.slice(0, 8)}_${kind}`,
        negative: "blurry, text, watermark, logo, UI mockup, multiple characters",
      });
      if (buf) console.info(`[game-sprite] ${projectId}/${kind} via Comfy 256→512`);
    }

    if (!buf) {
      const result = await generateImageDetailed(prompt, {
        size: "1024x1024",
        quality: "standard",
      });

      if (!result.ok || !result.url) {
        console.warn(`[game-sprite] ${projectId}/${kind} 生成失败：${result.error ?? "无返回"}`);
        return { kind, url: null, error: result.error ?? ag("generateFailed") };
      }

      if (result.localPath && fs.existsSync(result.localPath)) {
        buf = fs.readFileSync(result.localPath);
      } else {
        const res = await fetch(result.url);
        if (!res.ok) {
          return { kind, url: null, error: ag("downloadFailedHttp", { status: res.status }) };
        }
        buf = Buffer.from(await res.arrayBuffer());
      }
    }

    fs.writeFileSync(/*turbopackIgnore: true*/ filePath, buf);
    console.info(`[game-sprite] ${projectId}/${kind} 已保存`);
    return { kind, url: publicUrl };
  } catch (e) {
    return {
      kind,
      url: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function generateGameSprites(
  projectId: string,
  spec: GameSpec,
  uiLocale: AppLocale = "zh-Hans",
  brief?: CreativeBrief | null,
): Promise<SpriteGenResult[]> {
  const ag = (key: string, p?: Record<string, string | number | undefined | null>) =>
    assetGenMessage(uiLocale, key, p);
  const availability = getImageGenAvailability();
  const kinds: SpriteKind[] = ["player", "hazard", "gem", "power", "boss"];
  if (!availability.ok) {
    return kinds.map((kind) => ({
      kind,
      url: null,
      error: availability.message,
    }));
  }

  const dir = ensureDir(projectId);
  return Promise.all(
    kinds.map((kind) => generateOneSprite(projectId, spec, kind, dir, brief, ag)),
  );
}
