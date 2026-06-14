import type { BriefInputLocale } from "@/lib/creative-brief/detect-input-locale";
import { resolveNovelOutputLocale } from "@/lib/creative-brief/detect-input-locale";
import type { NovelLengthTier } from "@/lib/novel-length";

/** 各语言章节结构提示（注入 system prompt） */
export function novelChapterHint(tier: NovelLengthTier, locale: BriefInputLocale): string {
  if (tier === "children") {
    return locale === "en"
      ? "Short illustrated story; finish the arc in one pass."
      : locale === "ja"
        ? "短編；一気に起承転結まで書き切ること。"
        : locale === "ms"
          ? "Cerita pendek; selesaikan lengkung cerita dalam satu pusingan."
          : locale === "th"
            ? "เรื่องสั้น; จบโครงเรื่องให้ครบในรอบเดียว"
            : locale === "zh-Hant"
              ? "兒童短篇；一次寫完完整主線並收束結尾。"
              : "儿童短篇；一次写完完整主线并收束结尾。";
  }
  if (tier === "short") {
    switch (locale) {
      case "en":
        return "3–4 chapters, ~250–700 characters each; finish the full arc and resolve the ending";
      case "ja":
        return "3〜4 章、各章おおよそ 250〜700 字；主筋を完結させ、明確な結末まで書く";
      case "ms":
        return "3–4 bab, ~250–700 aksara setiap bab; selesaikan plot utama dan penutup yang jelas";
      case "th":
        return "3–4 บท บทละประมาณ 250–700 อักขระ จบเส้นเรื่องหลักและบทสรุปให้ชัดเจน";
      case "zh-Hant":
        return "3–4 章，每章 250–700 字，必須寫完整條主線並收束結尾";
      default:
        return "3–4 章，每章 250–700 字，必须写完完整主线并收束结尾";
    }
  }
  if (tier === "medium") {
    switch (locale) {
      case "en":
        return "5–8 chapters, ~500–1500 characters each (stay within the cap; complete the main plot and ending)";
      case "ja":
        return "5〜8 章、各章おおよそ 500〜1500 字（上限内で主筋と結末を完結させる）";
      case "ms":
        return "5–8 bab, ~500–1500 aksara setiap bab (kekal dalam had; selesaikan plot utama dan penutup)";
      case "th":
        return "5–8 บท บทละประมาณ 500–1500 อักขระ (อยู่ในขีดจำกัด จบเส้นเรื่องหลักและตอนจบ)";
      case "zh-Hant":
        return "5–8 章，每章 500–1500 字（全文不得超過上限，必須完成完整主線與結尾）";
      default:
        return "5–8 章，每章 500–1500 字（全文不得超过上限，必须完成完整主线与结尾）";
    }
  }
  switch (locale) {
    case "en":
      return "10–40 chapters, ~800–3000 characters each (segmented output allowed; must reach a real ending)";
    case "ja":
      return "10〜40 章、各章おおよそ 800〜3000 字（分割出力可；最終的に真の結末まで到達すること）";
    case "ms":
      return "10–40 bab, ~800–3000 aksara setiap bab (boleh berperingkat; mesti sampai ke penutup sebenar)";
    case "th":
      return "10–40 บท บทละประมาณ 800–3000 อักขระ (แบ่งส่วนได้ ต้องจบถึงตอนจบจริง)";
    case "zh-Hant":
      return "10–40 章，每章 800–3000 字（可分多段輸出，最終必須寫完全部規劃章節並落到結局）";
    default:
      return "10–40 章，每章 800–3000 字（可分多段输出，最终必须写完全部规划章节并落到结局）";
  }
}

