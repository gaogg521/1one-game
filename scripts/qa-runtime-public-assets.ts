import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runtimePublicAssetResponse } from "@/lib/runtime-public-asset";

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "operone-runtime-assets-"));
  try {
    await fs.mkdir(path.join(root, "game-sprites", "project-1"), { recursive: true });
    await fs.mkdir(path.join(root, "game-bg"), { recursive: true });
    await fs.writeFile(path.join(root, "game-sprites", "project-1", "player.png"), Buffer.from([137, 80, 78, 71]));
    await fs.writeFile(path.join(root, "game-bg", "project-1.png"), Buffer.from([137, 80, 78, 71]));

    const sprite = await runtimePublicAssetResponse({ directory: "game-sprites", parts: ["project-1", "player.png"], rootDir: root });
    assert.equal(sprite.status, 200);
    assert.equal(sprite.headers.get("content-type"), "image/png");
    const background = await runtimePublicAssetResponse({ directory: "game-bg", parts: ["project-1.png"], rootDir: root });
    assert.equal(background.status, 200);
    const traversal = await runtimePublicAssetResponse({ directory: "game-bg", parts: ["..", "secret.png"], rootDir: root });
    assert.equal(traversal.status, 404, "runtime asset routes must reject path traversal");
    const missing = await runtimePublicAssetResponse({ directory: "game-sprites", parts: ["project-1", "missing.png"], rootDir: root });
    assert.equal(missing.status, 404);
    console.log("[OK] qa-runtime-public-assets: post-build generated game files are served safely at runtime");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

void main().catch((error) => { console.error(error); process.exit(1); });
