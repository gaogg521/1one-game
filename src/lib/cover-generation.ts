import { persistComicCoverPath, persistNovelCoverPath } from "./cover-path-db";
import { generateImage } from "./image-generation";
import { persistNovelCoverFile, persistNovelCoverBuffer } from "./novel-cover-persist";
import {
  inferStoryGenre,
  resolveNovelCoverGenre,
  COVER_GENRE_STYLES,
  type CoverGenre,
} from "./cover-genre";
import { normalizeNovelTitle } from "./novel-display";
import { compositeNovelCover } from "./cover-composite";
import fs from "node:fs/promises";
import path from "node:path";

export type { CoverGenre };
export { inferCoverGenre };

export interface CoverGenOptions {
  title: string;
  summary?: string;
  storyHint?: string;
  genre?: CoverGenre;
  type: "novel" | "comic" | "game";
  /** 游戏 key art：由 Creative Brief 生成的英文 prompt（优先于 storyHint） */
  gameKeyArtPrompt?: string;
}

async function readImageBuffer(imageUrl: string): Promise<Buffer | null> {
  try {
    if (imageUrl.startsWith("/")) {
      const abs = path.join(process.cwd(), "public", imageUrl.replace(/^\//, ""));
      return await fs.readFile(abs);
    }
    if (/^https?:\/\//i.test(imageUrl)) {
      const res = await fetch(imageUrl, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    }
    return null;
  } catch {
    return null;
  }
}

export function buildCoverPrompt(opts: CoverGenOptions): string {
  const { title, summary = "", storyHint = "", genre = "general", type } = opts;
  const genreStyle = COVER_GENRE_STYLES[genre] ?? COVER_GENRE_STYLES.general;

  const typeHint =
    type === "comic"
      ? "manga/comic cover style, dynamic composition, bold lines"
      : type === "game"
        ? "mobile game key art, hero readable at small size, cinematic game marketing illustration"
        : "Chinese web novel cover illustration, vertical 3:4 portrait, editorial book cover";

  if (type === "game" && opts.gameKeyArtPrompt?.trim()) {
    return [
      opts.gameKeyArtPrompt.trim(),
      "Lower third slightly darker for title overlay. No text, no logos, no watermarks.",
    ].join(" ");
  }

  const hint = storyHint.trim().slice(0, 500);
  const sum = summary.trim().slice(0, 320);

  const urbanExtra =
    genre === "urban"
      ? "Setting is present-day China only: office towers, banquet hall, business suit, city night. Forbidden: fantasy, ancient China, magic effects, ruined world."
      : "";

  const transmigrationExtra =
    genre === "transmigration" ? buildTransmigrationCoverSceneHint(title, sum, hint) : "";

  return [
    `Illustration background for Chinese novel "${title}".`,
    sum ? `Plot: ${sum}.` : "",
    hint ? `Story elements: ${hint}.` : "",
    genreStyle.backgroundPrompt,
    urbanExtra,
    transmigrationExtra,
    typeHint,
    "Lower third slightly darker for title overlay area. Absolutely no text, no letters, no watermarks, no logos.",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildTransmigrationCoverSceneHint(title: string, summary: string, hint: string): string {
  const t = `${title} ${summary} ${hint}`;
  const parts = [
    "Required: modern protagonist (contemporary clothing) visibly in the same illustration as the historical/other-world setting; dual-era contrast, not a pure modern lifestyle photo.",
  ];
  if (/雍正|四爷|康熙|乾隆|清朝|清代|紫禁|皇子|阿哥|九子夺嫡/.test(t)) {
    parts.push(
      "Historical side: Qing dynasty Yongzheng era imperial court, prince in court robe silhouette, vermilion palace walls, East Asian cinematic lighting, political intrigue atmosphere.",
    );
  } else if (/大明|锦衣卫|明朝|唐宋|秦汉|三国|古代|宫廷|王朝/.test(t)) {
    parts.push("Historical side: Chinese imperial period drama setting matching the title era.");
  } else if (/仙侠|修仙|异界|玄幻/.test(t)) {
    parts.push("Other-world side: xianxia or fantasy cultivation world with spiritual atmosphere.");
  }
  return parts.join(" ");
}

function resolveCoverGenre(opts: CoverGenOptions): CoverGenre {
  if (opts.genre) return opts.genre;
  return resolveNovelCoverGenre({
    title: opts.title,
    summary: opts.summary,
    prompt: opts.storyHint,
    contentSnippet: opts.storyHint,
  });
}

/**
 * 生成封面：文生图背景 + 服务端叠加书名（网文平台风格）
 */
export async function generateCover(opts: CoverGenOptions): Promise<string | null> {
  try {
    const genre = resolveCoverGenre(opts);
    const prompt = buildCoverPrompt({ ...opts, genre });
    const result = await generateImage(prompt, {
      size: "1024x1536",
      quality: "standard",
      coverGenre: genre,
    });
    if (!result?.url) return null;

    const bgBuf = await readImageBuffer(result.url);
    if (!bgBuf) return result.url;

    const displayTitle = normalizeNovelTitle(opts.title, opts.storyHint);
    const composed = await compositeNovelCover(bgBuf, { title: displayTitle, genre });
    const tmpName = `composed-${Date.now()}.jpg`;
    const tmpRel = `/covers/${tmpName}`;
    const tmpAbs = path.join(process.cwd(), "public", "covers", tmpName);
    await fs.mkdir(path.dirname(tmpAbs), { recursive: true });
    await fs.writeFile(tmpAbs, composed);
    return tmpRel;
  } catch {
    return null;
  }
}

/**
 * 为 Novel 生成封面：文生图 → 叠标题 → 落盘 public/covers → 更新 coverPath
 */
export async function generateNovelCover(
  novelId: string,
  title: string,
  summary?: string,
  storyHint?: string,
  genre?: CoverGenre,
): Promise<string | null> {
  const g =
    genre ??
    resolveNovelCoverGenre({
      title,
      summary,
      prompt: storyHint,
      contentSnippet: storyHint,
    });
  const prompt = buildCoverPrompt({
    title,
    summary: summary ?? "",
    storyHint,
    genre: g,
    type: "novel",
  });

  try {
    const result = await generateImage(prompt, {
      size: "1024x1536",
      quality: "standard",
      coverGenre: g,
    });
    if (!result?.url) return null;

    const displayTitle = normalizeNovelTitle(title, storyHint);
    const bgBuf = await readImageBuffer(result.url);
    if (!bgBuf) return null;

    const composed = await compositeNovelCover(bgBuf, { title: displayTitle, genre: g });
    const coverPath = await persistNovelCoverBuffer(novelId, composed);
    if (!coverPath) return null;

    await persistNovelCoverPath(novelId, coverPath);

    return coverPath;
  } catch {
    return null;
  }
}

/** 正文入库后生成封面（带超时，避免 SSE 永久挂起） */
export async function ensureNovelCoverAfterCreate(
  novelId: string,
  title: string,
  summary: string,
  storyHint: string,
  timeoutMs = 600_000,
  genre?: CoverGenre,
): Promise<string | null> {
  const task = generateNovelCover(novelId, title, summary, storyHint, genre);
  const timeout = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), timeoutMs);
  });
  return Promise.race([task, timeout]);
}

/**
 * 用已有配图作底图，叠加书名后写入 public/covers/{novelId}.jpg 并更新 coverPath。
 * 用于漫画首格兜底封面等场景。
 */
export async function composeAndPersistNovelCoverFromBackground(
  novelId: string,
  title: string,
  backgroundUrl: string,
  summary?: string,
  storyHint?: string,
): Promise<string | null> {
  const displayTitle = normalizeNovelTitle(title, storyHint);
  const genre = inferStoryGenre({
    title: displayTitle,
    summary,
    prompt: storyHint,
  });
  /** 都市小说禁止用漫画分镜图覆盖已生成的小说封面 */
  if (genre === "urban") return null;
  const bgBuf = await readImageBuffer(backgroundUrl);
  if (!bgBuf) return null;

  try {
    const composed = await compositeNovelCover(bgBuf, { title: displayTitle, genre });
    const coverPath = await persistNovelCoverBuffer(novelId, composed);
    if (!coverPath) return null;

    await persistNovelCoverPath(novelId, coverPath);
    return coverPath;
  } catch (e) {
    if (process.env.GENERATE_STRUCTURED_LOG === "1") {
      console.warn("[cover] compose from background failed", novelId, e);
    }
    return null;
  }
}

export async function generateComicCover(
  comicId: string,
  title: string,
  summary?: string,
  storyHint?: string,
  genre?: CoverGenre,
): Promise<string | null> {
  const g = genre ?? inferCoverGenre(title, summary ?? "", storyHint ?? "");
  const coverUrl = await generateCover({
    title,
    summary: summary ?? "",
    storyHint,
    type: "comic",
    genre: g,
  });
  if (!coverUrl) return null;

  await persistComicCoverPath(comicId, coverUrl);

  return coverUrl;
}
