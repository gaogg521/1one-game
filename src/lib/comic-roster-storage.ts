import type { ComicCharacterRoster } from "@/lib/comic-character-roster";

const KEY_PREFIX = "comic-roster:";

export function loadComicRosterFromStorage(novelId: string): ComicCharacterRoster | null {
  if (typeof window === "undefined" || !novelId) return null;
  try {
    const raw = localStorage.getItem(`${KEY_PREFIX}${novelId}`);
    if (!raw) return null;
    const data = JSON.parse(raw) as ComicCharacterRoster;
    if (data?.version === 1 && Array.isArray(data.characters)) return data;
  } catch {
    /* ignore */
  }
  return null;
}

export function saveComicRosterToStorage(novelId: string, roster: ComicCharacterRoster): void {
  if (typeof window === "undefined" || !novelId) return;
  try {
    localStorage.setItem(`${KEY_PREFIX}${novelId}`, JSON.stringify(roster));
  } catch {
    /* ignore */
  }
}