/** 先提纲、后按篇幅预算写完（替代「触顶截断收束」） */
export function novelPlannedWritingRule(
  locale: BriefInputLocale,
  minChars: number,
  maxChars: number,
): string {
  switch (locale) {
    case "en":
      return `Follow the chapter outline and write the **entire** story within ${minChars}–${maxChars} characters. Distribute length across planned chapters; the final chapter must resolve the main conflict—never stop mid-arc because of length.`;
    case "ja":
      return `章提纲に従い、${minChars}–${maxChars} 字の範囲で**全編**を書き切ること。各章に字数を配分し、最終章で主筋を収束させる。分量を理由に途中で止めない。`;
    case "ms":
      return `Ikut rangka bab dan tulis **keseluruhan** cerita dalam ${minChars}–${maxChars} aksara. Agih panjang mengikut bab terancang; bab akhir mesti menyelesaikan konflik utama.`;
    case "th":
      return `ทำตามโครงบทและเขียน**ทั้งเรื่อง**ภายใน ${minChars}–${maxChars} อักขระ แบ่งความยาวตามบทที่วางแผน บทสุดท้ายต้องปิดเส้นเรื่องหลัก`;
    case "zh-Hant":
      return `按章節提綱在 ${minChars}–${maxChars} 字內寫完**全書**，各章分配字數，最終章收束主線；不得因篇幅中途停筆。`;
    default:
      return `按章节提纲在 ${minChars}–${maxChars} 字内写完**全书**，各章分配字数，最终章收束主线；不得因篇幅中途停笔。`;
  }
}

export function novelCompletionPassCharBudget(
  lengthTier: NovelLengthTier,
  remaining: number,
): number {
  const tierCap =
    lengthTier === "long" ? 5000 : lengthTier === "medium" ? 3500 : 2500;
  return Math.max(300, Math.min(remaining, tierCap));
}

export function resolveNovelLocaleFromPrompt(prompt: string): BriefInputLocale {
  return resolveNovelOutputLocale(prompt);
}

/** 长篇分批阶段标签 */
export function longNovelSegmentPhaseLabel(
  index: number,
  total: number,
  locale: BriefInputLocale,
): string {
  const labels = {
    opening: { en: "opening", ja: "導入", ms: "pembukaan", th: "เปิดเรื่อง", "zh-Hant": "開篇", zh: "开篇" },
    development: { en: "development", ja: "展開", ms: "perkembangan", th: "พัฒนาเรื่อง", "zh-Hant": "發展", zh: "发展" },
    climax: { en: "climax", ja: "クライマックス", ms: "klimaks", th: "จุดพีก", "zh-Hant": "高潮", zh: "高潮" },
    resolution: { en: "resolution", ja: "結末", ms: "penutup", th: "บทสรุป", "zh-Hant": "收束結局", zh: "收束结局" },
    progression: { en: "progression", ja: "推進", ms: "kemajuan", th: "ดำเนินเรื่อง", "zh-Hant": "推進", zh: "推进" },
  } as const;
  const L = (key: keyof typeof labels) => labels[key][locale] ?? labels[key].zh;

  if (index === 0) return L("opening");
  if (index === total - 1) return L("resolution");
  if (index === total - 2 && total > 3) return L("climax");
  if (index === 1) return L("development");
  return L("progression");
}

