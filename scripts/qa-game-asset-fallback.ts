import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { completeRequiredGameAssets } from "@/lib/game-asset-fallback";
import { prepareGameSpecForPersist } from "@/lib/spec-patch";

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "operone-asset-fallback-"));
  try {
  const projectId = "qa-asset-fallback";
  const spriteDir = path.join(root, "game-sprites", projectId);
  await fs.mkdir(spriteDir, { recursive: true });
  await fs.writeFile(path.join(spriteDir, "player.png"), "image-provider-player");
  await fs.writeFile(path.join(spriteDir, "hazard.svg"), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"/>');
  const result = await completeRequiredGameAssets({
    projectId,
    rootDir: root,
    spec: prepareGameSpecForPersist(undefined, "手机单手玩的森林萤火虫收集游戏"),
    backgroundUrl: null,
    pngSprites: [
      { kind: "player", url: `/game-sprites/${projectId}/player.png` },
      { kind: "hazard", url: null, error: "image provider rejected" },
    ],
    svgSprites: [{ kind: "hazard", url: `/game-sprites/${projectId}/hazard.svg` }],
  });

  assert.equal(result.sprites.length, 5, "all runtime sprite roles must be completed");
  assert.equal(result.sprites.find((entry) => entry.kind === "player")?.url?.endsWith("player.png"), true, "successful image assets must be preserved");
  assert.equal(result.sprites.find((entry) => entry.kind === "hazard")?.url?.endsWith("hazard.svg"), true, "LLM SVG must be the first fallback");
  assert.equal(result.sprites.find((entry) => entry.kind === "gem")?.error?.includes("procedural_fallback"), true, "procedural PNG must close the final gap");
  await Promise.all([
    fs.access(path.join(root, "game-bg", `${projectId}.png`)),
    fs.access(path.join(spriteDir, "gem.png")),
    fs.access(path.join(spriteDir, "power.png")),
    fs.access(path.join(spriteDir, "boss.png")),
  ]);
  assert.equal(result.backgroundUrl, `/game-bg/${projectId}.png`, "a real local background must replace a missing image result");
  assert.equal(await fs.readFile(path.join(spriteDir, "player.png"), "utf8"), "image-provider-player", "fallback must not overwrite good art");
    console.log("[OK] qa-game-asset-fallback: image model -> LLM SVG -> procedural PNG closes every required slot");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
