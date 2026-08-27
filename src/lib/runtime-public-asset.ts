import fs from "node:fs/promises";
import path from "node:path";
import { repoPublicPath } from "@/lib/public-path";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const SPRITE_FALLBACKS: Record<string, { color: string; glyph: string }> = {
  player: { color: "#fde68a", glyph: "★" },
  hazard: { color: "#fb7185", glyph: "!" },
  gem: { color: "#67e8f9", glyph: "◆" },
  power: { color: "#a7f3d0", glyph: "+" },
  boss: { color: "#c4b5fd", glyph: "✦" },
};

function fallbackSvg(input: { directory: "game-sprites" | "game-bg"; parts: string[] }): string | null {
  if (input.directory === "game-bg" && input.parts.length === 1) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#0f172a"/><stop offset="1" stop-color="#164e63"/></linearGradient><radialGradient id="v"><stop stop-color="#ffffff" stop-opacity=".12"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs><rect width="1280" height="720" fill="url(#g)"/><circle cx="320" cy="220" r="280" fill="url(#v)"/><circle cx="1040" cy="520" r="360" fill="url(#v)"/></svg>`;
  }
  if (input.directory !== "game-sprites" || input.parts.length !== 2) return null;
  const role = path.basename(input.parts[1], path.extname(input.parts[1]));
  const fallback = SPRITE_FALLBACKS[role];
  if (!fallback) return null;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><defs><filter id="s"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity=".3"/></filter></defs><circle cx="48" cy="48" r="34" fill="${fallback.color}" stroke="#fff" stroke-width="4" filter="url(#s)"/><text x="48" y="61" text-anchor="middle" font-family="system-ui,sans-serif" font-size="38" font-weight="800" fill="#172033">${fallback.glyph}</text></svg>`;
}

export async function runtimePublicAssetResponse(input: {
  directory: "game-sprites" | "game-bg";
  parts: string[];
  rootDir?: string;
}): Promise<Response> {
  if (
    input.parts.length < 1 ||
    input.parts.some((part) => !/^[A-Za-z0-9_-]+(?:\.(?:png|svg|webp|gif))?$/.test(part))
  ) {
    return new Response("Not found", { status: 404 });
  }
  const root = path.resolve(input.rootDir ?? repoPublicPath(), input.directory);
  const target = path.resolve(root, ...input.parts);
  if (!target.startsWith(`${root}${path.sep}`)) return new Response("Not found", { status: 404 });
  const extension = path.extname(target).toLowerCase();
  const contentType = MIME[extension];
  if (!contentType) return new Response("Not found", { status: 404 });
  try {
    const bytes = await fs.readFile(target);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    const fallback = fallbackSvg(input);
    if (!fallback) return new Response("Not found", { status: 404 });
    return new Response(fallback, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Operone-Asset-Fallback": "1",
      },
    });
  }
}
