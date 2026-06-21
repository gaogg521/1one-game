/**
 * 预计算 60 模板的 embedding，存到 src/lib/game-templates/template-embeddings.json。
 * 运行：npx tsx scripts/precompute-template-embeddings.ts
 *
 * 需 OPENAI_API_KEY + OPENAI_BASE_URL（LiteLLM 网关）+ EMBEDDING_MODEL（默认 text-embedding-3-small）。
 * 失败的模板会跳过并打印；成功后写入 JSON 供运行时 template-embedding.ts 加载。
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { GAME_TEMPLATE_DEFINITIONS } from "../src/lib/game-templates/definitions";
import { buildTemplateSemanticText } from "../src/lib/game-templates/template-embedding";

const OUT = path.join(process.cwd(), "src/lib/game-templates/template-embeddings.json");

async function embed(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL ?? "").replace(/\/$/, "");
  if (!apiKey || !baseUrl) {
    console.error("[precompute] 缺 OPENAI_API_KEY / OPENAI_BASE_URL");
    return null;
  }
  const model = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";
  try {
    const res = await fetch(`${baseUrl}/v1/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(process.env.OPENAI_EXTRA_HEADERS_JSON ? JSON.parse(process.env.OPENAI_EXTRA_HEADERS_JSON) : {}),
      },
      body: JSON.stringify({ model, input: text.slice(0, 8000) }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.error(`[precompute] ${model} HTTP ${res.status}: ${await res.text().catch(() => "")}`.slice(0, 200));
      return null;
    }
    const data = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
    return data.data?.[0]?.embedding ?? null;
  } catch (e) {
    console.error(`[precompute] embed 失败: ${(e as Error).message}`.slice(0, 200));
    return null;
  }
}

async function main() {
  const records: Array<{ templateId: string; text: string; embedding: number[] }> = [];
  let ok = 0;
  let fail = 0;
  for (const def of GAME_TEMPLATE_DEFINITIONS) {
    const text = buildTemplateSemanticText(def.id);
    const vec = await embed(text);
    if (vec && vec.length > 0) {
      records.push({ templateId: def.id, text, embedding: vec });
      ok++;
      console.log(`✓ ${def.id}`);
    } else {
      fail++;
      console.log(`✗ ${def.id}`);
    }
    // 礼貌延迟，避免限流
    await new Promise((r) => setTimeout(r, 200));
  }
  await writeFile(OUT, JSON.stringify(records, null, 2), "utf8");
  console.log(`\n完成: ${ok} 成功 / ${fail} 失败 → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