export function getLongNovelContinuationSystemPrompt(locale: BriefInputLocale): string {
  const chapterFmt =
    locale === "en"
      ? '"=== Chapter X: Title ==="'
      : locale === "ja"
        ? "「=== 第X章 章題 ===」"
        : locale === "ms" || locale === "th"
          ? '"=== Chapter X: Title ==="'
          : locale === "zh-Hant"
            ? "「=== 第X章 章節標題 ===」"
            : "「=== 第X章 章节标题 ===」";

  switch (locale) {
    case "en":
      return `You are a skilled long-form web-novel writer **continuing** an in-progress serialized work. All output must stay in English.

Hard rules:
1. **Continuity**: names, personalities, relationships, and world rules must match prior text, the bible, and the chapter plan. No reboots, no retcons, no repeating key beats already written.
2. **Chapter numbering**: continue from the last chapter number using ${chapterFmt}; never duplicate chapters.
3. **Write only this batch**: follow the chapter slice list exactly—no skipping, no extra chapters.
4. **Body only**: no outlines, recaps, author notes, or markdown code fences.
5. **Smooth handoff**: open by naturally continuing the previous batch's ending.`;
    case "ja":
      return `あなたは長編Web小説の作家で、連載中の作品を**続き書き**しています。出力はすべて日本語。

硬性要件：
1. **連続性**：人物・関係・世界観は前文・設定聖書・章計画と一致させる。書き直し・矛盾・重複禁止。
2. **章番号**：最終章の次から ${chapterFmt} 形式で連番を続ける。
3. **本批のみ**：指定章リストだけを書く。飛ばし・追加章禁止。
4. **本文のみ**：あらすじ・解説・コードブロック禁止。
5. **自然な接続**：前批末尾から滑らかに続ける。`;
    case "ms":
      return `Anda menulis sambungan novel web panjang. Semua output kekal dalam Bahasa Melayu.

Peraturan:
1. **Kesinambungan**: watak, dunia, dan plot mesti konsisten dengan teks terdahulu, bible, dan pelan bab.
2. **Penomboran bab**: sambung nombor bab terakhir dengan format ${chapterFmt}.
3. **Hanya batch ini**: tulis bab dalam senarai batch semasa sahaja.
4. **Teks novel sahaja**: tiada ringkasan atau nota pengarang.
5. **Sambungan lancar**: teruskan dari hujung batch sebelumnya.`;
    case "th":
      return `คุณกำลัง**ต่อเขียน**นิยายเว็บยาว ผลลัพธ์ทั้งหมดต้องเป็นภาษาไทย

กฎ:
1. **ความต่อเนื่อง**: ตัวละคร โลก และพล็อตต้องสอดคล้องกับเนื้อหาเดิม bible และแผนบท
2. **เลขบท**: ต่อจากบทสุดท้ายด้วยรูปแบบ ${chapterFmt}
3. **เฉพาะชุดนี้**: เขียนเฉพาะบทในรายการชุดนี้
4. **เฉพาะเนื้อหา**: ห้ามสรุปหรืออธิบายนอกเรื่อง
5. **ต่อเนื่อง**: เปิดโดยเชื่อมจากท้ายชุดก่อนหน้า`;
    case "zh-Hant":
      return `你是一位擅長繁體中文長篇網路小說的 AI 作家，正在**續寫**一部已在連載中的作品。全文使用繁體中文。

硬性要求：
1. **劇情連貫**：人物姓名、性格、關係、世界觀必須與前文、設定聖經及章規劃一致，禁止重啟故事、禁止吃書、禁止重複已發生的關鍵情節。
2. **章節連續**：章節號必須從前文最後章節之後遞增，格式 ${chapterFmt}，不要重複已寫章節。
3. **只寫本批章節**：嚴格按用戶給出的章規劃列表寫作，不要跳章、不要合併計劃外的章。
4. **只輸出正文**：不要輸出大綱、回顧、作者說明或 markdown 程式碼塊。
5. **承上啟下**：開頭自然銜接上一段末尾情境，不要突兀轉場。`;
    default:
      return `你是一位擅长中文长篇网络小说的 AI 作家，正在**续写**一部已在连载中的作品。

硬性要求：
1. **剧情连贯**：人物姓名、性格、关系、世界观必须与前文、设定圣经及章规划一致，禁止重启故事、禁止吃书、禁止重复已发生的关键情节。
2. **章节连续**：章节号必须从前文最后章节之后递增，格式 ${chapterFmt}，不要重复已写章节。
3. **只写本批章节**：严格按用户给出的章规划列表写作，不要跳章、不要合并计划外的章。
4. **只输出正文**：不要输出大纲、回顾、作者说明或 markdown 代码块。
5. **承上启下**：开头自然衔接上一段末尾情境，不要突兀转场。`;
  }
}

