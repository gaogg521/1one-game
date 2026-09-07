/**
 * The SFX resolution logic exists in two places and must not drift.
 *
 * `sdk-surface.ts` holds the copy the build audit reasons about; the runtime
 * SDK holds its own inline copy, because its body is a plain string injected
 * into the game's iframe and cannot import anything. If the two disagree the
 * audit and the running game disagree about what is playable -- and the
 * dangerous direction is the audit being MORE permissive, because then it goes
 * quiet while every "explosion" still degrades to a generic blip. That is the
 * exact failure this file was written after causing: a prefix rule added to
 * the audit and not the runtime.
 *
 * So this does not compare tables. It EXECUTES the runtime's own resolver
 * against every name the audit can resolve, plus every prefix of every cue and
 * alias, and requires identical answers.
 *
 *   npx tsx scripts/qa-forge-sfx-alias.ts
 */
import fs from "node:fs";
import path from "node:path";
import { resolveSfxName, SDK_SFX_ALIASES, SDK_SFX_NAMES } from "../src/lib/game-forge/sdk-surface";

function fail(message: string): never {
  console.error(`[FAIL] ${message}`);
  process.exit(1);
}

/** Extracts a `key: function (args) { ... }` body by counting braces. */
function extractFunctionBody(source: string, header: string): string {
  const at = source.indexOf(header);
  if (at === -1) fail(`could not find "${header}" in the runtime SDK`);
  const open = source.indexOf("{", at + header.length - 1);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  fail(`unbalanced braces while reading "${header}"`);
}

/** The cue names of the SDK's own LIB, in their real declaration order. */
function runtimeCueOrder(sdk: string): string[] {
  const body = extractFunctionBody(sdk, "var LIB = {");
  const out: string[] = [];
  // Top-level keys only: each cue's own body contains nested braces and calls.
  let depth = 0;
  for (const line of body.split("\n")) {
    const m = depth === 0 ? /^\s*([A-Za-z_][\w$]*)\s*:/.exec(line) : null;
    if (m) out.push(m[1]!);
    for (const ch of line) {
      if (ch === "{") depth += 1;
      else if (ch === "}") depth -= 1;
    }
  }
  return out;
}

/**
 * Builds a callable of the runtime's resolver over a stub cue library that
 * records which cue was played.
 *
 * The stub's key order is taken from the SDK's own LIB declaration, not from
 * SDK_SFX_NAMES: the runtime picks the first prefix match by object key order
 * while the audit walks SDK_SFX_NAMES in array order. Seeding the stub from
 * the array would have made the harness agree with itself while the real game
 * disagreed -- so the order is read from the source, and asserted against the
 * array separately.
 */
function runtimeResolver(sdk: string, cueOrder: string[]): (name: string) => string {
  const body = extractFunctionBody(sdk, "sfx: function (name) {");
  let played = "";
  const LIB: Record<string, () => void> = {};
  for (const cue of cueOrder) LIB[cue] = () => { played = cue; };
  const run = new Function("name", "LIB", body) as (name: string, lib: typeof LIB) => void;
  return (name: string) => {
    played = "";
    run(name, LIB);
    return played;
  };
}

function main() {
  const sdk = fs.readFileSync(path.join(process.cwd(), "src/lib/game-forge/runtime-sdk.ts"), "utf8");
  const cueOrder = runtimeCueOrder(sdk);
  const declared = SDK_SFX_NAMES as readonly string[];

  // Same cues, same order. Prefix resolution takes the first match, so a
  // reordering that looks harmless silently changes which cue an ambiguous
  // prefix plays -- in the runtime only, where nothing would notice.
  if (cueOrder.join(",") !== declared.join(",")) {
    fail(`the SDK's cue library and SDK_SFX_NAMES disagree.
  runtime: ${cueOrder.join(", ")}
  surface: ${declared.join(", ")}`);
  }

  const runtime = runtimeResolver(sdk, cueOrder);
  const known = new Set<string>(declared);

  /* ------------------------------------------- the tables must be sane -- */
  const dangling = Object.entries(SDK_SFX_ALIASES).filter(([, target]) => !known.has(target));
  if (dangling.length) fail(`alias targets that are not real cues: ${dangling.map(([k, v]) => `${k}->${v}`).join(", ")}`);

  const shadowing = Object.keys(SDK_SFX_ALIASES).filter((k) => known.has(k));
  if (shadowing.length) fail(`aliases shadowing real cue names: ${shadowing.join(", ")}`);

  /* ---------------------------------- the two resolvers must agree ------- */
  // Every cue, every alias, and every prefix of each — prefixes are where the
  // audit and the runtime can silently disagree about which match wins.
  const probes = new Set<string>();
  for (const name of [...(SDK_SFX_NAMES as readonly string[]), ...Object.keys(SDK_SFX_ALIASES)]) {
    probes.add(name);
    probes.add(name.toUpperCase());
    for (let i = 1; i <= name.length; i += 1) probes.add(name.slice(0, i));
  }
  for (const junk of ["", " ", "x", "zz", "definitely_not_a_sound", "explode!", "  fanfare "]) probes.add(junk);

  const mismatches: string[] = [];
  for (const probe of probes) {
    // An unresolved name audibly falls back to the generic blip, which is the
    // "select" cue — so that is the answer the audit's `undefined` predicts.
    const expected = resolveSfxName(probe) ?? "select";
    const actual = runtime(probe);
    if (expected !== actual) mismatches.push(`${JSON.stringify(probe)}: audit says ${expected}, runtime plays ${actual || "nothing"}`);
  }
  if (mismatches.length) {
    fail(`the audit and the runtime resolve ${mismatches.length} name(s) differently:\n  ${mismatches.slice(0, 12).join("\n  ")}`);
  }

  /* --------------------------------------- and the answers must be right -- */
  const cases: Array<[string, string]> = [
    ["coin", "coin"],
    ["EXPLOSION", "explode"],
    ["  fanfare ", "win"],
    ["gameover", "lose"],
    ["buzz", "lose"],
    ["explos", "explode"],
    ["definitely_not_a_sound", "select"],
    ["bu", "select"],
  ];
  for (const [input, expected] of cases) {
    const got = runtime(input);
    if (got !== expected) fail(`runtime played ${got || "nothing"} for ${JSON.stringify(input)}, expected ${expected}`);
  }

  console.log(`aliases: ${Object.keys(SDK_SFX_ALIASES).length}, cues: ${(SDK_SFX_NAMES as readonly string[]).length}`);
  console.log(`[OK] qa-forge-sfx-alias: audit and runtime agree on all ${probes.size} probed names, including every prefix`);
}

main();
