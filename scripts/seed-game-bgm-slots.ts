/**
 * 生成 public/game-bgm/ 模板 BGM 槽（需 ffmpeg）
 * npm run seed:game-bgm-slots
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { repoPublicPath } from "@/lib/public-path";

const SLOTS: Array<{ file: string; freq: number; dur: number }> = [
  { file: "platformer-pulse.ogg", freq: 196, dur: 12 },
  { file: "physics-organic.ogg", freq: 165, dur: 10 },
  { file: "puzzle-organic.ogg", freq: 220, dur: 14 },
  { file: "shooter-neon.ogg", freq: 247, dur: 8 },
  { file: "coaster-pulse.ogg", freq: 175, dur: 10 },
];

function hasFfmpeg(): boolean {
  try {
    execSync("ffmpeg -version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function main() {
  if (!hasFfmpeg()) {
    console.warn("[skip] ffmpeg not found — install ffmpeg to generate game-bgm slots");
    process.exit(0);
  }

  const dir = repoPublicPath("game-bgm");
  fs.mkdirSync(dir, { recursive: true });

  for (const slot of SLOTS) {
    const out = path.join(dir, slot.file);
    if (fs.existsSync(out)) {
      console.log(`[skip] ${slot.file} exists`);
      continue;
    }
    const cmd = [
      "ffmpeg -y",
      `-f lavfi -i "sine=frequency=${slot.freq}:duration=${slot.dur}"`,
      "-c:a libvorbis -q:a 4",
      `"${out}"`,
    ].join(" ");
    execSync(cmd, { stdio: "pipe", shell: true });
    console.log(`[OK] ${slot.file}`);
  }

  console.log("[OK] seed:game-bgm-slots");
}

main();
