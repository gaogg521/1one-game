/**
 * 生成 public/game-bgm/ 模板 BGM 槽（需 ffmpeg）
 * npm run seed:game-bgm-slots
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { repoPublicPath } from "@/lib/public-path";

const TEMPLATES = [
  "towerDefense",
  "coaster",
  "racing",
  "shooter",
  "sniper",
  "platformer",
  "stealth",
  "strategy",
  "farming",
  "puzzle",
  "chess",
  "customization",
  "physics",
  "survivor",
  "collector",
  "avoider",
];

const PROFILES = ["minimal", "organic", "neon", "pulse", "blocky"];

// 生成所有模板 × 音乐风格的占位符音频
const SLOTS: Array<{ file: string; freq: number; dur: number }> = TEMPLATES.flatMap((template) =>
  PROFILES.map((profile, idx) => ({
    file: `${template}-${profile}.ogg`,
    freq: 220 + idx * 11, // C4-G4 范围内简单变化
    dur: 8 + (Math.abs(Math.random() * 6) | 0), // 8-14 秒
  })),
).sort((a, b) => a.file.localeCompare(b.file));

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
