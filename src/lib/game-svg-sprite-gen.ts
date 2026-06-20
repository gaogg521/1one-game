/**
 * SVG Sprite 生成器 — 文本 LLM 生成 64x64 SVG 替换几何图形
 * 无需图片生成 API，速度比 PNG 生成快 10x，零额外成本
 */
import fs from "fs";
import path from "path";
import type { GameSpec } from "@/lib/game-spec";
import { repoPublicPath } from "@/lib/public-path";
import { llmText } from "@/lib/llm";

const SPRITE_DIR = repoPublicPath("game-sprites");

export type SvgSpriteKind = "player" | "hazard" | "gem" | "power" | "boss";

export type SvgSpriteResult = {
  kind: SvgSpriteKind;
  url: string | null;
  error?: string;
};

function ensureDir(projectId: string): string {
  const dir = path.join(SPRITE_DIR, projectId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function detectTheme(spec: GameSpec): string {
  const allText = [
    spec.title || "",
    spec.labels?.player || "",
    spec.labels?.hazard || "",
    spec.labels?.collectible || "",
    spec.labels?.subtitle || "",
  ]
    .join(" ")
    .toLowerCase();
  if (/植物|僵尸|pvz|豌豆|向日葵|坚果|zombie|plant/.test(allText)) return "pvz";
  if (/太空|宇宙|星际|飞船|space|star|galaxy|飞机|战机|shooter/.test(allText) || spec.templateId === "shooter") return "space";
  if (/武侠|江湖|剑客|sword|wuxia/.test(allText)) return "wuxia";
  if (/二次元|动漫|anime|少女|萌|manga/.test(allText)) return "anime";
  if (/赛博|霓虹|cyber|neon/.test(allText)) return "cyber";
  if (/minecraft|方块|我的世界|mc/.test(allText)) return "minecraft";
  if (/农场|种植|farmling|harvest/.test(allText) || spec.templateId === "farming") return "farming";
  if (/塔防|tower|defense|defend/.test(allText) || spec.templateId === "towerdefense") return "towerdefense";
  return "generic";
}

const SYSTEM_PROMPT = `You are a SVG sprite artist for web games. Output ONLY clean SVG code, nothing else.
Rules:
- viewBox="0 0 64 64" always
- Flat cartoon style, bold shapes, no gradients unless absolutely needed
- No <text>, no <image>, no external refs, no filters with feImage
- Self-contained: all colors inline
- Keep it simple: 5-15 shapes max
- Output ONLY the SVG XML starting with <svg and ending with </svg>`;

function buildSvgPrompt(spec: GameSpec, kind: SvgSpriteKind): string {
  const theme = detectTheme(spec);
  const pc = spec.theme.playerColor ?? "#4ade80";
  const hc = spec.theme.hazardColor ?? "#f87171";
  const cc = spec.theme.collectibleColor ?? "#facc15";
  const labels = spec.labels ?? {};

  const labelMap: Record<SvgSpriteKind, string> = {
    player: labels.player ?? "hero",
    hazard: labels.hazard ?? "enemy",
    gem: labels.collectible ?? "gem",
    power: "power-up",
    boss: "boss",
  };
  const label = labelMap[kind];

  const themeHints: Record<string, Record<SvgSpriteKind, string>> = {
    space: {
      player: `a player spaceship sprite, futuristic fighter jet top-down view, wings swept back, engine glow, color ${pc}`,
      hazard: `an alien enemy ship sprite, spiky angular hostile design, color ${hc}`,
      gem: `a glowing energy crystal or space coin collectible, star burst shape, color ${cc}`,
      power: `a shield or weapon power-up icon, hexagonal badge, color #60a5fa`,
      boss: `a massive alien mothership boss, huge intimidating design, multiple turrets, color ${hc}`,
    },
    pvz: {
      player: `a cheerful plant character sprite (like a peashooter or sunflower), friendly cartoon, color ${pc}`,
      hazard: `a funny cartoon zombie enemy, tattered clothes, silly grin, arms out, color ${hc}`,
      gem: `a glowing sun collectible, radiant circle with face, warm yellow glow, color ${cc}`,
      power: `a shovel or star power-up badge, cartoon style, color #a78bfa`,
      boss: `a zombie boss with football helmet or top hat, larger meaner zombie, color ${hc}`,
    },
    minecraft: {
      player: `a blocky pixel-art Steve character, square body and head, color ${pc}`,
      hazard: `a blocky creeper enemy, square body, distinctive green face with dark spots, color ${hc}`,
      gem: `a pixel diamond gem, octagonal shape, faceted, color ${cc}`,
      power: `a golden apple or enchanted book power-up, pixel art style, color #facc15`,
      boss: `a blocky Enderman or Wither boss, imposing tall figure, glowing eyes, color ${hc}`,
    },
    wuxia: {
      player: `a martial arts hero sprite, dynamic stance, flowing robes, sword raised, color ${pc}`,
      hazard: `a bandit enemy in dark robes, threatening pose, daggers drawn, color ${hc}`,
      gem: `a glowing jade orb collectible, spherical with inner light, color ${cc}`,
      power: `a scroll or yin-yang power-up amulet, circular badge, color #a78bfa`,
      boss: `a demon king boss in ornate armor, dramatic cape, color ${hc}`,
    },
    cyber: {
      player: `a cyberpunk character sprite, sleek mech suit, neon outlines, color ${pc}`,
      hazard: `a rogue AI drone enemy, angular hostile shape, glowing sensors, color ${hc}`,
      gem: `a neon data crystal collectible, hexagonal faceted gem, color ${cc}`,
      power: `a holographic shield icon, circular badge with circuit pattern, color #60a5fa`,
      boss: `a giant cyber boss mech, looming armored figure, multiple weapons, color ${hc}`,
    },
    farming: {
      player: `a cute farmer character sprite, overalls, straw hat, holding shovel, color ${pc}`,
      hazard: `a menacing crop pest or crows enemy, cartoon animal, color ${hc}`,
      gem: `a shiny golden carrot or coin collectible, sparkle around it, color ${cc}`,
      power: `a watering can or fertilizer bag power-up, cute icon, color #86efac`,
      boss: `a giant pest boss, oversized bug or animal, menacing expression, color ${hc}`,
    },
    towerdefense: {
      player: `a sturdy arrow tower sprite, top-down view, square base with battlements, color ${pc}`,
      hazard: `a round enemy unit marching forward, simple cartoon creature, color ${hc}`,
      gem: `a gold coin collectible, round with star imprint, color ${cc}`,
      power: `a bomb or upgrade orb power-up, round badge, color #f97316`,
      boss: `a heavily armored boss enemy, chunky tank-like creature, color ${hc}`,
    },
    generic: {
      player: `a cute hero character sprite named "${label}", simple cartoon, rounded friendly shapes, color ${pc}`,
      hazard: `a menacing enemy sprite named "${label}", angular spiky shapes, color ${hc}`,
      gem: `a collectible item named "${label}", shiny gem or coin, color ${cc}`,
      power: `a power-up item named "${label}", glowing star or badge icon, color #60a5fa`,
      boss: `a boss enemy named "${label}", larger and more imposing version of the enemy, color ${hc}`,
    },
  };

  const hints = themeHints[theme] ?? themeHints.generic;
  const kindHint = hints[kind];

  return `Draw ${kindHint} as a flat cartoon SVG sprite. viewBox="0 0 64 64", background transparent (no background rect), centered in the 64x64 canvas. Keep it simple and clear, 5-15 SVG shapes, output only SVG XML.`;
}

function extractSvg(text: string): string | null {
  const match = text.match(/<svg[\s\S]*?<\/svg>/i);
  if (!match) return null;
  let svg = match[0];
  // Ensure viewBox is set
  if (!svg.includes("viewBox")) {
    svg = svg.replace("<svg", `<svg viewBox="0 0 64 64"`);
  }
  // Remove external resources for safety
  svg = svg.replace(/xlink:href="http[^"]*"/g, "");
  return svg;
}

async function generateOneSvg(spec: GameSpec, kind: SvgSpriteKind, dir: string): Promise<SvgSpriteResult> {
  const filePath = path.join(dir, `${kind}.svg`);
  // Skip if already exists
  if (fs.existsSync(filePath)) {
    return { kind, url: `/game-sprites/${path.basename(dir)}/${kind}.svg` };
  }

  const userPrompt = buildSvgPrompt(spec, kind);
  try {
    const result = await llmText({
      model: "gpt-4.1-mini",
      system: SYSTEM_PROMPT,
      user: userPrompt,
      maxTokens: 1200,
      temperature: 0.7,
      timeoutMs: 20_000,
    });

    if (!result.ok) {
      return { kind, url: null, error: result.error };
    }
    if (!result.text) {
      return { kind, url: null, error: "no text" };
    }

    const svg = extractSvg(result.text);
    if (!svg) {
      return { kind, url: null, error: "LLM did not return valid SVG" };
    }

    fs.writeFileSync(filePath, svg, "utf8");
    return { kind, url: `/game-sprites/${path.basename(dir)}/${kind}.svg` };
  } catch (e) {
    return { kind, url: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * 生成全套 SVG 精灵（player/hazard/gem 并行，power/boss 非关键）
 */
export async function generateSvgSprites(
  projectId: string,
  spec: GameSpec,
): Promise<SvgSpriteResult[]> {
  const dir = ensureDir(projectId);

  // Core sprites first (blocking), power/boss secondary
  const coreKinds: SvgSpriteKind[] = ["player", "hazard", "gem"];
  const secondaryKinds: SvgSpriteKind[] = ["power", "boss"];

  const coreResults = await Promise.all(
    coreKinds.map((k) => generateOneSvg(spec, k, dir)),
  );

  // Kick off secondary in background, don't await
  void Promise.all(secondaryKinds.map((k) => generateOneSvg(spec, k, dir))).catch(() => {
    /* non-critical */
  });

  return coreResults;
}
