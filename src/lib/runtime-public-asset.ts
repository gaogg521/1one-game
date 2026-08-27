import fs from "node:fs/promises";
import path from "node:path";
import { repoPublicPath } from "@/lib/public-path";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

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
    return new Response("Not found", { status: 404 });
  }
}
