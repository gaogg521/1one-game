/**
 * 开心消消乐动物宝石 sprite sheet → public/game-sprites/sample-color-bloom/anipop-gems-v1.png
 * npm run generate:anipop-gem-atlas
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SIZE = 64;
const KINDS = ["frog", "hippo", "fox", "owl", "chick"] as const;
const OUT_DIR = path.join(process.cwd(), "public/game-sprites/sample-color-bloom");
const OUT_PNG = path.join(OUT_DIR, "anipop-gems-v1.png");
const OUT_JSON = path.join(OUT_DIR, "anipop-gems-v1.json");

const PALETTE: Record<(typeof KINDS)[number], { body: string; dark: string; accent: string }> = {
  frog: { body: "#4ade80", dark: "#16a34a", accent: "#86efac" },
  hippo: { body: "#38bdf8", dark: "#0284c7", accent: "#7dd3fc" },
  fox: { body: "#f87171", dark: "#dc2626", accent: "#fca5a5" },
  owl: { body: "#a78bfa", dark: "#7c3aed", accent: "#c4b5fd" },
  chick: { body: "#facc15", dark: "#ca8a04", accent: "#fde047" },
};

function gemSvg(kind: (typeof KINDS)[number]): string {
  const p = PALETTE[kind];
  const ear =
    kind === "frog"
      ? `<circle cx="18" cy="14" r="9" fill="${p.dark}"/><circle cx="46" cy="14" r="9" fill="${p.dark}"/>`
      : kind === "fox"
        ? `<polygon points="14,22 22,4 28,22" fill="${p.dark}"/><polygon points="36,22 44,4 50,22" fill="${p.dark}"/>`
        : kind === "chick"
          ? `<polygon points="28,12 32,0 36,12" fill="${p.dark}"/>`
          : "";
  const muzzle =
    kind === "hippo"
      ? `<rect x="22" y="36" width="20" height="8" rx="3" fill="#f8fafc"/>`
      : kind === "owl"
        ? `<ellipse cx="32" cy="36" rx="10" ry="7" fill="#fef3c7"/>`
        : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 64 64">
  <ellipse cx="32" cy="54" rx="22" ry="7" fill="rgba(0,0,0,0.2)"/>
  <circle cx="32" cy="34" r="24" fill="${p.dark}"/>
  <circle cx="32" cy="30" r="22" fill="${p.body}"/>
  ${ear}
  <circle cx="24" cy="28" r="7" fill="#fff"/>
  <circle cx="40" cy="28" r="7" fill="#fff"/>
  <circle cx="25" cy="29" r="3.5" fill="#1e293b"/>
  <circle cx="41" cy="29" r="3.5" fill="#1e293b"/>
  <circle cx="23" cy="26" r="1.5" fill="#fff"/>
  <circle cx="39" cy="26" r="1.5" fill="#fff"/>
  <circle cx="16" cy="34" r="5" fill="${p.accent}" opacity="0.75"/>
  <circle cx="48" cy="34" r="5" fill="${p.accent}" opacity="0.75"/>
  ${muzzle}
  <circle cx="32" cy="30" r="22" fill="none" stroke="${p.dark}" stroke-width="2" opacity="0.45"/>
</svg>`;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const composites: { input: Buffer; left: number; top: number }[] = [];
  for (let i = 0; i < KINDS.length; i += 1) {
    const kind = KINDS[i]!;
    const png = await sharp(Buffer.from(gemSvg(kind))).png().toBuffer();
    composites.push({ input: png, left: i * SIZE, top: 0 });
  }

  await sharp({
    create: {
      width: SIZE * KINDS.length,
      height: SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toFile(OUT_PNG);

  const frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }> = {};
  for (let i = 0; i < KINDS.length; i += 1) {
    const kind = KINDS[i]!;
    frames[kind] = { frame: { x: i * SIZE, y: 0, w: SIZE, h: SIZE } };
  }

  fs.writeFileSync(
    OUT_JSON,
    `${JSON.stringify(
      {
        version: "v1",
        frameWidth: SIZE,
        frameHeight: SIZE,
        texture: "/game-sprites/sample-color-bloom/anipop-gems-v1.png",
        frames,
      },
      null,
      2,
    )}\n`,
  );

  console.log(`anipop-gem-atlas: ok → ${OUT_PNG}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
