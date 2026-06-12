import type { NovelBriefUserRevision, NovelCreativeBrief } from "@/lib/literary-brief/novel-types";

export function formatNovelBriefOneLineSummary(brief: NovelCreativeBrief): string {
  const scene = brief.keyScenes[0] ?? brief.setting;
  return `${brief.logline} · ${scene}`.slice(0, 420);
}

export function formatNovelBriefForPipeline(brief: NovelCreativeBrief): string {
  const locale = brief.inputLocale ?? "zh";
  const isEnglish = locale === "en";
  const isMalay = locale === "ms";
  const isThai = locale === "th";
  const isTraditional = locale === "zh-Hant";
  const h = (zh: string, fallback: string) =>
    isEnglish || isMalay || isThai ? fallback : isTraditional ? zh.replace(/书/g, "書").replace(/类/g, "類").replace(/用户/g, "用戶") : zh;
  const lines: string[] = [
    h("【AI 深度扩写 · 小说创意构思】", "AI Expanded Novel Brief"),
    brief.title ? `${h("书名", isThai ? "ชื่อเรื่อง" : "Title")}：${brief.title}` : "",
    `${h("类型", isThai ? "ประเภท" : "Genre")}：${brief.genreLabel}`,
    `${h("用户原话", isThai ? "ข้อความจากผู้ใช้" : isMalay ? "Input pengguna" : "User prompt")}：${brief.userPrompt.trim()}`,
    "",
    `${h("【Logline】", "【Logline】")}${brief.logline}`,
    "",
    h("【时代与地点】", isThai ? "【ยุคสมัยและสถานที่】" : isMalay ? "【Zaman dan lokasi】" : "【Time and Place】"),
    brief.setting,
    "",
    h("【世界观】", isThai ? "【โลกของเรื่อง】" : isMalay ? "【Dunia cerita】" : "【World】"),
    brief.world,
    "",
    h("【主角】", isThai ? "【ตัวเอก】" : isMalay ? "【Protagonis】" : "【Protagonist】"),
    brief.protagonist,
    "",
    h("【核心矛盾】", isThai ? "【ความขัดแย้งหลัก】" : isMalay ? "【Konflik teras】" : "【Core Conflict】"),
    brief.coreConflict,
    "",
    h("【主角目标】", isThai ? "【เป้าหมายของตัวเอก】" : isMalay ? "【Matlamat protagonis】" : "【Protagonist Goal】"),
    brief.protagonistGoal,
    "",
    h("【主要角色】", isThai ? "【ตัวละครสำคัญ】" : isMalay ? "【Watak utama】" : "【Major Characters】"),
    ...brief.characters.map((c) => `- ${c}`),
    "",
    h("【对立面 / 反派势力】", isThai ? "【ฝ่ายตรงข้าม / ตัวร้าย】" : isMalay ? "【Pihak lawan / antagonis】" : "【Antagonists】"),
    ...brief.antagonists.map((c) => `- ${c}`),
    "",
    h("【情节节拍（起承转合）】", isThai ? "【จังหวะโครงเรื่อง】" : isMalay ? "【Rentak plot】" : "【Plot Beats】"),
    ...brief.plotBeats.map((b) => `- ${b}`),
    "",
    h("【关键场景 / 章节锚点】", isThai ? "【ฉากสำคัญ / หมุดบท】" : isMalay ? "【Babak penting / sauh bab】" : "【Key Scenes / Chapter Anchors】"),
    ...brief.keyScenes.map((s) => `- ${s}`),
    "",
    `${h("【基调】", isThai ? "【โทนเรื่อง】" : isMalay ? "【Nada】" : "【Tone】")}${brief.tone}`,
    "",
    h("【文风】", isThai ? "【สำนวน】" : isMalay ? "【Gaya penulisan】" : "【Writing Style】"),
    ...brief.writingStyle.map((s) => `- ${s}`),
    "",
    h("【连载与结构提示】", isThai ? "【คำแนะนำด้านโครงสร้างและการลงตอน】" : isMalay ? "【Petunjuk struktur dan rentak bersiri】" : "【Serialization and Structure Hints】"),
    ...brief.narrativeHints.map((s) => `- ${s}`),
  ];

  if (brief.negatives.length) {
    lines.push("", h("【禁忌】", isThai ? "【ข้อห้าม】" : isMalay ? "【Larangan】" : "【Avoid】"), ...brief.negatives.map((n) => `- ${n}`));
  }

  const hardConstraints =
    isEnglish || isMalay || isThai
      ? [
          isThai ? "【ข้อกำหนดตายตัว】" : isMalay ? "【Kekangan wajib】" : "【Hard Constraints】",
          isMalay
            ? "- Hasilkan novel web lengkap dalam bahasa sasaran, berbilang bab dan setiap bab mempunyai tajuk."
            : isThai
              ? "- ต้องเขียนเว็บโนเวลฉบับสมบูรณ์เป็นภาษาปลายทาง มีหลายบทและทุกบทต้องมีชื่อบท"
              : "- Output a complete web-novel in the target language, with multiple titled chapters.",
          isMalay
            ? "- Dilarang menggunakan istilah pembangunan permainan seperti templateId, HUD, level, atau unit pemain."
            : isThai
              ? "- ห้ามใช้คำศัพท์ฝั่งพัฒนาเกม เช่น templateId, HUD, ด่าน, หรือหน่วยผู้เล่น"
              : "- Do not use game-development terms like templateId, HUD, levels, or player units.",
          isMalay
            ? "- Motivasi watak mesti selaras dengan latar zaman dan genre; jangan masukkan IP tanpa kebenaran."
            : isThai
              ? "- แรงจูงใจของตัวละครต้องสอดคล้องกับยุคและแนวเรื่อง และห้ามอ้างอิง IP ที่ไม่ได้รับอนุญาต"
              : "- Character motivation must match the era and genre; do not introduce unauthorized IP.",
        ]
      : isTraditional
        ? [
            "【硬約束】",
            "- 輸出完整繁體中文網文小說正文，多章、每章有標題；全文不得混用簡體字。",
            "- 禁止出現遊戲 templateId、HUD、關卡、玩家單位等遊戲開發用語。",
            "- 人物動機與時代/類型一致；勿引入未授權 IP。",
          ]
        : [
            "【硬约束】",
            "- 输出完整中文网文小说正文，多章、每章有标题。",
            "- 禁止出现游戏 templateId、HUD、关卡、玩家单位等游戏开发用语。",
            "- 人物动机与时代/类型一致；勿引入未授权 IP。",
          ];

  lines.push("", ...hardConstraints);

  return lines.filter(Boolean).join("\n").slice(0, 3800);
}

