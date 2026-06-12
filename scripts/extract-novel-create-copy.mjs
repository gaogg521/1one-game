/** Extract NOVEL_CREATE_COPY from novel/create/page.tsx → i18n-novel-create-page.mjs */
import fs from "node:fs";
import path from "node:path";

const pagePath = path.join(import.meta.dirname, "../src/app/novel/create/page.tsx");
const page = fs.readFileSync(pagePath, "utf8");
const start = page.indexOf("const NOVEL_CREATE_COPY");
const end = page.indexOf("\nconst STEP_KEYS", start);
if (start < 0 || end < 0) throw new Error("NOVEL_CREATE_COPY block not found");

const block = page.slice(start, end);
const assignIdx = block.indexOf("> = {");
if (assignIdx < 0) throw new Error("assignment not found");
const objText = block.slice(assignIdx + "> = ".length).trim().replace(/;\s*$/, "");
const novelCreatePageByLocale = Function(`"use strict"; return (${objText});`)();

const outPath = path.join(import.meta.dirname, "i18n-novel-create-page.mjs");
const out = `/** Auto-extracted — run: node scripts/extract-novel-create-copy.mjs */\nexport const novelCreatePageByLocale = ${JSON.stringify(novelCreatePageByLocale, null, 2)};\n`;
fs.writeFileSync(outPath, out, "utf8");
console.log("wrote", outPath, "locales:", Object.keys(novelCreatePageByLocale).join(", "));
