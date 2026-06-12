/** Migrate novel/create/page.tsx from NOVEL_CREATE_COPY to useTranslations('novelCreatePage') */
import fs from "node:fs";
import path from "node:path";

const pagePath = path.join(import.meta.dirname, "../src/app/novel/create/page.tsx");
let page = fs.readFileSync(pagePath, "utf8");

const start = page.indexOf("const NOVEL_CREATE_COPY");
const end = page.indexOf("\nconst STEP_KEYS", start);
if (start < 0 || end < 0) throw new Error("NOVEL_CREATE_COPY not found");
page = page.slice(0, start) + page.slice(end + 1);

page = page.replace(
  `  const copy = NOVEL_CREATE_COPY[locale];
  const tn = useTranslations("novelCreate");
  const tc = useTranslations("common");
  const steps = STEP_KEYS.map((n, index) => ({ n, label: copy.steps[index] }));`,
  `  const t = useTranslations("novelCreatePage");
  const tn = useTranslations("novelCreate");
  const tc = useTranslations("common");
  const stepLabels = t.raw("steps") as string[];
  const steps = STEP_KEYS.map((n, index) => ({ n, label: stepLabels[index] ?? "" }));`,
);

const replacements = [
  [/copy\.modelConnect\.replace\("\{model\}", ev\.model\)/g, 't("modelConnect", { model: ev.model })'],
  [/copy\.modelShort\.replace\("\{model\}", ev\.model\)/g, 't("modelShort", { model: ev.model })'],
  [/copy\.modelError\.replace\("\{model\}", ev\.model\)/g, 't("modelError", { model: ev.model })'],
  [
    /copy\.longSegment\s*\n\s*\.replace\("\{index\}", String\(ev\.index \?\? "\?"\)\)\s*\n\s*\.replace\("\{total\}", String\(ev\.total \?\? "\?"\)\)\s*\n\s*\.replace\("\{label\}", String\(ev\.label \?\? copy\.writing\)\)/g,
    't("longSegment", { index: String(ev.index ?? "?"), total: String(ev.total ?? "?"), label: String(ev.label ?? t("writing")) })',
  ],
  [
    /copy\.segmentDone\s*\n\s*\.replace\("\{index\}", String\(ev\.index \?\? "\?"\)\)\s*\n\s*\.replace\("\{total\}", String\(ev\.total \?\? "\?"\)\)\s*\n\s*\.replace\("\{length\}", ev\.length\.toLocaleString\(\)\)/g,
    't("segmentDone", { index: String(ev.index ?? "?"), total: String(ev.total ?? "?"), length: ev.length.toLocaleString() })',
  ],
  [
    /copy\.generatingWords\s*\n\s*\.replace\("\{current\}", totalChars\.toLocaleString\(\)\)\s*\n\s*\.replace\(\s*\n\s*"\{target\}",\s*\n\s*novelMaxChars\(effectiveLengthTier, childrenLengthOpts\)\.toLocaleString\(\),\s*\n\s*\)/g,
    't("generatingWords", { current: totalChars.toLocaleString(), target: novelMaxChars(effectiveLengthTier, childrenLengthOpts).toLocaleString() })',
  ],
  [
    /copy\.connectionError\.replace\("\{message\}", msg \|\| "Please retry"\)/g,
    't("connectionError", { message: msg || "Please retry" })',
  ],
  [/\[copy\.coverFailed, copy\.coverTimeout\]/g, '[t("coverFailed"), t("coverTimeout")]'],
  [/novelGenerationEtaHint\("children"\)/g, 'novelGenerationEtaHint("children", locale)'],
  [/novelGenerationEtaHint\(tier\.id\)/g, "novelGenerationEtaHint(tier.id, locale)"],
  [/novelStreamInterruptHint\(effectiveLengthTier\)/g, "novelStreamInterruptHint(effectiveLengthTier, locale)"],
  [/\bcopy\.([a-zA-Z0-9_]+)/g, 't("$1")'],
];

for (const [from, to] of replacements) {
  page = page.replace(from, to);
}

fs.writeFileSync(pagePath, page, "utf8");
console.log("migrated novel create page");