export function mergeNovelBriefRevision(
  brief: NovelCreativeBrief,
  rev: NovelBriefUserRevision,
): NovelCreativeBrief {
  return {
    ...brief,
    logline: rev.logline?.trim() || brief.logline,
    world: rev.world?.trim() || brief.world,
  };
}

export function formatNovelRevisionBlock(rev: NovelBriefUserRevision): string {
  const lines: string[] = ["【用户修订的构思】"];
  if (rev.logline?.trim()) lines.push(`- Logline：${rev.logline.trim()}`);
  if (rev.world?.trim()) lines.push(`- 世界观：${rev.world.trim()}`);
  if (rev.addonNotes?.trim()) lines.push(`- 补充：${rev.addonNotes.trim()}`);
  return lines.join("\n");
}

export function buildNovelPipelinePrompt(
  userPrompt: string,
  brief: NovelCreativeBrief,
  rev?: NovelBriefUserRevision | null,
): string {
  const merged = rev ? mergeNovelBriefRevision(brief, rev) : brief;
  const block = formatNovelBriefForPipeline(merged);
  const revBlock = rev ? formatNovelRevisionBlock(rev) : "";
  return [userPrompt.trim(), "---", block, revBlock].filter(Boolean).join("\n\n").slice(0, 4000);
}
