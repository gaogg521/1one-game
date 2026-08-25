import { prisma } from "@/lib/prisma";
import { buildProceduralBgmNotes, generateBgmNotesFromSpec, type BgmNoteSequence } from "@/lib/game-bgm-gen";
import { generateProjectBgmAudio, parseProjectBgmAudio, type ProjectBgmAudio } from "@/lib/game-bgm-audio";
import type { GameSpec } from "@/lib/game-spec";

export type ProjectBgmResult =
  | { source: "audio_model"; audio: ProjectBgmAudio }
  | { source: "llm_notes"; notes: BgmNoteSequence }
  | { source: "procedural_notes"; notes: BgmNoteSequence };

function parseBgmNotes(raw: string | null | undefined): BgmNoteSequence | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<BgmNoteSequence>;
    if (
      typeof value.bpm === "number" && value.bpm >= 40 && value.bpm <= 200 &&
      Array.isArray(value.notes) && value.notes.length > 0 &&
      value.notes.every((note) => typeof note?.freq === "number" && typeof note?.dur === "number")
    ) return value as BgmNoteSequence;
  } catch {
    // A corrupt historical cache must not block a new audio attempt.
  }
  return null;
}

/**
 * One canonical production path for project music. It always attempts an
 * audio-capable `game_bgm` route before accepting a historical note cache.
 */
const inFlightBgmByProject = new Map<string, Promise<ProjectBgmResult>>();

async function ensureProjectBgmOnce(projectId: string, spec: GameSpec): Promise<ProjectBgmResult> {
  const row = await prisma.project.findUnique({
    where: { id: projectId },
    select: { bgmAudioJson: true, bgmNotesJson: true },
  });
  if (!row) return { source: "procedural_notes", notes: buildProceduralBgmNotes(spec) };

  const persistedAudio = parseProjectBgmAudio(row.bgmAudioJson);
  if (persistedAudio) return { source: "audio_model", audio: persistedAudio };

  const audio = await generateProjectBgmAudio(projectId, spec);
  if (audio) {
    await prisma.project.update({ where: { id: projectId }, data: { bgmAudioJson: JSON.stringify(audio) } });
    return { source: "audio_model", audio };
  }

  const cachedNotes = parseBgmNotes(row.bgmNotesJson);
  if (cachedNotes) return { source: "llm_notes", notes: cachedNotes };

  const notes = await generateBgmNotesFromSpec(spec);
  if (notes) {
    await prisma.project.update({ where: { id: projectId }, data: { bgmNotesJson: JSON.stringify(notes) } });
    return { source: "llm_notes", notes };
  }

  const proceduralNotes = buildProceduralBgmNotes(spec);
  await prisma.project.update({ where: { id: projectId }, data: { bgmNotesJson: JSON.stringify(proceduralNotes) } });
  return { source: "procedural_notes", notes: proceduralNotes };
}

/** Coalesce a foreground play request with its creation worker in this process. */
export function ensureProjectBgm(projectId: string, spec: GameSpec): Promise<ProjectBgmResult> {
  const existing = inFlightBgmByProject.get(projectId);
  if (existing) return existing;
  const work = ensureProjectBgmOnce(projectId, spec).finally(() => inFlightBgmByProject.delete(projectId));
  inFlightBgmByProject.set(projectId, work);
  return work;
}
