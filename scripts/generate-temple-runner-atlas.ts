/**
 * 生成神庙跑者外部 sprite sheet → public/game-sprites/sample-temple-relic-runner/temple-runner-v7.png
 * npm run generate:temple-runner-atlas
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const FW = 76;
const FH = 96;
const FRAMES = 12;
const OUT_DIR = path.join(process.cwd(), "public/game-sprites/sample-temple-relic-runner");
const OUT_PNG = path.join(OUT_DIR, "temple-runner-v7.png");
const OUT_JSON = path.join(OUT_DIR, "temple-runner-v7.json");

function runnerSvg(frame: number): string {
  const phase = (frame / FRAMES) * Math.PI * 2;
  const legL = Math.sin(phase) * 10;
  const legR = Math.sin(phase + Math.PI) * 10;
  const arm = Math.sin(phase) * 6;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${FW}" height="${FH}" viewBox="0 0 ${FW} ${FH}">
  <ellipse cx="38" cy="88" rx="14" ry="5" fill="rgba(0,0,0,0.28)"/>
  <rect x="${20 + legL * 0.3}" y="66" width="11" height="20" rx="4" fill="#92400e"/>
  <rect x="${44 + legR * 0.3}" y="66" width="11" height="20" rx="4" fill="#92400e"/>
  <rect x="22" y="48" width="22" height="22" rx="6" fill="#14532d"/>
  <rect x="${18 - arm}" y="40" width="8" height="18" rx="3" fill="#166534"/>
  <rect x="${48 + arm}" y="40" width="8" height="18" rx="3" fill="#166534"/>
  <circle cx="38" cy="30" r="11" fill="#fde68a"/>
  <path d="M28 24 L48 24 L46 18 L30 18 Z" fill="#78350f"/>
  <rect x="50" y="36" width="6" height="14" rx="2" fill="#f59e0b"/>
  <circle cx="53" cy="34" r="5" fill="#fbbf24"/>
</svg>`;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const frameBuffers: Buffer[] = [];
  for (let f = 0; f < FRAMES; f += 1) {
    const png = await sharp(Buffer.from(runnerSvg(f))).png().toBuffer();
    frameBuffers.push(png);
  }

  const composites = frameBuffers.map((input, i) => ({
    input,
    left: i * FW,
    top: 0,
  }));

  await sharp({
    create: {
      width: FW * FRAMES,
      height: FH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toFile(OUT_PNG);

  const frames: Record<string, { frame: { x: number; y: number; w: number; h: number }; sourceSize: { w: number; h: number } }> =
    {};
  for (let f = 0; f < FRAMES; f += 1) {
    frames[`f${f}`] = {
      frame: { x: f * FW, y: 0, w: FW, h: FH },
      sourceSize: { w: FW, h: FH },
    };
  }
  fs.writeFileSync(
    OUT_JSON,
    `${JSON.stringify(
      {
        version: "v7",
        frameWidth: FW,
        frameHeight: FH,
        frameCount: FRAMES,
        texture: "/game-sprites/sample-temple-relic-runner/temple-runner-v7.png",
        frames,
      },
      null,
      2,
    )}\n`,
  );

  console.log(`[OK] temple-runner-v7.png (${FW * FRAMES}x${FH}) + json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
