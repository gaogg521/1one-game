import fs from "node:fs/promises";
import { deleteGameAssetFiles } from "../src/lib/game-assets-gc";
import { repoPublicPath } from "../src/lib/public-path";
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
async function exists(path: string) { return fs.access(path).then(() => true).catch(() => false); }
async function main() {
  const id = `qa_gc_${Date.now()}`, other = `qa_gc_other_${Date.now()}`;
  const sprite = repoPublicPath("game-sprites", id, "player.png"), bg = repoPublicPath("game-bg", `${id}.png`), untouched = repoPublicPath("game-sprites", other, "player.png");
  try {
    await fs.mkdir(repoPublicPath("game-sprites", id), { recursive: true }); await fs.mkdir(repoPublicPath("game-sprites", other), { recursive: true }); await fs.mkdir(repoPublicPath("game-bg"), { recursive: true });
    await Promise.all([fs.writeFile(sprite, "owned"), fs.writeFile(bg, "owned"), fs.writeFile(untouched, "other")]);
    await deleteGameAssetFiles(id);
    assert(!(await exists(sprite)) && !(await exists(bg)), "owned game assets must be removed"); assert(await exists(untouched), "another project assets must remain");
    await deleteGameAssetFiles("../unsafe"); assert(await exists(untouched), "unsafe id must not traverse");
    console.log("[OK] qa-game-assets-gc");
  } finally { await Promise.all([fs.rm(repoPublicPath("game-sprites", id), { recursive: true, force: true }), fs.rm(repoPublicPath("game-sprites", other), { recursive: true, force: true }), fs.rm(bg, { force: true })]); }
}
void main();
