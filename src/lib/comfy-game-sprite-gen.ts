/**
 * Phase D：Comfy 256 快预览 → sharp 放大至 512/1024（游戏精灵 workflow）
 */
import {
  comfyImageUrl,
  type ComfyTxt2ImgOptions,
} from "@/lib/comfy-image-gen";
import { getComfyBaseUrl } from "@/lib/orchestration/comfy-gateway";
import { loadSharp } from "@/lib/sharp-loader";

const PREVIEW = 256;
const DEFAULT_OUTPUT = 512;

/** `GAME_SPRITE_OUTPUT_PX=512|1024`（默认 512） */
export function resolveSpriteOutputPx(): number {
  const raw = process.env.GAME_SPRITE_OUTPUT_PX?.trim();
  if (!raw) return DEFAULT_OUTPUT;
  const n = parseInt(raw, 10);
  return n === 1024 ? 1024 : DEFAULT_OUTPUT;
}

export function assertComfySpriteOutputPxAllowed(): boolean {
  const raw = process.env.GAME_SPRITE_OUTPUT_PX?.trim();
  if (!raw) return true;
  const n = parseInt(raw, 10);
  return n === 512 || n === 1024;
}

function buildSpriteWorkflow256(positive: string, seed: number, negative: string) {
  return {
    1: { inputs: { ckpt_name: "sdxl_base.safetensors" }, class_type: "CheckpointLoaderSimple" },
    2: { inputs: { text: positive, clip: ["1", 0] }, class_type: "CLIPTextEncode" },
    3: { inputs: { text: negative, clip: ["1", 0] }, class_type: "CLIPTextEncode" },
    4: {
      inputs: { width: PREVIEW, height: PREVIEW, batch_size: 1 },
      class_type: "EmptyLatentImage",
    },
    5: {
      inputs: {
        seed,
        steps: 18,
        cfg: 7,
        sampler_name: "euler_ancestral",
        scheduler: "karras",
        denoise: 1,
        model: ["1", 0],
        positive: ["2", 0],
        negative: ["3", 0],
        latent_image: ["4", 0],
      },
      class_type: "KSampler",
    },
    6: { inputs: { samples: ["5", 0], vae: ["1", 2] }, class_type: "VAEDecode" },
    7: {
      inputs: { filename_prefix: "game_sprite", images: ["6", 0] },
      class_type: "SaveImage",
    },
  };
}

export function isComfyGameSpriteEnabled(): boolean {
  if (process.env.GAME_SPRITE_COMFY === "0") return false;
  if (process.env.GAME_SPRITE_COMFY === "1") return Boolean(getComfyBaseUrl());
  if (process.env.STAGING === "1" || process.env.OPERONE_STAGING === "1") {
    return Boolean(getComfyBaseUrl());
  }
  return false;
}

async function pollComfyHistory(base: string, promptId: string): Promise<{ filename: string; subfolder: string; type: string } | null> {
  const t0 = Date.now();
  while (Date.now() - t0 < 120_000) {
    try {
      const res = await fetch(`${base}/history/${promptId}`);
      if (!res.ok) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      const data = (await res.json()) as Record<string, { outputs?: Record<string, { images?: unknown[] }> }>;
      const entry = data[promptId];
      if (!entry) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      for (const nodeId of Object.keys(entry.outputs || {})) {
        const images = entry.outputs?.[nodeId]?.images;
        if (Array.isArray(images) && images.length > 0) {
          return images[0] as { filename: string; subfolder: string; type: string };
        }
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}

/** Comfy 256 预览 → Lanczos 512 PNG buffer */
export async function generateComfySpritePngBuffer(
  positive: string,
  options?: ComfyTxt2ImgOptions,
): Promise<Buffer | null> {
  const base = getComfyBaseUrl();
  if (!base) return null;

  const negative =
    options?.negative?.trim().slice(0, 800) ||
    "blurry, low quality, worst quality, text, watermark, logo, UI";
  const seed = Math.floor(Math.random() * 1_000_000_000);
  const workflow = buildSpriteWorkflow256(positive, seed, negative);
  const prefix = options?.filenamePrefix ?? "game_sprite";
  const node7 = workflow["7"] as { inputs: Record<string, unknown> };
  node7.inputs.filename_prefix = prefix;

  try {
    const promptRes = await fetch(`${base}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow, client_id: `sprite_${Date.now()}` }),
    });
    if (!promptRes.ok) return null;
    const promptData = (await promptRes.json()) as { prompt_id?: string };
    if (!promptData.prompt_id) return null;

    const imgMeta = await pollComfyHistory(base, promptData.prompt_id);
    if (!imgMeta) return null;

    const viewUrl = comfyImageUrl(base, imgMeta);
    const imgRes = await fetch(viewUrl, { signal: AbortSignal.timeout(90_000) });
    if (!imgRes.ok) return null;
    const preview = Buffer.from(await imgRes.arrayBuffer());
    if (preview.length < 256) return null;

    const outputPx = resolveSpriteOutputPx();
    const sharp = await loadSharp();
    return sharp(preview)
      .resize(outputPx, outputPx, { kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}

/** 离线 QA：workflow 尺寸断言 */
export function assertComfySpriteWorkflowPreviewSize(): boolean {
  const wf = buildSpriteWorkflow256("test", 1, "neg");
  const node4 = wf["4"] as { inputs: { width: number; height: number } };
  return node4.inputs.width === PREVIEW && node4.inputs.height === PREVIEW;
}
