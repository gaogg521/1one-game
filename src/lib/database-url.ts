/** Prisma SQLite URL 规范化（相对 schema 目录 prisma/） */

export const DEV_DATABASE_URL = "file:./dev.db";
export const CI_DATABASE_URL = "file:./prisma/ci.sqlite";

/** 常见误配：从仓库根写 file:./prisma/dev.db → 实际落到 prisma/prisma/dev.db */
const MISLEADING_DEV_PATTERNS = [/prisma\/dev\.db/i, /prisma\/prisma\//i];

export function normalizeSqliteDatabaseUrl(raw: string | undefined | null): string {
  const trimmed = raw?.trim();
  if (!trimmed) return DEV_DATABASE_URL;
  for (const re of MISLEADING_DEV_PATTERNS) {
    if (re.test(trimmed)) {
      console.warn(
        `[database-url] DATABASE_URL="${trimmed}" 可能指向错误路径，已规范为 ${DEV_DATABASE_URL}`,
      );
      return DEV_DATABASE_URL;
    }
  }
  return trimmed;
}

/** 文学实机 / dev 对齐：默认 dev.db */
export function resolveLiteraryQaDatabaseUrl(): string {
  if (process.env.QA_USE_DEV_DB === "1") {
    return normalizeSqliteDatabaseUrl(process.env.DATABASE_URL ?? DEV_DATABASE_URL);
  }
  const fromEnv = process.env.DATABASE_URL?.trim();
  if (fromEnv) return normalizeSqliteDatabaseUrl(fromEnv);
  return DEV_DATABASE_URL;
}

/** QA 离线门禁默认 ci.sqlite；QA_USE_DEV_DB=1 时用 dev.db */
export function resolveQaOfflineDatabaseUrl(): string {
  if (process.env.QA_USE_DEV_DB === "1") {
    return normalizeSqliteDatabaseUrl(process.env.DATABASE_URL ?? DEV_DATABASE_URL);
  }
  return process.env.DATABASE_URL?.trim() || CI_DATABASE_URL;
}

/** 本地 dev 进程：禁止 shell 残留 ci.sqlite 污染（除非显式允许） */
export function resolveDevServerDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL?.trim();
  if (raw && /ci\.sqlite/i.test(raw) && process.env.DEV_ALLOW_CI_DB !== "1") {
    console.warn(
      `[dev] DATABASE_URL 指向 ci.sqlite，已改为 ${DEV_DATABASE_URL}（E2E 请单独起进程；或 DEV_ALLOW_CI_DB=1）`,
    );
    return DEV_DATABASE_URL;
  }
  if (!raw) return DEV_DATABASE_URL;
  return normalizeSqliteDatabaseUrl(raw);
}

/** 写入 process.env（QA 脚本入口调用） */
export function applyLiteraryQaDatabaseUrl(): string {
  const url = resolveLiteraryQaDatabaseUrl();
  process.env.DATABASE_URL = url;
  return url;
}

export function applyQaOfflineDatabaseUrl(): string {
  const url = resolveQaOfflineDatabaseUrl();
  process.env.DATABASE_URL = url;
  return url;
}

/** 文学实机 wrapper：清除 shell 残留，避免误走 resume / skip 路径 */
export function clearLeakedLiteraryQaEnv(mode: "novels" | "storyboard" | "comic-full" | "panels-resume"): void {
  if (mode !== "panels-resume") delete process.env.QA_COMIC_RESUME_ID;
  if (mode === "novels") {
    delete process.env.QA_COMIC_NOVEL_ID;
    delete process.env.SKIP_COMIC_PANELS;
  }
  if (mode === "storyboard" || mode === "comic-full") {
    delete process.env.QA_SKIP_COMIC;
    delete process.env.QA_COMIC_PAGES;
    process.env.QA_COMIC_PAGES = "8";
    if (!process.env.QA_NOVEL_TIERS?.trim()) process.env.QA_NOVEL_TIERS = "medium";
  }
  if (mode === "comic-full" || mode === "panels-resume") {
    delete process.env.SKIP_COMIC_PANELS;
  }
  if (mode === "panels-resume") {
    delete process.env.QA_COMIC_NOVEL_ID;
    delete process.env.QA_SKIP_COMIC;
    delete process.env.QA_COMIC_RESUME_ID;
  }
}

/** 文学实机：lib 配图 + ci.sqlite 时提示数据不对齐 */
export function warnLiteraryQaEnv(opts?: { panelRenderMode?: string; skipComic?: boolean }): void {
  const url = process.env.DATABASE_URL ?? "";
  const mode = opts?.panelRenderMode ?? process.env.QA_PANEL_RENDER_MODE ?? "lib";
  if (/ci\.sqlite/i.test(url) && mode === "lib" && !opts?.skipComic) {
    console.warn(
      "[literary-qa] DATABASE_URL=ci.sqlite 且 panelRenderMode=lib — 实机作品在 dev.db，请设 DATABASE_URL=file:./dev.db",
    );
  }
  if (process.env.SKIP_COMIC_PANELS === "1" && process.env.QA_COMIC_RESUME_ID?.trim()) {
    console.warn("[literary-qa] QA_COMIC_RESUME_ID 与 SKIP_COMIC_PANELS=1 冲突，将仍尝试配图");
  }
}
