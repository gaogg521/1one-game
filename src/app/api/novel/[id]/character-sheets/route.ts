import { NextResponse } from "next/server";
import { getOwnerKey } from "@/lib/owner";
import { prisma } from "@/lib/prisma";
import {
  emptyComicCharacterRoster,
  parseComicCharacterRoster,
  type ComicCharacterRoster,
} from "@/lib/comic-character-roster";
import { generateCharacterSheets } from "@/lib/comic-character-sheet-gen";
import { loadNovelCharacterRoster, saveNovelCharacterRoster } from "@/lib/novel-character-roster-db";
import { parseComicStylePreset, type ComicStylePresetId } from "@/lib/comic-style-presets";
import { localizedJsonError } from "@/lib/api/localized-error";
import { resolveRequestLocaleSync } from "@/lib/i18n/request-locale";

type RouteContext = { params: Promise<{ id: string }> };

function mergeSheetResults(
  roster: ComicCharacterRoster,
  results: Awaited<ReturnType<typeof generateCharacterSheets>>,
): ComicCharacterRoster {
  const byId = new Map(results.map((r) => [r.characterId, r]));
  return {
    ...roster,
    characters: roster.characters.map((c) => {
      const hit = byId.get(c.id);
      if (!hit?.url) return c;
      return { ...c, referenceImageUrl: hit.url };
    }),
  };
}

export async function POST(req: Request, ctx: RouteContext) {
  const ownerKey = await getOwnerKey();
  if (!ownerKey) {
    return localizedJsonError(req, "unauthorized", 401);
  }

  const { id } = await ctx.params;
  const row = await prisma.novel.findUnique({ where: { id }, select: { ownerKey: true } });
  if (!row || row.ownerKey !== ownerKey) {
    return localizedJsonError(req, "notFound", 404);
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const payload = body as { characterIds?: unknown; stylePreset?: unknown };
  const filterIds = Array.isArray(payload.characterIds)
    ? payload.characterIds.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    : null;
  const stylePreset: ComicStylePresetId =
    typeof payload.stylePreset === "string"
      ? parseComicStylePreset(payload.stylePreset)
      : "japanese_clean";

  const roster = (await loadNovelCharacterRoster(id)) ?? emptyComicCharacterRoster();
  const targets = roster.characters.filter((c) => {
    if (filterIds?.length && !filterIds.includes(c.id)) return false;
    return c.name.trim() && c.appearanceZh.trim();
  });

  if (!targets.length) {
    return localizedJsonError(req, "characterSheetNoTargets", 400);
  }

  const uiLocale = resolveRequestLocaleSync(req);
  const results = await generateCharacterSheets({
    subjects: targets.map((c) => ({
      id: c.id,
      name: c.name.trim(),
      visualDesc: [c.appearanceZh.trim(), c.outfitZh?.trim()].filter(Boolean).join("；"),
    })),
    stylePreset,
    comicKey: `novel-${id}`,
    uiLocale,
  });

  const nextRoster = mergeSheetResults(roster, results);
  await saveNovelCharacterRoster(id, nextRoster);

  return NextResponse.json({
    ok: true,
    roster: nextRoster,
    results: results.map((r) => ({
      characterId: r.characterId,
      name: r.name,
      url: r.url,
      error: r.error ?? null,
    })),
  });
}