export function buildLongNovelBibleSystemPrompt(locale: BriefInputLocale): string {
  switch (locale) {
    case "en":
      return `You are a long-form web-novel bible editor. Output JSON that locks world-building and characters for segmented writing. All string fields must be in English. Ending direction must be explicit but not spoil details.`;
    case "ja":
      return `長編Web小説の「設定聖書」編集者です。ユーザー創意から JSON を出力し、世界観と人物を固定します。文字列はすべて日本語。結末の方向性は明確に、詳細はネタバレしない。`;
    case "ms":
      return `Editor bible novel web panjang. Keluarkan JSON untuk mengunci dunia dan watak. Semua medan teks dalam Bahasa Melayu. Arah penutup mesti jelas tanpa spoiler terperinci.`;
    case "th":
      return `บรรณาธิการ bible นิยายเว็บยาว ส่งออก JSON ล็อกโลกและตัวละคร ข้อความทั้งหมดเป็นภาษาไทย ทิศทางตอนจบต้องชัดแต่ไม่สปอยล์รายละเอียด`;
    case "zh-Hant":
      return `你是長篇網路小說「設定聖經」編輯。根據用戶創意輸出 JSON，鎖定世界觀與人物，供後續分章寫作使用。全文繁體中文。人物姓名具體、關係清晰；結局方向明確但不劇透細節。`;
    default:
      return `你是长篇网络小说「设定圣经」编辑。根据用户创意输出 JSON，锁定世界观与人物，供后续分章写作使用。要求：人物姓名具体、关系清晰；世界观可支撑 10 万字级连载；核心矛盾有张力；结局方向明确但不剧透细节。`;
  }
}

export function buildLongNovelChapterPlanSystemPrompt(locale: BriefInputLocale): string {
  switch (locale) {
    case "en":
      return `You are a long-form web-novel chapter-plan editor. From the bible, output chapter-plan JSON in English. Chapter numbers start at 1; titles 2–12 words; summaries 2–3 sentences each; phases distributed opening→rising→climax→resolution.`;
    case "ja":
      return `長編Web小説の章計画編集者です。設定聖書から章計画 JSON を日本語で出力。章番号は 1 から；タイトルは短く；各章 summary は2〜3文；phase は opening→rising→climax→resolution。`;
    case "ms":
      return `Editor pelan bab novel web panjang. Daripada bible, keluarkan JSON pelan bab dalam Bahasa Melayu. Tajuk ringkas; summary 2–3 ayat; fasa opening→rising→climax→resolution.`;
    case "th":
      return `บรรณาธิการแผนบทนิยายเว็บยาว จาก bible ส่งออก JSON แผนบทเป็นภาษาไทย ชื่อบทสั้น summary 2–3 ประโยค phase opening→rising→climax→resolution`;
    case "zh-Hant":
      return `你是長篇網路小說章節規劃編輯。根據設定聖經，輸出全書分章要點 JSON（繁體中文）。章節號從 1 遞增；title 2–12 字；summary 每章 2–3 句；phase 分布合理（opening→rising→climax→resolution）。`;
    default:
      return `你是长篇网络小说章节规划编辑。根据设定圣经，输出全书分章要点 JSON。要求：章节号从 1 递增；title 2–12 字；summary 每章 2–3 句写清本章事件与情绪；phase 分布合理（opening→rising→climax→resolution）。`;
  }
}

/** en/ms/th 用 Latin「Chapter X: Title」；ja/zh/zh-Hant 用「第X章 标题」。 */
export function usesLatinNovelChapterMarkers(locale: BriefInputLocale): boolean {
  return locale === "en" || locale === "ms" || locale === "th";
}

export function defaultNovelChapterTitle(locale: BriefInputLocale): string {
  switch (locale) {
    case "en":
      return "Body";
    case "ja":
      return "本文";
    case "ms":
      return "Isi";
    case "th":
      return "เนื้อหา";
    case "zh-Hant":
      return "正文";
    default:
      return "正文";
  }
}

export function formatNovelChapterMarkerHead(
  num: number,
  title: string,
  locale: BriefInputLocale,
): string {
  const t = title.trim() || defaultNovelChapterTitle(locale);
  if (usesLatinNovelChapterMarkers(locale)) {
    return `=== Chapter ${num}: ${t} ===`;
  }
  return `=== 第${num}章 ${t} ===`;
}

