/**
 * 漫画分镜批量文生图基准（等同页面「生成配图」核心逻辑）
 * 运行：node scripts/benchmark-comic-panel-batch.mjs
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

const { getComfyBaseUrl } = await import("../src/lib/orchestration/comfy-gateway.ts");
const { getImageGenAvailability } = await import("../src/lib/image-generation.ts");
const { getImageGenBatchPanelCount } = await import("../src/lib/model-config.ts");
const { parseComicDocument, renderComicPanels } = await import("../src/lib/comic-panel-render.ts");

const comfy = getComfyBaseUrl();
const avail = getImageGenAvailability();
const batchN = getImageGenBatchPanelCount();

console.log("--- 文生图路径确认 ---");
console.log("COMFY_UI_BASE_URL:", comfy ?? "(未配置 → 不走 ComfyUI)");
console.log("OpenAI 网关:", avail.ok ? avail.message : avail.message);
console.log("IMAGE_GEN_BATCH_PANELS:", batchN);

const doc = parseComicDocument(
  JSON.stringify({
    formatVersion: 2,
    pageCount: 1,
    pages: [
      {
        page: 1,
        panels: [
          { caption: "煤山脚下", prompt: "Late Ming dynasty, Chongzhen Emperor at coal hill, manga panel, cinematic" },
          { caption: "京城风雨", prompt: "Beijing city walls in storm, historical manga, dramatic lighting" },
          { caption: "宫内议事", prompt: "Imperial court ministers debating, Chinese historical manga style" },
          { caption: "黎明破晓", prompt: "Dawn over forbidden city, hopeful mood, manga illustration" },
        ],
      },
    ],
  }),
);

const t0 = Date.now();
const result = await renderComicPanels(doc, {
  onlyMissing: true,
  onProgress: (ev) => {
    if (ev.type === "start") {
      console.log("[progress]", ev.message);
    }
    if (ev.type === "panel_done") {
      console.log(
        `[progress] 格 ${ev.index} ${ev.ok ? "OK" : "FAIL"} provider=${ev.provider ?? "-"}`,
      );
    }
    if (ev.type === "done") {
      console.log("[progress]", ev.message);
    }
  },
});

const totalMs = Date.now() - t0;
const mins = Math.floor(totalMs / 60000);
const secs = Math.floor((totalMs % 60000) / 1000);

console.log("\n--- 结果 ---");
console.log("imageSource:", result.imageSource);
console.log("rendered:", result.rendered, "/", result.total);
if (result.errors.length) console.log("errors:", result.errors);
console.log("总耗时:", `${mins} 分 ${secs} 秒`, `(${totalMs} ms)`);

process.exit(result.rendered > 0 ? 0 : 1);
