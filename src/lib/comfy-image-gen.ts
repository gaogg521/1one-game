/**
 * ComfyUI 侧车图像生成封装。
 * 未配置 COMFY_UI_BASE_URL 时返回空数组，由调用方降级为仅展示提示词。
 */

import { getComfyBaseUrl } from "@/lib/orchestration/comfy-gateway";

const PROMPT_TIMEOUT_MS = 120_000;

interface ComfyImageResult {
  filename: string;
  subfolder: string;
  type: string;
}

const DEFAULT_NEGATIVE = "blurry, low quality, worst quality, text, watermark, logo";

/** 极简 txt2img 工作流：LoadCheckpoint → CLIP → KSampler → VAE → SaveImage */
function buildWorkflowJson(positive: string, seed: number, negative = DEFAULT_NEGATIVE) {
  const neg = negative.trim().slice(0, 800) || DEFAULT_NEGATIVE;
  return {
    1: { inputs: { ckpt_name: "sdxl_base.safetensors" }, class_type: "CheckpointLoaderSimple" },
    2: { inputs: { text: positive, clip: ["1", 0] }, class_type: "CLIPTextEncode" },
    3: { inputs: { text: neg, clip: ["1", 0] }, class_type: "CLIPTextEncode" },
    4: { inputs: { width: 1024, height: 1024, batch_size: 1 }, class_type: "EmptyLatentImage" },
    5: {
      inputs: {
        seed,
        steps: 28,
        cfg: 7.5,
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
    7: { inputs: { filename_prefix: "comic", images: ["6", 0] }, class_type: "SaveImage" },
  };
}

export type ComfyTxt2ImgOptions = {
  negative?: string;
  filenamePrefix?: string;
};

export async function generateComfyImages(
  prompts: string[],
  options?: ComfyTxt2ImgOptions,
): Promise<ComfyImageResult[]> {
  const base = getComfyBaseUrl();
  if (!base) return [];

  const results: ComfyImageResult[] = [];
  const negative = options?.negative;
  const prefix = options?.filenamePrefix ?? "comic";

  for (let i = 0; i < prompts.length; i++) {
    const seed = Math.floor(Math.random() * 1_000_000_000);
    const workflow = buildWorkflowJson(prompts[i], seed, negative);
    if (prefix !== "comic") {
      const node7 = workflow["7"] as { inputs: Record<string, unknown> };
      node7.inputs.filename_prefix = prefix;
    }
    const clientId = `comic_${Date.now()}_${i}`;

    try {
      const promptRes = await fetch(`${base}/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: workflow, client_id: clientId }),
      });
      if (!promptRes.ok) continue;
      const promptData = await promptRes.json();
      const promptId = promptData.prompt_id;
      if (!promptId) continue;

      // 轮询等待结果
      const result = await pollForResult(base, promptId, clientId);
      if (result) results.push(result);
    } catch {
      // 单张失败跳过，继续下一张
    }
  }

  return results;
}

/** 单张 txt2img（游戏 key art / Brief 封面） */
export async function generateComfySingleImage(
  positive: string,
  options?: ComfyTxt2ImgOptions,
): Promise<ComfyImageResult | null> {
  const list = await generateComfyImages([positive], options);
  return list[0] ?? null;
}

async function pollForResult(base: string, promptId: string, _clientId: string): Promise<ComfyImageResult | null> {
  const t0 = Date.now();
  while (Date.now() - t0 < PROMPT_TIMEOUT_MS) {
    try {
      const res = await fetch(`${base}/history/${promptId}`);
      if (!res.ok) {
        await sleep(2000);
        continue;
      }
      const data = await res.json();
      const entry = data[promptId];
      if (!entry) {
        await sleep(2000);
        continue;
      }

      // 查找 outputs 中的 images
      for (const nodeId of Object.keys(entry.outputs || {})) {
        const images = entry.outputs[nodeId]?.images;
        if (Array.isArray(images) && images.length > 0) {
          return images[0];
        }
      }

      // 若 outputs 为空但 status 已完成，再查一次
      if (entry.status?.completed) {
        await sleep(500);
        continue;
      }
    } catch {
      // ignore
    }
    await sleep(2000);
  }
  return null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** 由 filename / subfolder / type 拼出可访问的 view URL */
export function comfyImageUrl(base: string, r: ComfyImageResult): string {
  const q = new URLSearchParams({ filename: r.filename, subfolder: r.subfolder || "", type: r.type || "output" });
  return `${base}/view?${q.toString()}`;
}
