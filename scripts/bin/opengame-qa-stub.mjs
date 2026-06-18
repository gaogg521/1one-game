#!/usr/bin/env node
/**
 * OpenGame CLI QA stub — 无本机 opengame 时供 `qa:opengame-cli-live` 走实机管线。
 * 用法：node scripts/bin/opengame-qa-stub.mjs -p "prompt" --yolo
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log("OpenGame QA stub — opengame -p <prompt> [--yolo] [--output-format json]");
  process.exit(0);
}

const pIdx = args.indexOf("-p");
const prompt = pIdx >= 0 ? args[pIdx + 1] : "qa-stub";
const fixtureDir = path.join(__dirname, "..", "fixtures", "opengame-cli-bridge", "native-create-game");
const src = path.join(fixtureDir, "game.js");
const dest = path.join(process.cwd(), "game.js");

if (!fs.existsSync(src)) {
  console.error("[opengame-qa-stub] missing fixture game.js");
  process.exit(1);
}

fs.mkdirSync(process.cwd(), { recursive: true });
fs.copyFileSync(src, dest);
console.log(JSON.stringify({ ok: true, stub: true, prompt: String(prompt).slice(0, 120) }));
process.exit(0);
