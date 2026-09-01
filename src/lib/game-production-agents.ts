import type { CreativeBrief } from "@/lib/creative-brief/types";
import type { GameSpec } from "@/lib/game-spec";
import type { GameArtDirection } from "@/lib/game-art-direction";
import { llmJson } from "@/lib/llm";
import { resolveGameModelRoute } from "@/lib/game-model-route";
import { runtimeLocaleGroupForCurrentRequest } from "@/lib/runtime-locale-routing";
import { getRuntimeConfigSync } from "@/lib/runtime-config";
import { resolveSceneRoute } from "@/lib/runtime-providers";
import { createOpenAIClientForProvider } from "@/lib/runtime-llm-client";

export type RealAgentExecution = {
  role: "design_director" | "art_director" | "scene_designer" | "runtime_engineer" | "audio_agent" | "visual_review_agent";
  provider: string;
  model: string;
  status: "succeeded" | "failed";
  startedAt: string;
  completedAt: string;
  inputDigest: string;
  outputDigest: string;
  mutates: string[];
};

export type RealGamePlanningAgents = {
  design: { playerFantasy: string; coreLoop: string; firstMinute: string[]; gameFeel: string[] };
  artDirection: GameArtDirection;
  scene: { layers: string[]; landmarks: string[]; compositionRules: string[]; cameraMotion: string };
  executions: RealAgentExecution[];
  augmentedPrompt: string;
};

export type RealVisualReview = { passed: boolean; score: number; blockers: string[]; revisionInstructions: string[]; screenshotBytes: number };

const DESIGN_SCHEMA = {
  name: "game_design_agent_output",
  strict: true,
  schema: { type: "object", additionalProperties: false, required: ["playerFantasy", "coreLoop", "firstMinute", "gameFeel"], properties: {
    playerFantasy: { type: "string" }, coreLoop: { type: "string" },
    firstMinute: { type: "array", minItems: 3, items: { type: "string" } },
    gameFeel: { type: "array", minItems: 3, items: { type: "string" } },
  } },
};
const ART_SCHEMA = {
  name: "game_art_agent_output",
  strict: true,
  schema: { type: "object", additionalProperties: false, required: ["visualLanguage", "camera", "sceneComposition", "promptSuffix", "negativePrompt"], properties: {
    visualLanguage: { type: "string" }, camera: { type: "string" }, sceneComposition: { type: "string" },
    promptSuffix: { type: "string" }, negativePrompt: { type: "string" },
  } },
};
const SCENE_SCHEMA = {
  name: "game_scene_agent_output",
  strict: true,
  schema: { type: "object", additionalProperties: false, required: ["layers", "landmarks", "compositionRules", "cameraMotion"], properties: {
    layers: { type: "array", minItems: 4, items: { type: "string" } },
    landmarks: { type: "array", minItems: 3, items: { type: "string" } },
    compositionRules: { type: "array", minItems: 3, items: { type: "string" } },
    cameraMotion: { type: "string" },
  } },
};

function digest(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}

