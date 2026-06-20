/**
 * LLM 降级 BGM：当无第三方 AI 音乐 API Key 时，用 LLM 生成一段旋律音符序列。
 * 格式：{ bpm, notes: [{freq, dur, vol}] }，客户端 Web Audio 播放。
 */
import { llmJson } from "@/lib/llm";
import { getEffectiveModels } from "@/lib/runtime-config";
import type { GameSpec } from "@/lib/game-spec";

export type BgmNote = { freq: number; dur: number; vol?: number };
export type BgmNoteSequence = { bpm: number; notes: BgmNote[] };

/** 从 GameSpec 生成音符序列（16-24 音符，主旋律循环） */
export async function generateBgmNotesFromSpec(spec: GameSpec): Promise<BgmNoteSequence | null> {
  const genre = getBgmGenre(spec);
  const user = buildBgmPrompt(spec, genre);
  const models = getEffectiveModels();
  const model = (models.gameTextPrimary ?? models.gamePrimary) as string;

  const result = await llmJson({
    model,
    system: "You are a game music composer that outputs JSON note sequences. Respond ONLY with valid JSON matching the schema.",
    user,
    mode: "json_object",
    temperature: 0.9,
    timeoutMs: 30000,
  });

  if (!result.ok || !result.raw) return null;

  try {
    const raw = result.raw as Record<string, unknown>;
    return validateBgmNotes(raw);
  } catch {
    return null;
  }
}

function getBgmGenre(spec: GameSpec): string {
  switch (spec.templateId) {
    case "shooter": return "intense electronic action";
    case "towerDefense": return "strategic orchestral";
    case "platformer": return "upbeat chiptune adventure";
    case "puzzle": return "calm ambient";
    case "farming": return "cheerful folk";
    case "avoider": return "tense minimal";
    case "racing": return "fast energetic";
    case "chess": return "classical contemplative";
    case "strategy": return "epic orchestral";
    default: return "cheerful game";
  }
}

function buildBgmPrompt(spec: GameSpec, genre: string): string {
  const theme = spec.theme ?? "adventure";
  const noteCount = 24;
  return `Generate a loopable ${genre} BGM melody for a "${theme}" themed game.
Output exactly ${noteCount} notes as JSON matching this schema:
{
  "bpm": <integer 70-130>,
  "notes": [
    { "freq": <float Hz>, "dur": <float beats 0.25-2>, "vol": <float 0.4-0.9> }
  ]
}
Use pentatonic scale frequencies (e.g. C4=261.63, D4=293.66, E4=329.63, G4=392.00, A4=440.00, C5=523.25, D5=587.33, E5=659.26, G5=783.99, A5=880.00).
Make it catchy and loop-friendly (end near the starting note). Vary rhythm. Total duration should be 8-16 seconds.`;
}

function validateBgmNotes(raw: Record<string, unknown>): BgmNoteSequence {
  const bpm = typeof raw.bpm === "number" && raw.bpm >= 40 && raw.bpm <= 200 ? raw.bpm : 100;
  const notes = Array.isArray(raw.notes) ? raw.notes : [];
  const validated: BgmNote[] = [];
  for (const n of notes) {
    if (!n || typeof n !== "object") continue;
    const freq = typeof n.freq === "number" ? n.freq : 440;
    const dur = typeof n.dur === "number" ? Math.max(0.125, Math.min(4, n.dur)) : 0.5;
    const vol = typeof n.vol === "number" ? Math.max(0.1, Math.min(1, n.vol)) : 0.6;
    if (freq > 50 && freq < 5000) validated.push({ freq, dur, vol });
  }
  if (validated.length === 0) throw new Error("no valid notes");
  return { bpm, notes: validated };
}
