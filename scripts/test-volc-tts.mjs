import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {
    /* no .env */
  }
}

loadEnv();

const { synthesizeVolcTts, getVolcTtsConfig } = await import("../src/lib/volc-tts.ts");

const cfg = getVolcTtsConfig();
console.log("config", cfg ? { appId: cfg.appId, voice: cfg.voiceType } : null);

const buf = await synthesizeVolcTts("你好，这是豆包语音合成测试。");
console.log("ok bytes", buf.length);
