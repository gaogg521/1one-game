import type { AppLocale } from "@/i18n/routing";
import { novelCompletenessMessage } from "@/lib/i18n/progress-message";
import { parseNovelChapters } from "@/lib/novel-chapters";
import type { BriefInputLocale } from "@/lib/creative-brief/detect-input-locale";
import { resolveNovelOutputLocale } from "@/lib/creative-brief/detect-input-locale";
import { novelMinAcceptChars } from "@/lib/novel-generate-config";
import { novelLengthConfig, type NovelLengthOptions, type NovelLengthTier } from "@/lib/novel-length";
import type { NovelChapterPlan } from "@/lib/novel-long-pipeline-types";

export type NovelCompletenessReport = {
  ok: boolean;
  reason: string;
  chapterCount: number;
};

const UNFINISHED_ENDING_RE =
  /未完待续|且听下回分解|故事才刚刚开始|下一章|下回|他不知道的是|她不知道的是|然而这只是开始|欲知后事|悬念|to be continued|next chapter|the story had only begun|little did he know|little did she know|but this was only the beginning|what he did not know|what she did not know|続く|次回|まだ始まったばかり|belum tamat|akan disambung|ตอนหน้า|ยังไม่จบ|เรื่องราวเพิ่งเริ่ม/i;

const ENDING_RE_ZH =
  /终章|尾声|大结局|后来|从此|至此|终于|结局|落幕|尘埃落定|此后|自此|圆满|归于平静|天下太平|新生|重获|完結|結局|尾聲|終章|塵埃落定|圓滿/i;

const ENDING_RE_EN =
  /epilogue|ending|at last|in the end|from then on|peace returned|finally|thereafter|ever after|the end|concluded|resolved|victory|defeated|reunited|forgave|restored|was over|had ended|peace at last/i;

const ENDING_RE_JA =
  /終わ|結末|完結|その後|やがて|ついに|最後に|幕を|収束|平穏|安ら|別れを告げ|物語は|これで|終幕/i;

const ENDING_RE_MS =
  /akhirnya|tamat|selesai|penutup|kesudahan|berakhir|kini aman|damai kembali|pada akhirnya/i;

const ENDING_RE_TH =
  /ในที่สุด|สุดท้าย|จบลง|จบเรื่อง|ตอนจบ|สิ้นสุด|สงบลง|สงบสุข|ในที่สุดแล้ว|จากนั้น/i;

function endingRegexForLocale(locale: BriefInputLocale): RegExp {
  switch (locale) {
    case "en":
      return new RegExp(`${ENDING_RE_EN.source}|${ENDING_RE_ZH.source}`, "i");
    case "ja":
      return new RegExp(`${ENDING_RE_JA.source}|${ENDING_RE_EN.source}`, "i");
    case "ms":
      return new RegExp(`${ENDING_RE_MS.source}|${ENDING_RE_EN.source}`, "i");
    case "th":
      return new RegExp(`${ENDING_RE_TH.source}|${ENDING_RE_EN.source}`, "i");
    case "zh-Hant":
    case "zh":
    default:
      return new RegExp(`${ENDING_RE_ZH.source}|${ENDING_RE_EN.source}`, "i");
  }
}

export function assessNovelCompleteness(
  content: string,
  tier: NovelLengthTier,
  opts?: NovelLengthOptions,
  promptForLocale?: string,
  chapterPlan?: NovelChapterPlan | null,
  uiLocale: AppLocale = "zh-Hans",
): NovelCompletenessReport {
  const trimmed = content.trim();
  const chapters = parseNovelChapters(trimmed);
  const chapterCount = chapters.length;
  const cfg = novelLengthConfig(tier, opts);
  const locale = promptForLocale ? resolveNovelOutputLocale(promptForLocale) : "zh";
  const endingRe = endingRegexForLocale(locale);
  const minAccept = novelMinAcceptChars(tier, opts);
  const msg = (key: string, params?: Record<string, string | number>) =>
    novelCompletenessMessage(uiLocale, key, params);

  if (trimmed.length < Math.floor(minAccept * 0.92)) {
    return { ok: false, reason: msg("tooShort"), chapterCount };
  }

  if (tier === "children") {
    if (UNFINISHED_ENDING_RE.test(trimmed.slice(-400)) && !endingRe.test(trimmed.slice(-400))) {
      return { ok: false, reason: msg("unfinishedEnding"), chapterCount };
    }
    return { ok: true, reason: msg("okComplete"), chapterCount };
  }

  if (chapterPlan && chapterPlan.chapters.length > 0) {
    const writtenNums = new Set(chapters.map((c) => c.num));
    const plannedNums = chapterPlan.chapters.map((c) => c.num);
    const missingCount = plannedNums.filter((n) => !writtenNums.has(n)).length;
    if (missingCount > 0) {
      const tail = trimmed.slice(-500);
      const lastChapter = chapters.at(-1);
      const tailBlob = `${lastChapter?.title ?? ""}\n${lastChapter?.body ?? tail}`;
      const partialOk =
        tier === "long" &&
        missingCount / plannedNums.length <= 0.12 &&
        writtenNums.size >= Math.ceil(plannedNums.length * 0.88) &&
        endingRe.test(tailBlob);
      if (partialOk) {
        return { ok: true, reason: msg("okCompletePartialPlan"), chapterCount };
      }
      return {
        ok: false,
        reason: msg("planIncomplete", {
          planned: plannedNums.length,
          written: plannedNums.length - missingCount,
        }),
        chapterCount,
      };
    }
  }

  if (tier === "short" && chapterCount < 3) {
    return { ok: false, reason: msg("shortTooFewChapters"), chapterCount };
  }
  if (tier === "medium" && chapterCount < 4) {
    return { ok: false, reason: msg("mediumTooFewChapters"), chapterCount };
  }

  const tail = trimmed.slice(-500);
  const lastChapter = chapters.at(-1);
  const tailBlob = `${lastChapter?.title ?? ""}\n${lastChapter?.body ?? tail}`;

  if (UNFINISHED_ENDING_RE.test(tailBlob) && !endingRe.test(tailBlob)) {
    return { ok: false, reason: msg("unfinishedEnding"), chapterCount };
  }

  if (!endingRe.test(tailBlob)) {
    const lastBody = (lastChapter?.body ?? tail).trim();
    if (lastBody.length < 180) {
      return { ok: false, reason: msg("tailTooShort"), chapterCount };
    }
    if (tier === "long" && chapterCount < 8) {
      return { ok: false, reason: msg("longTooFewChapters"), chapterCount };
    }
    return { ok: false, reason: msg("noEndingSignal"), chapterCount };
  }

  return { ok: true, reason: msg("okComplete"), chapterCount };
}