export async function runRealGamePlanningAgents(input: { prompt: string; spec: GameSpec; brief?: CreativeBrief | null }): Promise<RealGamePlanningAgents> {
  const localeGroup = await runtimeLocaleGroupForCurrentRequest();
  const route = resolveGameModelRoute({ prompt: input.prompt, localeGroup });
  const model = route.models[0];
  if (!model) throw new Error("real_game_agents_model_missing");
  const executions: RealAgentExecution[] = [];
  const call = async <T>(role: RealAgentExecution["role"], system: string, user: string, schema: unknown, mutates: string[]): Promise<T> => {
    const startedAt = new Date().toISOString();
    const result = await llmJson({ model, scene: route.scene, localeGroup, system, user, temperature: 0.42, mode: "json_schema", jsonSchema: schema, timeoutMs: 90_000 });
    const completedAt = new Date().toISOString();
    executions.push({ role, provider: result.provider, model: result.model, status: result.ok ? "succeeded" : "failed", startedAt, completedAt, inputDigest: digest({ system, user }), outputDigest: digest(result.ok ? result.raw : result.error), mutates });
    if (!result.ok) throw new Error(`${role}_failed:${result.error}`);
    return result.raw as T;
  };
  const shared = JSON.stringify({ prompt: input.prompt, spec: input.spec, brief: input.brief ?? null });
  const design = await call<RealGamePlanningAgents["design"]>("design_director", "You are the game design agent. Produce concrete first-minute gameplay and game-feel instructions that downstream agents must implement. Do not write commentary.", shared, DESIGN_SCHEMA, ["game_design_directive", "runtime_prompt"]);
  const art = await call<Omit<GameArtDirection, "version" | "kind" | "requiredAssetSlots">>("art_director", "You are the art director agent. Define a cohesive production art brief for the exact game, with camera, composition, lighting, scale, and negative constraints. Your output will directly drive image generation.", JSON.stringify({ ...JSON.parse(shared), design }), ART_SCHEMA, ["game_art_direction", "asset_generation_prompts"]);
  const artDirection: GameArtDirection = { version: 1, kind: "game_art_direction", requiredAssetSlots: ["background", "player", "enemy", "collectible", "ui"], ...art };
  const scene = await call<RealGamePlanningAgents["scene"]>("scene_designer", "You are the scene design agent. Specify the actual layered scene, landmarks, scale relationships, readable gameplay composition, and camera movement. The runtime code agent must implement these instructions.", JSON.stringify({ prompt: input.prompt, design, artDirection }), SCENE_SCHEMA, ["scene_design", "runtime_prompt"]);
  const augmentedPrompt = [input.prompt, "REAL DESIGN AGENT OUTPUT:", JSON.stringify(design), "REAL ART AGENT OUTPUT:", JSON.stringify(artDirection), "REAL SCENE AGENT OUTPUT:", JSON.stringify(scene), "Implement these outputs in the executable scene. Do not replace them with a generic template."].join("\n");
  return { design, artDirection, scene, executions, augmentedPrompt };
}

export async function runRealVisualReviewAgent(input: { projectId: string; prompt: string }): Promise<{ review: RealVisualReview; execution: RealAgentExecution }> {
  const base = (process.env.PLAYWRIGHT_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:8888").replace(/\/$/, "");
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch();
  let png: Buffer;
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
    await page.goto(`${base}/zh-Hans/play/${input.projectId}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const canvas = page.locator('[role="application"] canvas, canvas').first();
    await canvas.waitFor({ state: "visible", timeout: 45_000 });
    await page.waitForTimeout(4_000);
    png = await canvas.screenshot({ type: "png" });
  } finally {
    await browser.close();
  }
  const route = resolveSceneRoute(getRuntimeConfigSync().payload, "game_vision");
  if (!route) throw new Error("visual_review_agent_model_missing");
  const model = route.models[0];
  if (!model) throw new Error("visual_review_agent_model_missing");
  const startedAt = new Date().toISOString();
  const client = createOpenAIClientForProvider(route.provider);
  const response = await client.chat.completions.create({
    model,
    temperature: 0.1,
    max_tokens: 800,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "You are the independent visual review agent for a production mobile game. Inspect the actual browser canvas screenshot. Reject prototype-like visuals, tiny actors, empty scenes, weak composition, incoherent scale, placeholder geometry, poor contrast, or insufficient game feel. Return JSON only: {passed:boolean,score:number,blockers:string[],revisionInstructions:string[]}. Passing requires a polished, commercially presentable screenshot, not merely a non-empty canvas." },
      { role: "user", content: [
        { type: "text", text: `Original request: ${input.prompt}\nReview the final rendered gameplay screenshot, not the design document.` },
        { type: "image_url", image_url: { url: `data:image/png;base64,${png.toString("base64")}` } },
      ] },
    ],
  });
  const raw = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as Partial<RealVisualReview>;
  const score = Number.isFinite(parsed.score) ? Math.max(0, Math.min(100, Number(parsed.score))) : 0;
  const blockers = Array.isArray(parsed.blockers) ? parsed.blockers.filter((item): item is string => typeof item === "string").slice(0, 12) : ["visual_review_invalid"];
  const revisionInstructions = Array.isArray(parsed.revisionInstructions) ? parsed.revisionInstructions.filter((item): item is string => typeof item === "string").slice(0, 12) : [];
  const review: RealVisualReview = { passed: parsed.passed === true && score >= 75 && blockers.length === 0, score, blockers, revisionInstructions, screenshotBytes: png.length };
  const completedAt = new Date().toISOString();
  return { review, execution: { role: "visual_review_agent", provider: route.provider.id, model, status: "succeeded", startedAt, completedAt, inputDigest: digest({ projectId: input.projectId, prompt: input.prompt, screenshotBytes: png.length }), outputDigest: digest(review), mutates: ["visual_review_report", "game_production_candidate"] } };
}
