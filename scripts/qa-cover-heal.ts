/**
 * 封面坏链判定、角标擦除、落盘可读
 * npm run qa:cover-heal
 */
import { isLocalCoverPath, isStoredCoverUsable, stripGeneratorCornerMarks } from "@/lib/cover-asset";
import { persistNovelCoverBuffer, deleteNovelCoverFile } from "@/lib/novel-cover-persist";
import { loadSharp } from "@/lib/sharp-loader";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
  assert(isLocalCoverPath("/covers/abc123.jpg"), "local jpg path");
  assert(!isLocalCoverPath("https://tos.example/cover.jpg"), "remote is not local");
  assert(!(await isStoredCoverUsable("/covers/does-not-exist-qa-cover-heal.jpg")), "missing local cover is unusable");
  assert(!(await isStoredCoverUsable("")), "empty unusable");

  const sharp = await loadSharp();
  const src = await sharp({
    create: { width: 200, height: 260, channels: 3, background: { r: 40, g: 80, b: 40 } },
  })
    .jpeg()
    .toBuffer();
  const stripped = await stripGeneratorCornerMarks(src);
  assert(stripped.length > 512, "strip produced jpeg");
  const meta = await sharp(stripped).metadata();
  assert(meta.format === "jpeg", `expected jpeg got ${meta.format}`);

  const id = "qa-cover-heal-tmp";
  const path = await persistNovelCoverBuffer(id, stripped);
  assert(Boolean(path && path.includes(id)), `persist path ${path}`);
  assert(await isStoredCoverUsable(path), "persisted cover is usable");
  await deleteNovelCoverFile(id);

  console.log("qa-cover-heal: ok");
}

main().catch((error) => {
  console.error("qa-cover-heal: fail", error);
  process.exitCode = 1;
});
