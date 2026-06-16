import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "src");
const OFFENDERS: string[] = [];

function walk(dir: string): void {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(p);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(ent.name)) continue;
    if (p.endsWith(path.join("src", "lib", "public-path.ts"))) continue;
    const s = fs.readFileSync(p, "utf8");
    if (/path\.join\((process\.cwd\(\)|repoRoot\(\)),\s*"public"/.test(s)) {
      OFFENDERS.push(path.relative(process.cwd(), p).replace(/\\/g, "/"));
    }
  }
}

walk(ROOT);

if (OFFENDERS.length) {
  console.error(`Direct public path joins found:\n${OFFENDERS.map((p) => `- ${p}`).join("\n")}`);
  process.exit(1);
}

console.log("[OK] qa-public-path-contracts");
