/**
 * 调试英文轻量分镜 JSON：npx tsx scripts/qa-comic-light-json-debug.ts
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

import { prisma } from "@/lib/prisma";
import {
  buildComicJsonSchema,
  buildComicSystemPrompt,
  panelsPerPageForLayout,
} from "@/lib/comic-generate-config";
import { buildComicLightUserMessage } from "@/lib/comic-locale-prompts";
import { resolveComicOutputLocale } from "@/lib/comic-locale-prompts";
import { getNovelStyleTextModelCascade, llmJson } from "@/lib/llm";

async function main() {
  const novel = await prisma.novel.findUnique({
    where: { id: "cmq5yjms00002lzrm9pd8w3l2" },
  });
  if (!novel) throw new Error("novel missing");

  const outputLocale = resolveComicOutputLocale(novel.prompt, novel.content);
  const layoutId = "grid_4";
  const panelsPerPage = panelsPerPageForLayout(layoutId);
  const model = getNovelStyleTextModelCascade()[0]!;
  const system = buildComicSystemPrompt(1, "wuxia", "japanese_clean", { outputLocale, layoutId });
  const user = buildComicLightUserMessage({
    locale: outputLocale,
    chunkStart: 1,
    chunkEnd: 1,
    chunkPages: 1,
    panelsPerPage,
    chunkPanels: panelsPerPage,
    pageCount: 4,
    novelTitle: novel.title,
    storySource: novel.content.slice(0, 3000),
  });

  console.log("locale:", outputLocale, "model:", model);
  const result = await llmJson({
    model,
    system,
    user,
    jsonSchema: buildComicJsonSchema(1, layoutId),
    temperature: 0.55,
    mode: "json_schema",
    timeoutMs: 120_000,
  });
  console.log("ok:", result.ok, "mode:", result.ok ? result.mode : result.modeTried, "error:", result.ok ? undefined : result.error);
  if (result.ok && result.raw && typeof result.raw === "object" && "pages" in result.raw) {
    const pages = (result.raw as { pages: unknown[] }).pages;
    console.log("pages returned:", pages?.length);
    const panels = (pages?.[0] as { panels?: unknown[] })?.panels;
    console.log("panels on page 1:", panels?.length);
    console.log("sample caption:", (panels?.[0] as { caption?: string })?.caption?.slice(0, 80));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
