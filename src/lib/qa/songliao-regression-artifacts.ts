/**
 * 从既有回归产物解析默认中篇 novelId / 漫画 comicId
 */
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "qa-output", "songliao-regression");

const COMIC_SUMMARY_FILES = [
  "storyboard-summary.json",
  "summary.json",
  "panels-resume-summary.json",
  "full-medium-summary.json",
] as const;

type ComicRef = {
  comicId: string;
  withImage: number;
  panels: number;
  at: string;
  source: string;
};

function readJson(file: string): Record<string, unknown> | null {
  const p = path.join(OUT, file);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function comicFromPayload(
  payload: Record<string, unknown>,
  source: string,
): ComicRef | null {
  const at = typeof payload.at === "string" ? payload.at : "";
  const topId = payload.comicId;
  const comic = payload.comic;
  if (typeof topId === "string") {
    const nested =
      typeof comic === "object" && comic !== null
        ? (comic as { withImage?: number; panels?: number })
        : {};
    return {
      comicId: topId,
      withImage: typeof nested.withImage === "number" ? nested.withImage : 0,
      panels: typeof nested.panels === "number" ? nested.panels : 0,
      at,
      source,
    };
  }
  if (typeof comic === "object" && comic !== null) {
    const c = comic as { comicId?: string; withImage?: number; panels?: number };
    if (typeof c.comicId === "string") {
      return {
        comicId: c.comicId,
        withImage: typeof c.withImage === "number" ? c.withImage : 0,
        panels: typeof c.panels === "number" ? c.panels : 0,
        at,
        source,
      };
    }
  }
  return null;
}

/** 按时间倒序列出产物中的漫画引用 */
export function listCachedComicRefs(): ComicRef[] {
  const refs: ComicRef[] = [];
  for (const file of COMIC_SUMMARY_FILES) {
    const j = readJson(file);
    if (!j) continue;
    const ref = comicFromPayload(j, file);
    if (ref) refs.push(ref);
  }
  return refs.sort((a, b) => b.at.localeCompare(a.at));
}

export function resolveCachedMediumNovelId(): string | undefined {
  const fromEnv = process.env.QA_COMIC_NOVEL_ID?.trim();
  if (fromEnv) return fromEnv;

  for (const file of ["storyboard-summary.json", "summary.json", "full-medium-summary.json", "novels-4tier-summary.json"]) {
    const j = readJson(file);
    if (!j) continue;
    if (typeof j.mediumNovelId === "string") return j.mediumNovelId;
    const novels = j.novels;
    if (Array.isArray(novels)) {
      const medium = novels.find(
        (n): n is { tier: string; novelId?: string } =>
          typeof n === "object" && n !== null && (n as { tier?: string }).tier === "medium",
      );
      if (medium?.novelId) return medium.novelId;
    }
  }
  return undefined;
}

/** 优先返回缺配图的最新漫画；均已满格则返回最新 comicId */
export function resolveCachedComicId(opts?: { ignoreEnv?: boolean }): string | undefined {
  if (!opts?.ignoreEnv) {
    const fromEnv = process.env.QA_COMIC_RESUME_ID?.trim();
    if (fromEnv) return fromEnv;
  }

  const refs = listCachedComicRefs();
  if (refs.length === 0) return undefined;

  const incomplete = refs.find((r) => r.panels > 0 && r.withImage < r.panels);
  if (incomplete) return incomplete.comicId;

  return refs[0]?.comicId;
}

export type SongliaoSummaryAlias =
  | "novels-4tier-summary.json"
  | "storyboard-summary.json"
  | "full-medium-summary.json"
  | "panels-resume-summary.json";

export function resolveSongliaoSummaryAlias(opts: {
  comicResumeId?: string;
  skipComic: boolean;
  skipPanels: boolean;
  tiers: string[];
  comicPages: number;
}): SongliaoSummaryAlias | null {
  if (opts.comicResumeId) return "panels-resume-summary.json";
  if (opts.skipComic && opts.tiers.length >= 4) return "novels-4tier-summary.json";
  if (!opts.skipComic && opts.skipPanels) return "storyboard-summary.json";
  if (!opts.skipComic && !opts.skipPanels && opts.tiers.length === 1 && opts.tiers[0] === "medium") {
    return "full-medium-summary.json";
  }
  return null;
}

export function buildFullMediumSummary(summary: Record<string, unknown>): Record<string, unknown> {
  const novels = summary.novels as Array<{ tier?: string; novelId?: string }> | undefined;
  const comic = summary.comic as Record<string, unknown> | undefined;
  const medium = novels?.find((n) => n.tier === "medium");
  const panelStreamMs = (comic?.panelStreamMs as number) ?? 0;
  const totalMs = (comic?.ms as number) ?? 0;
  return {
    at: summary.at,
    title: summary.title,
    pass: summary.pass,
    novels4tier: "qa-output/songliao-regression/novels-4tier-summary.json",
    mediumNovelId: medium?.novelId ?? null,
    comicId: comic?.comicId ?? null,
    comic: comic
      ? {
          pages: comic.pages,
          panels: comic.panels,
          withImage: comic.withImage,
          pipeline: comic.pipeline,
          storyboardMs: Math.max(0, totalMs - panelStreamMs),
          panelRenderMode: summary.panelRenderMode,
          panelRenderMs: panelStreamMs,
        }
      : null,
    urls: summary.urls,
  };
}

/** panels-resume 完成后，若满格则同步 full-medium-summary */
export function mergeStoryboardTiming(summary: Record<string, unknown>): Record<string, unknown> {
  const comic = summary.comic as { comicId?: string; ms?: number; panelStreamMs?: number; pipeline?: string } | undefined;
  if (!comic?.comicId) return summary;

  let merged = { ...summary };
  for (const file of ["storyboard-summary.json", "summary.json"]) {
    const j = readJson(file);
    const sb = j?.comic as { comicId?: string; ms?: number; pipeline?: string } | undefined;
    if (sb?.comicId !== comic.comicId || typeof sb.ms !== "number") continue;
    const panelMs = comic.panelStreamMs ?? comic.ms ?? 0;
    merged = {
      ...merged,
      novels:
        Array.isArray(merged.novels) && merged.novels.length > 0 ? merged.novels : j?.novels,
      urls: merged.urls ?? j?.urls,
      comic: {
        ...comic,
        pipeline: sb.pipeline ?? comic.pipeline ?? "light",
        ms: sb.ms + panelMs,
        panelStreamMs: panelMs,
      },
    };
    break;
  }
  return merged;
}

export function syncFullMediumSummaryIfComplete(summary: Record<string, unknown>): boolean {
  const comic = summary.comic as { withImage?: number; panels?: number } | undefined;
  if (!comic || typeof comic.panels !== "number" || comic.panels < 1) return false;
  if ((comic.withImage ?? 0) < comic.panels) return false;
  const merged = mergeStoryboardTiming(summary);
  const built = buildFullMediumSummary(merged);
  fs.writeFileSync(path.join(OUT, "full-medium-summary.json"), JSON.stringify(built, null, 2));
  return true;
}
