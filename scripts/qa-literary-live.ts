/**
 * Live probe of the literary line's JSON-producing calls.
 *
 * The markdown-fence bug blocked every `llmJson` caller equally, so the game
 * line's fix should have unblocked novel and comic too — but "should have" is
 * not evidence. This calls the real functions against the real models and
 * reports what each one actually returns.
 *
 *   npx tsx scripts/qa-literary-live.ts
 */
import "dotenv/config";
import { loadRuntimeConfig } from "../src/lib/runtime-config";

type Probe = { name: string; run: () => Promise<{ ok: boolean; detail: string }> };

const NOVEL_EXCERPT = `第一章 夜行
林昭在子夜推开观星台的门，风灌进来，吹熄了案上最后一盏灯。她握紧袖中那枚断裂的玉简——三日前，师尊在这里失踪，只留下这半枚玉简和一地未干的墨。
"你不该来。"黑暗里有人开口。
林昭没有后退。她认得这个声音，是同门师兄沈砚。可沈砚半月前已被逐出师门。
"师尊在哪里？"她问。
沈砚笑了一声，那笑声里没有笑意："你确定要知道？知道了，你就回不去了。"
第二章 断简
玉简在掌心发烫。林昭想起师尊教她的第一课：观星者不问吉凶，只记录真相。可此刻真相就在眼前，她却不敢伸手。
沈砚递过来一卷残破的星图，上面用朱砂圈出七个位置。"这七处，每一处都死过一个观星者。师尊是第八个。"`;

async function main() {
  await loadRuntimeConfig();
  const { getNovelStyleTextModelCascade } = await import("../src/lib/model-config");
  const { runtimeLocaleGroup } = await import("../src/lib/runtime-locale-routing");
  const localeGroup = runtimeLocaleGroup("zh");
  const models = getNovelStyleTextModelCascade(localeGroup);
  console.log(`novel/comic text cascade: ${models.join(", ") || "(none)"}\n`);
  const model = models[0];
  if (!model) { console.error("[FAIL] no text model routed for the literary scenes"); process.exit(1); }

  const probes: Probe[] = [
    {
      name: "literary-brief: expandNovelCreativeBrief",
      run: async () => {
        const { expandNovelCreativeBrief } = await import("../src/lib/literary-brief");
        const out = await expandNovelCreativeBrief({ prompt: "一个观星者调查师尊失踪的悬疑仙侠短篇", inputLocale: "zh" });
        const brief = out.brief;
        // "pack" alone means the LLM patch never landed — the fence bug's signature.
        const viaLlm = brief.expandSource === "pack+llm";
        return { ok: viaLlm, detail: `expandSource=${brief.expandSource}, hints=${brief.narrativeHints?.length ?? 0}, style=${(brief.writingStyle ?? "").slice(0, 30)}` };
      },
    },
    {
      name: "comic-preread: fetchComicPlotDigest",
      run: async () => {
        const { fetchComicPlotDigest } = await import("../src/lib/comic-preread");
        const digest = await fetchComicPlotDigest({ model, novelTitle: "观星断简", contentExcerpt: NOVEL_EXCERPT, localeGroup });
        if (!digest) return { ok: false, detail: "returned null" };
        const beats = (digest as { keyBeats?: unknown[] }).keyBeats?.length ?? 0;
        return { ok: beats > 0, detail: `keyBeats=${beats}, keys=${Object.keys(digest).join(",")}` };
      },
    },
    {
      name: "comic-director: fetchComicDirectorPack",
      run: async () => {
        const { fetchComicDirectorPack } = await import("../src/lib/comic-director");
        const pack = await fetchComicDirectorPack({
          model,
          novelTitle: "观星断简",
          novelPrompt: "一个观星者调查师尊失踪的悬疑仙侠短篇",
          novelSummary: "林昭在师尊失踪后追查七处星图疑点，与被逐师兄沈砚交锋。",
          novelContent: NOVEL_EXCERPT,
          pageCount: 4,
          genre: "xianxia",
          stylePreset: "japanese_clean",
          novelMeta: null,
          outputLocale: "zh",
        } as Parameters<typeof fetchComicDirectorPack>[0]);
        if (!pack) return { ok: false, detail: "returned null" };
        const keys = Object.keys(pack as Record<string, unknown>);
        const pages = (pack as { pages?: unknown[] }).pages?.length ?? 0;
        const chars = (pack as { characters?: unknown[] }).characters?.length ?? 0;
        return { ok: keys.length > 1, detail: `keys=${keys.join(",")} pages=${pages} characters=${chars}` };
      },
    },
  ];

  const results: Array<{ name: string; ok: boolean; detail: string; ms: number }> = [];
  for (const p of probes) {
    const t0 = Date.now();
    try {
      const out = await p.run();
      results.push({ name: p.name, ...out, ms: Date.now() - t0 });
    } catch (e) {
      results.push({ name: p.name, ok: false, detail: `THREW ${(e as Error).message.slice(0, 200)}`, ms: Date.now() - t0 });
    }
    const r = results[results.length - 1]!;
    console.log(`${r.ok ? "OK  " : "FAIL"} ${r.name.padEnd(42)} ${String(r.ms).padStart(6)}ms  ${r.detail}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} literary JSON calls succeeded.`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => { console.error("FATAL", e?.message || e); process.exit(1); });
