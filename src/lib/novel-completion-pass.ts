import { llmNovelText } from "@/lib/llm";
import { resolveNovelOutputLocale } from "@/lib/creative-brief/detect-input-locale";
import { fitNovelContentToMaxChars } from "@/lib/novel-chapters";
import { novelCompletionPassCharBudget } from "@/lib/novel-locale-prompts";
import { type NovelLengthOptions, novelMaxChars, type NovelLengthTier } from "@/lib/novel-length";

export async function extendNovelToEnding(params: {
  model: string;
  title: string;
  prompt: string;
  content: string;
  lengthTier: NovelLengthTier;
  lengthOpts?: NovelLengthOptions;
}): Promise<string> {
  const hardMax = novelMaxChars(params.lengthTier, params.lengthOpts);
  const remaining = Math.max(300, hardMax - params.content.length);
  if (remaining < 300) return params.content;
  const locale = resolveNovelOutputLocale(params.prompt);
  const passBudget = novelCompletionPassCharBudget(params.lengthTier, remaining);
  const completionPrompt =
    locale === "en"
      ? {
          system:
            "You are a web-novel editor. Do not rewrite the whole book. Continue from the existing ending section, add the missing late-story beats if needed, and finish the story cleanly in English. Output only the continuation text.",
          user: `Title: ${params.title}
Concept: ${params.prompt}

[Existing ending-side text]
${params.content.slice(-4000)}

Continue only from this point and finish the story. Requirements:
1. Preserve the established plot and voice; do not restart the story.
2. If the short story currently has too few chapters, you may add the missing final chapter(s) using the same chapter marker format.
3. End the main conflict cleanly. Do not leave "next chapter" hooks.
4. Keep the continuation within ${Math.min(remaining, 1800)} characters.
5. If chapter markers already exist, continue them consistently.`,
        }
      : locale === "ja"
        ? {
            system:
              "あなたはWeb小説編集者です。全体を書き直さず、既存の終盤から自然に続けて、必要なら不足分の終盤展開も補い、日本語で物語を完結させてください。出力は追記本文のみです。",
            user: `タイトル：${params.title}
発想：${params.prompt}

【既存の終盤本文】
${params.content.slice(-4000)}

この続きだけを書き、物語を完結させてください。条件：
1. 既存の筋と文体を保ち、新しい大枝を増やさない
2. 短編として章数が足りない場合は、同じ章見出し形式で不足章を補ってよい
3. 「次章へ続く」のような未完フックを残さない
4. 追記は ${passBudget} 字以内
5. 既に章区切りがある場合は同形式を維持する`,
          }
        : locale === "ms"
          ? {
              system:
                "Anda ialah editor novel web. Jangan tulis semula keseluruhan buku. Sambung dari bahagian akhir sedia ada, tambah bab akhir jika perlu, dan tamatkan cerita dalam Bahasa Melayu. Output hanya teks sambungan.",
              user: `Tajuk: ${params.title}
Idea: ${params.prompt}

[Teks hujung sedia ada]
${params.content.slice(-4000)}

Sambung dari titik ini dan tamatkan cerita. Syarat:
1. Kekalkan plot dan suara sedia ada
2. Jika bab terlalu sedikit, tambah bab akhir dengan format penanda bab yang sama
3. Jangan tinggalkan gancho "bab seterusnya"
4. Sambungan dalam ${passBudget} aksara
5. Kekalkan format bab jika sudah wujud`,
            }
          : locale === "th"
            ? {
                system:
                  "คุณเป็นบรรณาธิการเว็บโนเวล อย่าเขียนใหม่ทั้งเล่ม ให้ต่อจากตอนท้ายที่มีอยู่ เพิ่มบทปิดหากจำเป็น และจบเรื่องเป็นภาษาไทย ส่งออกเฉพาะส่วนที่ต่อเพิ่ม",
                user: `ชื่อเรื่อง: ${params.title}
แนวคิด: ${params.prompt}

[เนื้อหาช่วงท้าย]
${params.content.slice(-4000)}

ต่อจากจุดนี้และจบเรื่อง เงื่อนไข:
1. รักษาโครงเรื่องและน้ำเสียงเดิม
2. หากบทยังน้อยเกินไป ให้เพิ่มบทสุดท้ายด้วยรูปแบบเดิม
3. ห้ามค้างแบบ "ต่อในตอนหน้า"
4. ความยาวต่อเพิ่มไม่เกิน ${passBudget} อักขระ
5. หากมีรูปแบบบทอยู่แล้ว ให้ใช้ต่อให้สอดคล้อง`,
              }
            : locale === "zh-Hant"
              ? {
                  system:
                    "你是一位繁體中文網路小說編輯，任務不是重寫全書，而是只補寫結尾。必須嚴格承接已有正文，必要時補足缺失的終局章節，快速收束主線。只輸出追加正文，不要重複前文，不要解釋；全文使用繁體中文。",
                  user: `書名：${params.title}
創意：${params.prompt}

【已有正文（結尾附近）】
${params.content.slice(-4000)}

請只補寫最後的收束與結局，要求：
1. 承接現有情節，不重開新支線
2. 若短篇當前章節過少，可在同一格式下補足最終章節
3. 讓故事真正結束，不要留「下一章」
4. 篇幅控制在 ${passBudget} 字以內
5. 若已有章節格式，則延續章節格式；若已進入最後一章，就直接把該章寫完`,
                }
              : {
                  system:
                    "你是一位中文网络小说编辑，任务不是重写全书，而是只补写结尾。必须严格承接已有正文，必要时补足缺失的终局章节，快速收束主线，补足高潮后的结局。只输出追加正文，不要重复前文，不要解释。",
                  user: `书名：${params.title}
创意：${params.prompt}

【已有正文（结尾附近）】
${params.content.slice(-4000)}

请只补写最后的收束与结局，要求：
1. 承接现有情节，不重开新支线
2. 若短篇当前章节过少，可在同一格式下补足最终章节
3. 让故事真正结束，不要留“下一章”
4. 篇幅控制在 ${passBudget} 字以内
5. 若已有章节格式，则延续章节格式；若已进入最后一章，就直接把该章写完`,
                };

  const result = await llmNovelText(
    {
      model: params.model,
      system: completionPrompt.system,
      user: completionPrompt.user,
      temperature: 0.7,
      maxTokens: Math.min(8192, Math.ceil(passBudget * 1.4)),
      timeoutMs: 180_000,
    },
    params.lengthTier,
  );

  if (!result.ok || !result.text.trim()) return params.content;
  const merged = `${params.content.trim()}\n\n${result.text.trim()}`.trim();
  return fitNovelContentToMaxChars(merged, hardMax);
}
