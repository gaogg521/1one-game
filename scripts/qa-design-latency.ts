/**
 * Measures what the design call actually costs, three times over.
 *
 * The design stage is the pipeline's biggest variance: 44s, 68s, 154s and one
 * outright timeout across four observed builds, on an internal gateway whose
 * base round trip is a steady 1.5s. That rules out the network and points at
 * generation length -- minimax-2-7 is a reasoning model, and how long it
 * thinks about the same prompt varies per call. This prints the token counts
 * that confirm or refute that, which decides the fix: a longer timeout treats
 * the symptom, fewer generated tokens treats the cause.
 *
 *   npx tsx scripts/qa-design-latency.ts [runs]
 */
import fs from "node:fs";
import { buildDesignSystemPrompt, buildDesignUserPrompt, DESIGN_JSON_SCHEMA } from "../src/lib/game-forge/design-agent";
import { prisma } from "../src/lib/prisma";
import { parseJsonContent } from "../src/lib/llm/provider-openai-compatible";
import { coerceDesignShape } from "../src/lib/game-forge/design-coerce";
import { GameDesignDocSchema } from "../src/lib/game-forge/types";

const PROMPT = "一个关于熊猫在竹林里跳跃采集竹笋、躲避猎人陷阱的游戏，30秒内采集20根竹笋获胜";

function creds(): { base: string; key: string } {
  const lines = fs.readFileSync("key.txt", "utf8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return { base: lines[0]!.replace(/\/+$/, ""), key: lines[1]! };
}

async function main() {
  const runs = Number.parseInt(process.argv[2] ?? "3", 10);
  const { base, key } = creds();
  const system = buildDesignSystemPrompt();
  const user = buildDesignUserPrompt(PROMPT, {});
  console.log(`prompt size: system ${system.length} chars + user ${user.length} chars`);

  // The pipeline asks for json_schema first; this script originally measured
  // json_object and found a stable 34-43s, while the pipeline saw 68s, 154s
  // and an outright timeout on the same call. Measuring both modes side by
  // side is what separates "the model is slow" from "the structured-output
  // path on this gateway is slow".
  const mode = (process.argv[3] ?? "json_object") as "json_object" | "json_schema";
  console.log(`response_format: ${mode}`);
  const responseFormat =
    mode === "json_schema"
      ? { type: "json_schema" as const, json_schema: DESIGN_JSON_SCHEMA }
      : { type: "json_object" as const };

  const samples: Array<{ ms: number; completion: number; reasoning: number; content: number; finish: string }> = [];
  for (let i = 0; i < runs; i += 1) {
    const t0 = Date.now();
    const res = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "minimax-2-7",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        temperature: 0.7,
        response_format: responseFormat,
        max_tokens: 14_336,
      }),
      signal: AbortSignal.timeout(300_000),
    });
    const ms = Date.now() - t0;
    const json = (await res.json()) as {
      usage?: { completion_tokens?: number; prompt_tokens?: number };
      choices?: Array<{ finish_reason?: string; message?: { content?: string; reasoning_content?: string } }>;
    };
    const choice = json.choices?.[0];
    const s = {
      ms,
      completion: json.usage?.completion_tokens ?? -1,
      reasoning: (choice?.message?.reasoning_content ?? "").length,
      content: (choice?.message?.content ?? "").length,
      finish: choice?.finish_reason ?? "?",
    };
    // Latency is only half the question: dropping json_schema is only safe if
    // the reply still satisfies the design contract. Parse it the way the
    // pipeline does -- coerce the shape, then validate -- and report it.
    let verdict = "unchecked";
    try {
      const raw = parseJsonContent(choice?.message?.content);
      if (raw === null) {
        // An unparseable reply is the one failure coercion cannot rescue, so
        // say exactly why: the head and tail plus the parser's own complaint
        // separate "wrapped in prose" from "truncated" from "bad escape".
        const body = choice?.message?.content ?? "";
        let why = "unknown";
        try { JSON.parse(body); } catch (err) { why = (err as Error).message.slice(0, 120); }
        const file = `qa-output/design-unparseable-${Date.now().toString(36)}.txt`;
        fs.mkdirSync("qa-output", { recursive: true });
        fs.writeFileSync(file, body, "utf8");
        verdict = `UNPARSEABLE (${why}) head=${JSON.stringify(body.slice(0, 90))} tail=${JSON.stringify(body.slice(-90))} saved=${file}`;
      }
      else {
        const kinds = ((raw as { assets?: Array<{ kind?: unknown }> }).assets ?? []).map((a) => String(a?.kind));
        if (process.env.SHOW_KINDS === "1") console.log(`      asset kinds: ${kinds.join(", ")}`);
        const parsed = GameDesignDocSchema.safeParse(coerceDesignShape(raw));
        verdict = parsed.success ? "valid" : `INVALID: ${parsed.error.issues.slice(0, 2).map((i) => i.path.join(".") + " " + i.message).join(" | ")}`;
      }
    } catch (e) {
      verdict = `THREW: ${(e as Error).message.slice(0, 80)}`;
    }
    (s as typeof s & { verdict: string }).verdict = verdict;
    samples.push(s);
    console.log(`  run ${i + 1}: ${(s.ms / 1000).toFixed(1)}s  completion_tokens=${s.completion}  reasoning=${s.reasoning} chars  answer=${s.content} chars  finish=${s.finish}  schema=${(s as typeof s & { verdict: string }).verdict}`);
  }

  const ms = samples.map((s) => s.ms);
  const tok = samples.map((s) => s.completion);
  console.log(`\nlatency  min ${(Math.min(...ms) / 1000).toFixed(1)}s  max ${(Math.max(...ms) / 1000).toFixed(1)}s  spread ${(Math.max(...ms) / Math.max(1, Math.min(...ms))).toFixed(1)}x`);
  console.log(`tokens   min ${Math.min(...tok)}  max ${Math.max(...tok)}  spread ${(Math.max(...tok) / Math.max(1, Math.min(...tok))).toFixed(1)}x`);
  const reasoningShare = samples.map((s) => s.reasoning / Math.max(1, s.reasoning + s.content));
  console.log(`reasoning share of output: ${reasoningShare.map((r) => `${Math.round(r * 100)}%`).join(", ")}`);
}

main()
  .catch((e) => { console.error("FATAL", e?.message || e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