export function formatChapterRecapLine(
  chapter: { num: number; title: string; body: string },
  locale: BriefInputLocale,
  maxBody = 100,
): string {
  const snippet = `${chapter.body.replace(/\s+/g, " ").slice(0, maxBody)}…`;
  switch (locale) {
    case "en":
      return `Chapter ${chapter.num} "${chapter.title}": ${snippet}`;
    case "ja":
      return `第${chapter.num}章「${chapter.title}」：${snippet}`;
    case "ms":
      return `Bab ${chapter.num} "${chapter.title}": ${snippet}`;
    case "th":
      return `บทที่ ${chapter.num} "${chapter.title}": ${snippet}`;
    case "zh-Hant":
      return `第${chapter.num}章《${chapter.title}》：${snippet}`;
    default:
      return `第${chapter.num}章《${chapter.title}》：${snippet}`;
  }
}

export function formatChapterPlanSliceLine(
  ch: { num: number; title: string; phase: string; summary: string },
  locale: BriefInputLocale,
): string {
  switch (locale) {
    case "en":
      return `Chapter ${ch.num} "${ch.title}" (${ch.phase}): ${ch.summary}`;
    case "ja":
      return `第${ch.num}章「${ch.title}」（${ch.phase}）：${ch.summary}`;
    case "ms":
      return `Bab ${ch.num} "${ch.title}" (${ch.phase}): ${ch.summary}`;
    case "th":
      return `บทที่ ${ch.num} "${ch.title}" (${ch.phase}): ${ch.summary}`;
    case "zh-Hant":
      return `第${ch.num}章《${ch.title}》（${ch.phase}）：${ch.summary}`;
    default:
      return `第${ch.num}章《${ch.title}》（${ch.phase}）：${ch.summary}`;
  }
}

export function joinChapterNums(nums: number[], locale: BriefInputLocale): string {
  const sep = usesLatinNovelChapterMarkers(locale) ? ", " : "、";
  return nums.map(String).join(sep);
}

export function buildLongNovelSegmentBatchTask(opts: {
  locale: BriefInputLocale;
  segmentIndex: number;
  totalSegments: number;
  phase: string;
  nums: string;
  targetChars: number;
  hasPrior: boolean;
  isContinuation: boolean;
}): string {
  const { locale, segmentIndex, totalSegments, phase, nums, targetChars, hasPrior, isContinuation } =
    opts;
  const cont = hasPrior || isContinuation;

  switch (locale) {
    case "en":
      return segmentIndex === 0 && !cont
        ? `Batch 1/${totalSegments} (${phase}): write **only** chapter(s) ${nums}; open the story. Target ~${targetChars} characters.`
        : `Batch ${segmentIndex + 1}/${totalSegments} (${phase}): write **only** chapter(s) ${nums}; ${cont ? "continue smoothly; " : ""}no repeated beats. Target ~${targetChars} characters.`;
    case "ja":
      return segmentIndex === 0 && !cont
        ? `第 1/${totalSegments} 批（${phase}）：**${nums} 章のみ**書く。導入と登場。約 ${targetChars} 字。`
        : `第 ${segmentIndex + 1}/${totalSegments} 批（${phase}）：**${nums} 章のみ**。${cont ? "前文に続け、" : ""}重複禁止。約 ${targetChars} 字。`;
    case "ms":
      return segmentIndex === 0 && !cont
        ? `Batch 1/${totalSegments} (${phase}): tulis **hanya** bab ${nums}; buka cerita. Sasaran ~${targetChars} aksara.`
        : `Batch ${segmentIndex + 1}/${totalSegments} (${phase}): tulis **hanya** bab ${nums}; ${cont ? "sambung lancar; " : ""}jangan ulang. ~${targetChars} aksara.`;
    case "th":
      return segmentIndex === 0 && !cont
        ? `ชุด 1/${totalSegments} (${phase}): เขียน**เฉพาะ**บท ${nums}; เปิดเรื่อง ~${targetChars} อักขระ`
        : `ชุด ${segmentIndex + 1}/${totalSegments} (${phase}): เขียน**เฉพาะ**บท ${nums}; ${cont ? "ต่อเนื่อง " : ""}~${targetChars} อักขระ`;
    case "zh-Hant":
      return segmentIndex === 0 && !cont
        ? `第 1/${totalSegments} 批（${phase}）：**只寫**第 ${nums} 章，完成開篇。本批約 ${targetChars} 字。`
        : `第 ${segmentIndex + 1}/${totalSegments} 批（${phase}）：**只寫**第 ${nums} 章，${cont ? "緊接前文，" : ""}勿重複。約 ${targetChars} 字。`;
    default:
      return segmentIndex === 0 && !cont
        ? `第 1/${totalSegments} 批（${phase}）：**只写**第 ${nums} 章，完成开篇。本批约 ${targetChars} 字。`
        : `第 ${segmentIndex + 1}/${totalSegments} 批（${phase}）：**只写**第 ${nums} 章，${cont ? "紧接前文，" : ""}勿重复。约 ${targetChars} 字。`;
  }
}

