import type { LlmProtocol, RuntimeSceneKey } from "@/lib/runtime-providers";

export type SceneDomain = "game" | "novel" | "comic";

export type RuntimeSceneMeta = {
  scene: RuntimeSceneKey;
  domain: SceneDomain;
  labelKey: string;
  descKey: string;
  defaultProtocol: LlmProtocol;
};

/** 产品内建场景 — 可按业务拆到不同 LiteLLM 网关 / 模型池 */
export const RUNTIME_SCENE_CATALOG: RuntimeSceneMeta[] = [
  {
    scene: "game",
    domain: "game",
    labelKey: "sceneGame",
    descKey: "sceneGameDesc",
    defaultProtocol: "openai_compatible",
  },
  {
    scene: "novel",
    domain: "novel",
    labelKey: "sceneNovelBody",
    descKey: "sceneNovelBodyDesc",
    defaultProtocol: "openai_compatible",
  },
  {
    scene: "novel_plan",
    domain: "novel",
    labelKey: "sceneNovelPlan",
    descKey: "sceneNovelPlanDesc",
    defaultProtocol: "openai_compatible",
  },
  {
    scene: "comic_storyboard",
    domain: "comic",
    labelKey: "sceneComicStoryboard",
    descKey: "sceneComicStoryboardDesc",
    defaultProtocol: "openai_compatible",
  },
  {
    scene: "comic_image_openai",
    domain: "comic",
    labelKey: "sceneComicImageOpenAI",
    descKey: "sceneComicImageOpenAIDesc",
    defaultProtocol: "openai_compatible",
  },
  {
    scene: "comic_image_gemini",
    domain: "comic",
    labelKey: "sceneComicImageGemini",
    descKey: "sceneComicImageGeminiDesc",
    defaultProtocol: "gemini",
  },
];

export function sceneMeta(scene: RuntimeSceneKey): RuntimeSceneMeta | undefined {
  return RUNTIME_SCENE_CATALOG.find((s) => s.scene === scene);
}
