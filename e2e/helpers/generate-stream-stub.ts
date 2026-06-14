import type { Page } from "@playwright/test";
import path from "path";
import { mockSpecFromPrompt } from "@/lib/mock-spec";
import type { GameSpec } from "@/lib/game-spec";

const SAMPLE_SPRITE_ID = "sample-smash-the-dummy";
const SPRITE_KINDS = ["player", "hazard", "gem", "power", "boss"] as const;

/** 试玩页 saveAndPlay 会轮询精灵 HEAD；E2E 用样品馆贴图应答 */
export async function stubGameSpriteAssets(page: Page, sampleId = SAMPLE_SPRITE_ID): Promise<void> {
  const root = process.cwd();
  for (const kind of SPRITE_KINDS) {
    const file = path.join(root, "public", "game-sprites", sampleId, `${kind}.png`);
    await page.route(`**/game-sprites/*/${kind}.png`, (route) =>
      route.fulfill({ status: 200, path: file, contentType: "image/png" }),
    );
  }
}

export async function stubBackgroundGenApi(page: Page): Promise<void> {
  await page.route("**/api/projects/*/background", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        backgroundUrl: "/game-bg/sample-smash-the-dummy.png",
        spriteUrls: SPRITE_KINDS.map((kind) => ({
          kind,
          url: `/game-sprites/stub/${kind}.png`,
        })),
      }),
    }),
  );
}

export type GenerateStreamStubOpts = {
  prompt: string;
  templateHint?: string;
  onHit?: () => void;
};

/** 创作页 POST /api/generate/stream 的 SSE 桩（dedicated Scene 路径，不含 agenticModule） */
export async function stubGenerateStreamAgentic(page: Page, opts: GenerateStreamStubOpts): Promise<void> {
  await page.route("**/api/generate/stream", async (route) => {
    opts.onHit?.();
    const spec: GameSpec = mockSpecFromPrompt(opts.prompt);
    const frames = [
      { step: "start", message: "stub start" },
      {
        step: "brief",
        summary: "E2E stub brief",
        lines: ["physics dummy", "combo scoring"],
        brief: {
          version: 1,
          userPrompt: opts.prompt,
          title: spec.title,
          genreId: "casual",
          genreLabel: "休闲",
          logline: spec.labels.subtitle ?? spec.title,
          setting: "E2E",
          world: "sandbox",
          protagonist: spec.labels.player,
          characters: [spec.labels.player],
          antagonists: [spec.labels.hazard],
          coreConflict: "score",
          protagonistGoal: "win",
          plotBeats: ["tap", "combo"],
          keyScenes: ["dummy"],
          tone: "playful",
          writingStyle: ["arcade"],
          narrativeHints: [],
          negatives: [],
          expandSource: "pack",
        },
      },
      { step: "prep", lines: ["E2E stub prep"] },
      { step: "recap", lines: [`template=${spec.templateId}`] },
      {
        step: "done",
        spec,
        source: "mock_e2e",
        debug: { provider: "e2e-stub", llmMode: "stub" },
        message: "done",
      },
    ];
    const body = frames.map((f) => `data: ${JSON.stringify(f)}\n\n`).join("");
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream; charset=utf-8",
      body,
    });
  });
}