export function getLongNovelPolishSystemPrompt(locale: BriefInputLocale): string {
  const noHead =
    usesLatinNovelChapterMarkers(locale)
      ? 'Do not output "=== Chapter X" header lines or explanations.'
      : "不要输出「=== 第X章」标题行、不要输出说明。";

  switch (locale) {
    case "en":
      return `You are a web-novel line editor. Lightly polish a single chapter.
Hard rules: plot, character names, and causality unchanged; no adding/removing key events; meaning unchanged.
Fix grammar, repetition, awkward transitions, and obvious filler. Keep web-novel pacing—no literary pretension.
Output polished chapter body only. ${noHead}`;
    case "ja":
      return `Web小説の推敲編集者。1章分を軽く潤色する。
硬性：プロット・人名・因果は不変；重要イベントの増減禁止；意味を変えない。
文病・重複・接続の不自然さのみ修正。ネット文のテンポを保つ。
潤色後の本章本文のみ出力。${noHead}`;
    case "ms":
      return `Editor barisan novel web. Polest ringkas satu bab.
Peraturan: plot, nama watak, sebab-akibat tidak berubah; jangan tambah/buang peristiwa penting.
Betulkan tatabahasa, pengulangan, transisi canggung. Kekalkan tempo novel web.
Output teks bab yang dipoles sahaja. ${noHead}`;
    case "th":
      return `บรรณาธิการนิยายเว็บ ขัดเกลาบทเดียวแบบเบา
กฎ: พล็อต ชื่อตัวละคร และเหตุผลไม่เปลี่ยน ห้ามเพิ่ม/ลดเหตุการณ์สำคัญ
แก้ไวยากรณ์ การซ้ำ การเชื่อมที่ awkward คงจังหวะนิยายเว็บ
ส่งออกเฉพาะเนื้อหาบทที่ขัดเกลา ${noHead}`;
    case "zh-Hant":
      return `你是繁體中文網文潤色編輯。對單章正文做輕量潤色。
硬性要求：情節、人物姓名、因果關係不變；不增刪關鍵事件；不改變章節含義。
只修正語病、重複用詞、生硬銜接與明顯口語贅餘。保持網文節奏，勿改成文藝腔。
只輸出潤色後的本章正文（${noHead}）`;
    default:
      return `你是中文网文润色编辑。对单章正文做轻量润色。
硬性要求：情节、人物姓名、因果关系不变；不增删关键事件；不改变章节含义。
只修正语病、重复用词、生硬衔接与明显口语赘余。保持网文节奏，勿改成文艺腔。
只输出润色后的本章正文（${noHead}）`;
  }
}

