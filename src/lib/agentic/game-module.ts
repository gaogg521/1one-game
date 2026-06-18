import { z } from "zod";
import type { GameSpec } from "@/lib/game-spec";
import { buildTemplateFallbackModule } from "@/lib/agentic/template-fallback-modules";
import { PRODUCT } from "@/lib/product-config";

/** Phase 3：Agentic 游戏模块契约 */
export const AgenticModuleSchema = z.object({
  version: z.literal(1),
  source: z.string().min(8).max(48_000),
  entry: z.string().min(1).max(32).default("createGame"),
});

export type AgenticGameModule = z.infer<typeof AgenticModuleSchema>;

/** 沙箱内暴露给生成代码的 Engine API（禁止 fs/network/eval） */
export type AgenticEngineContext = {
  width: number;
  height: number;
  colors: {
    background: string;
    player: string;
    accent: string;
  };
  labels: { title: string; subtitle?: string };
  /** 预加载纹理键 / URL（Astrocade 级：封面与试玩资产一致） */
  assets?: {
    backgroundKey?: string | null;
    playerKey?: string | null;
    enemyKey?: string | null;
    backgroundUrl?: string | null;
    playerUrl?: string | null;
  };
  onScore: (delta: number) => void;
  onEnd: (won: boolean) => void;
  rng: () => number;
  /** 与 GameSpec.gameplay.winScore 对齐（AgenticScene 注入） */
  winScore?: number;
};

export type AgenticGameModuleInstance = {
  create: (scene: unknown) => void;
  update?: (scene: unknown, time: number, delta: number) => void;
};

export type AgenticGameFactory = (
  ctx: AgenticEngineContext,
  Phaser: unknown,
) => AgenticGameModuleInstance;

export const AGENTIC_FORBIDDEN =
  /\b(fetch|XMLHttpRequest|WebSocket|import|require)\b|eval\s*\(|new\s+Function\s*\(|\bprocess\.|\bwindow\.open\b|\bdocument\.cookie\b/i;

export function validateAgenticSource(source: string): { ok: true } | { ok: false; reason: string } {
  if (AGENTIC_FORBIDDEN.test(source)) {
    return { ok: false, reason: "forbidden_api" };
  }
  if (source.length > 48_000) return { ok: false, reason: "too_large" };
  return { ok: true };
}

export function parseAgenticModule(raw: unknown): AgenticGameModule | null {
  const r = AgenticModuleSchema.safeParse(raw);
  return r.success ? r.data : null;
}

/** 在受限作用域执行 Agent 生成的模块 */
export function runAgenticModule(
  module: AgenticGameModule,
  ctx: AgenticEngineContext,
  Phaser: unknown,
): AgenticGameModuleInstance | null {
  const check = validateAgenticSource(module.source);
  if (!check.ok) return null;
  try {
    const fn = new Function(
      "Phaser",
      "ctx",
      `"use strict";\n${module.source}\nreturn typeof ${module.entry} === 'function' ? ${module.entry}(ctx, Phaser) : null;`,
    ) as (Phaser: unknown, ctx: AgenticEngineContext) => AgenticGameModuleInstance | null;
    const instance = fn(Phaser, ctx);
    if (!instance || typeof instance.create !== "function") return null;
    return instance;
  } catch {
    return null;
  }
}

/** 离线 fallback：按 templateId 生成可辨认玩法 */
export function buildFallbackAgenticModule(title: string, spec?: Partial<GameSpec> & { templateId?: GameSpec["templateId"] }): AgenticGameModule {
  if (spec?.templateId) {
    const full: GameSpec = {
      version: 1,
      templateId: spec.templateId,
      title: spec.title ?? title,
      theme: spec.theme ?? {
        backgroundColor: "#1a2220",
        playerColor: "#89a884",
        hazardColor: "#9d5838",
        collectibleColor: "#c9a66b",
        particleTint: "#69746c",
      },
      gameplay: spec.gameplay ?? {
        playerSpeed: 300,
        hazardSpeed: 220,
        spawnIntervalMs: 640,
        winScore: 100,
        lives: 3,
      },
      labels: spec.labels ?? { player: "主角", hazard: "障碍", subtitle: "" },
    };
    return buildTemplateFallbackModule(full);
  }
  return {
    version: 1,
    entry: "createGame",
    source: `
function createGame(ctx, Phaser) {
  return {
    create(scene) {
      scene.add.rectangle(ctx.width/2, ctx.height/2, ctx.width, ctx.height,
        Phaser.Display.Color.HexStringToColor(ctx.colors.background).color);
      scene.add.text(ctx.width/2, 40, ctx.labels.title, { fontSize: '22px', color: '#fff' }).setOrigin(0.5);
      let score = 0;
      const t = scene.add.text(20, 20, 'Score 0', { fontSize: '18px', color: '#fff' });
      scene.input.on('pointerdown', () => {
        score += 10;
        t.setText('Score ' + score);
        ctx.onScore(10);
        if (score >= 100) ctx.onEnd(true);
      });
    }
  };
}`,
  };
}

export function shouldUseAgenticRuntime(spec: { agenticModule?: AgenticGameModule | null; templateId?: string }): boolean {
  return Boolean(spec.agenticModule?.source);
}

export { shouldUseDedicatedSceneForTemplateFirst } from "@/lib/opengame-skills/play-route";
