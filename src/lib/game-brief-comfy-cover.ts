import {
  buildGameKeyArtPromptFromBrief,
  briefPackToCoverGenre,
} from "@/lib/creative-brief/cover-prompt";
import type { CreativeBrief } from "@/lib/creative-brief/types";
import { generateComfySingleImage, comfyImageUrl } from "@/lib/comfy-image-gen";
import { generateCover } from "@/lib/cover-generation";
import type { GameSpec } from "@/lib/game-spec";
import { getComfyBaseUrl } from "@/lib/orchestration/comfy-gateway";
import { prisma } from "@/lib/prisma";
import { saveProjectCoverFromBuffer } from "@/lib/project-cover";

function briefNegativePrompt(brief: CreativeBrief): string {
  const base = "blurry, low quality, worst quality, text, watermark, logo, UI mockup";
  const extra = brief.negatives.slice(0, 8).join(", ");
  return extra ? `${base}, ${extra}` : base;
}

async function fetchComfyImageBuffer(base: string, viewUrl: string): Promise<Buffer | null> {
  try {
    const res = await fetch(viewUrl, { signal: AbortSignal.timeout(90_000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * 用 Creative Brief 生成游戏封面：优先 ComfyUI（消费 Brief 正/负面词），否则文生图降级。
 */
export async function generateGameCoverFromBrief(
  projectId: string,
  brief: CreativeBrief,
  spec: GameSpec,
): Promise<{ coverPath: string | null; source: "comfy" | "llm" | "none" }> {
  const gameKeyArtPrompt = buildGameKeyArtPromptFromBrief(brief, spec);
  const negative = briefNegativePrompt(brief);
  const comfyBase = getComfyBaseUrl();

  if (comfyBase) {
    const img = await generateComfySingleImage(gameKeyArtPrompt, {
      negative,
      filenamePrefix: `game_${projectId.slice(0, 8)}`,
    });
    if (img) {
      const viewUrl = comfyImageUrl(comfyBase, img);
      const buf = await fetchComfyImageBuffer(comfyBase, viewUrl);
      if (buf && buf.length > 512) {
        try {
          const rel = await saveProjectCoverFromBuffer(projectId, buf);
          await prisma.project.update({ where: { id: projectId }, data: { coverPath: rel } });
          return { coverPath: rel, source: "comfy" };
        } catch {
          /* fall through */
        }
      }
    }
  }

  const genre = briefPackToCoverGenre(brief.packId);
  const url = await generateCover({
    title: spec.title,
    type: "game",
    genre,
    gameKeyArtPrompt,
  });
  if (!url) return { coverPath: null, source: "none" };

  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = url.startsWith("/")
      ? path.join(process.cwd(), "public", url.replace(/^\//, ""))
      : null;
    if (src) {
      const buf = await fs.readFile(src);
      const rel = await saveProjectCoverFromBuffer(projectId, buf);
      await prisma.project.update({ where: { id: projectId }, data: { coverPath: rel } });
      return { coverPath: rel, source: "llm" };
    }
  } catch {
    /* ignore */
  }

  return { coverPath: null, source: "none" };
}