export function buildLongNovelPolishUserMessage(opts: {
  locale: BriefInputLocale;
  bibleBrief: string;
  chapterNum: number;
  chapterTitle: string;
  body: string;
}): string {
  const { locale, bibleBrief, chapterNum, chapterTitle, body } = opts;
  const excerpt = body.slice(0, 12_000);
  const head = formatNovelChapterMarkerHead(chapterNum, chapterTitle, locale);

  switch (locale) {
    case "en":
      return `[Setting reference]\n${bibleBrief}\n\n[Chapter ${chapterNum}: ${chapterTitle}]\n${excerpt}\n\nPolish the above; keep length close to the original.`;
    case "ja":
      return `【設定参考】\n${bibleBrief}\n\n【${head}】\n${excerpt}\n\n上記を潤色。字数は原文に近く。`;
    case "ms":
      return `[Rujukan tetapan]\n${bibleBrief}\n\n[${head}]\n${excerpt}\n\nPolest teks di atas; panjang hampir asal.`;
    case "th":
      return `[อ้างอิง setting]\n${bibleBrief}\n\n[${head}]\n${excerpt}\n\nขัดเกลาข้อความด้านบน ความยาวใกล้เคียงต้นฉบับ`;
    case "zh-Hant":
      return `【設定參考】\n${bibleBrief}\n\n【${head}】\n${excerpt}\n\n請潤色以上正文，字數與原文接近。`;
    default:
      return `【设定参考】\n${bibleBrief}\n\n【${head}】\n${excerpt}\n\n请润色以上正文，字数与原文接近。`;
  }
}

export function buildLongNovelSegmentUserMessageBody(opts: {
  locale: BriefInputLocale;
  prompt: string;
  title?: string;
  bibleText: string;
  chapterBlock: string;
  recap: string;
  tail: string;
  task: string;
}): string {
  const { locale, prompt, title, bibleText, chapterBlock, recap, tail, task } = opts;
  const titleLine = title?.trim();

  switch (locale) {
    case "en":
      return `[User concept] ${prompt.trim()}
${titleLine ? `[Suggested title] ${titleLine}` : ""}

[Story bible]
${bibleText}

[Chapters to write in this batch]
${chapterBlock}

${recap ? `[Recent recap]\n${recap}\n` : ""}${tail ? `[Prior ending—continue naturally]\n…${tail}\n` : ""}[Batch task] ${task}`;
    case "ja":
      return `【ユーザー発想】${prompt.trim()}
${titleLine ? `【推奨タイトル】${titleLine}` : ""}

【設定聖書】
${bibleText}

【本批の章計画】
${chapterBlock}

${recap ? `【直近のあらすじ】\n${recap}\n` : ""}${tail ? `【前批末尾（自然に接続）】\n…${tail}\n` : ""}【本批タスク】${task}`;
    case "ms":
      return `[Idea pengguna] ${prompt.trim()}
${titleLine ? `[Tajuk dicadangkan] ${titleLine}` : ""}

[Bible cerita]
${bibleText}

[Bab batch ini]
${chapterBlock}

${recap ? `[Ringkasan terkini]\n${recap}\n` : ""}${tail ? `[Hujung batch lepas]\n…${tail}\n` : ""}[Tugas batch] ${task}`;
    case "th":
      return `[แนวคิด] ${prompt.trim()}
${titleLine ? `[ชื่อที่แนะนำ] ${titleLine}` : ""}

[Story bible]
${bibleText}

[บทในชุดนี้]
${chapterBlock}

${recap ? `[สรุปล่าสุด]\n${recap}\n` : ""}${tail ? `[ท้ายชุดก่อน]\n…${tail}\n` : ""}[งานชุดนี้] ${task}`;
    case "zh-Hant":
      return `【用戶創意】${prompt.trim()}
${titleLine ? `【建議書名】${titleLine}` : ""}

【設定聖經】
${bibleText}

【本批須完成的章節規劃】
${chapterBlock}

${recap ? `【前文摘要（最近章節）】\n${recap}\n` : ""}${tail ? `【上一批末尾原文（請自然銜接）】\n…${tail}\n` : ""}【本批任務】${task}`;
    default:
      return `【用户创意】${prompt.trim()}
${titleLine ? `【建议书名】${titleLine}` : ""}

【设定圣经】
${bibleText}

【本批须完成的章节规划】
${chapterBlock}

${recap ? `【前文摘要（最近章节）】\n${recap}\n` : ""}${tail ? `【上一批末尾原文（请自然衔接）】\n…${tail}\n` : ""}【本批任务】${task}`;
  }
}
