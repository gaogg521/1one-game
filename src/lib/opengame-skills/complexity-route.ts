import type { GameSpec } from "@/lib/game-spec";
import type { TemplateArchetypeId } from "@/lib/opengame-skills/types";

/** 生成档位：对齐 OpenGame 简单 prompt 秒开 vs 复杂 prompt 需 Agentic+Skills */
export type OpenGameGenerationTier = "spec_fast" | "agentic_standard" | "agentic_complex";

export type PromptComplexityResult = {
  tier: OpenGameGenerationTier;
  score: number;
  signals: string[];
  /** 复杂 prompt 跳过 template-first，强制走 LLM Agentic + Skills */
  skipTemplateFirst: boolean;
  /** 覆盖 Template Skill archetype（如 ui_heavy / gravity_side_view） */
  archetypeHint?: TemplateArchetypeId;
};

const COMPLEX_PATTERNS: { re: RegExp; weight: number; signal: string; archetype?: TemplateArchetypeId }[] = [
  { re: /选角|character select|hero roster|playable heroes?/i, weight: 3, signal: "character_select", archetype: "gravity_side_view" },
  { re: /(\d+)\s*(个|关|层|stage|level)/i, weight: 2, signal: "multi_level" },
  { re: /boss|最终关|final boss|ultimate|必杀|大招/i, weight: 2, signal: "boss_or_ultimate" },
  { re: /卡牌|card battle|turn.?based|quiz|问答|duel|modals?/i, weight: 3, signal: "ui_heavy_mechanic", archetype: "ui_heavy" },
  { re: /双人|two.?player|local multiplayer|pvp/i, weight: 2, signal: "multiplayer" },
  { re: /pixel art|16.?bit|arcade cabinet|side.?scroll/i, weight: 1, signal: "rich_visual_brief" },
  { re: /tower defense|塔防|wave|炮塔|种植物/i, weight: 1, signal: "td_brief", archetype: "path_and_wave" },
  { re: /twin.?stick|top.?down|俯视角|mandolarian/i, weight: 1, signal: "top_down_brief", archetype: "top_down_continuous" },
  { re: /marvel|avengers|harry potter|star wars|squid game|kof|snk/i, weight: 2, signal: "franchise_epic" },
];

const SIMPLE_PATTERNS: { re: RegExp; weight: number; signal: string }[] = [
  { re: /^(躲开|收集|简单|tiny|minimal|demo)/i, weight: -2, signal: "minimal_intent" },
  { re: /(一条命|单屏|点击)/i, weight: -1, signal: "single_screen" },
];

export function classifyPromptComplexity(prompt: string, spec?: Pick<GameSpec, "title" | "labels">): PromptComplexityResult {
  const text = [prompt, spec?.title, spec?.labels?.subtitle].filter(Boolean).join("\n");
  let score = 0;
  const signals: string[] = [];
  let archetypeHint: TemplateArchetypeId | undefined;

  for (const p of COMPLEX_PATTERNS) {
    if (p.re.test(text)) {
      score += p.weight;
      signals.push(p.signal);
      if (p.archetype) archetypeHint = p.archetype;
    }
  }
  for (const p of SIMPLE_PATTERNS) {
    if (p.re.test(text)) {
      score += p.weight;
      signals.push(p.signal);
    }
  }

  // 长 prompt 通常对应 OpenGame 式 GDD
  if (text.length > 480) {
    score += 2;
    signals.push("long_prompt");
  }
  if (text.length > 1200) {
    score += 2;
    signals.push("very_long_prompt");
  }

  let tier: OpenGameGenerationTier = "agentic_standard";
  if (score <= 0) tier = "spec_fast";
  else if (score >= 4) tier = "agentic_complex";

  return {
    tier,
    score,
    signals: [...new Set(signals)],
    skipTemplateFirst: tier === "agentic_complex",
    archetypeHint,
  };
}

export function shouldSkipTemplateFirstForPrompt(prompt: string, spec: GameSpec): boolean {
  if (process.env.AGENTIC_FORCE_LLM === "1") return true;
  return classifyPromptComplexity(prompt, spec).skipTemplateFirst;
}
