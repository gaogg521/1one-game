import fs from "node:fs/promises";
import path from "node:path";
import type { GameSpec } from "@/lib/game-spec";
import { renderProceduralBackground, renderProceduralSprite, type ProceduralSpriteKind } from "@/lib/procedural-game-assets";
import { repoPublicPath } from "@/lib/public-path";

const REQUIRED_SPRITES: ProceduralSpriteKind[] = ["player", "hazard", "gem", "power", "boss"];

type Candidate = { kind: ProceduralSpriteKind; url: string | null; error?: string };

export async function completeRequiredGameAssets(input: {
  projectId: string;
  spec: GameSpec;
  backgroundUrl: string | null;
  pngSprites: Candidate[];
  svgSprites: Candidate[];
  rootDir?: string;
}): Promise<{ backgroundUrl: string; sprites: Candidate[] }> {
  const root = input.rootDir ?? repoPublicPath();
  const spriteDir = path.join(/*turbopackIgnore: true*/ root, "game-sprites", input.projectId);
  const backgroundDir = path.join(/*turbopackIgnore: true*/ root, "game-bg");
  await Promise.all([fs.mkdir(spriteDir, { recursive: true }), fs.mkdir(backgroundDir, { recursive: true })]);

  const pngByKind = new Map(input.pngSprites.map((entry) => [entry.kind, entry]));
  const svgByKind = new Map(input.svgSprites.map((entry) => [entry.kind, entry]));
  const sprites: Candidate[] = [];
  for (const kind of REQUIRED_SPRITES) {
    const png = pngByKind.get(kind);
    if (png?.url) {
      sprites.push(png);
      continue;
    }
    const svg = svgByKind.get(kind);
    if (svg?.url) {
      sprites.push({ kind, url: svg.url, error: [png?.error, "svg_fallback"].filter(Boolean).join("; ") });
      continue;
    }
    const target = path.join(/*turbopackIgnore: true*/ spriteDir, `${kind}.png`);
    await fs.writeFile(target, await renderProceduralSprite(kind, input.spec, { rich: true }));
    sprites.push({
      kind,
      url: `/game-sprites/${input.projectId}/${kind}.png`,
      error: [png?.error, svg?.error, "procedural_fallback"].filter(Boolean).join("; "),
    });
  }

  let backgroundUrl = input.backgroundUrl;
  if (!backgroundUrl) {
    await fs.writeFile(
      path.join(/*turbopackIgnore: true*/ backgroundDir, `${input.projectId}.png`),
      await renderProceduralBackground(input.spec, { width: 1024, height: 1024, rich: true }),
    );
    backgroundUrl = `/game-bg/${input.projectId}.png`;
  }

  return { backgroundUrl, sprites };
}
