/** Migrate PlayGameClient to useTranslations('playGame') */
import fs from "node:fs";
import path from "node:path";

const filePath = path.join(import.meta.dirname, "../src/app/play/[id]/PlayGameClient.tsx");
let page = fs.readFileSync(filePath, "utf8");

if (!page.includes('useTranslations("playGame")')) {
  page = page.replace(
    'import Link from "next/link";\nimport { useRouter } from "next/navigation";',
    'import Link from "next/link";\nimport { useLocale, useTranslations } from "next-intl";\nimport { useRouter } from "next/navigation";\nimport { withLocalePath } from "@/i18n/navigation";\nimport type { AppLocale } from "@/i18n/routing";',
  );
  page = page.replace(
    "export function PlayGameClient({ id }: { id: string }) {\n  const router = useRouter();",
    'export function PlayGameClient({ id }: { id: string }) {\n  const t = useTranslations("playGame");\n  const locale = useLocale() as AppLocale;\n  const router = useRouter();',
  );
}

const replacements = [
  [/setError\(data\.error \?\? "加载失败"\)/g, 'setError(data.error ?? t("loadFailed"))'],
  [/setError\("数据不完整"\)/g, 'setError(t("incompleteData"))'],
  [/setError\("网络异常"\)/g, 'setError(t("networkError"))'],
  [/alert\(data\.error \?\? "生成失败"\)/g, 'alert(data.error ?? t("generateFailed"))'],
  [/alert\(data\.error \?\? "复制失败"\)/g, 'alert(data.error ?? t("copyFailed"))'],
  [/setPatchError\(data\.error \?\? "精炼失败"\)/g, 'setPatchError(data.error ?? t("refineFailed"))'],
  [/setPatchError\(data\.error \?\? "修改失败"\)/g, 'setPatchError(data.error ?? t("patchFailed"))'],
  [/setPatchError\("网络异常，请稍后重试"\)/g, 'setPatchError(t("patchNetworkError"))'],
  [/setPatchError\(data\.error \?\? "保存失败"\)/g, 'setPatchError(data.error ?? t("saveFailed"))'],
  [/setSaveMsg\("已保存到项目版本"\)/g, 'setSaveMsg(t("savedToVersion"))'],
  [/setPatchError\("保存时网络异常"\)/g, 'setPatchError(t("saveNetworkError"))'],
  [/\{likeCount > 0 \? likeCount : "点赞"\}/g, '{likeCount > 0 ? likeCount : t("like")}'],
  [/\{copied \? "已复制完整链接" : "复制链接"\}/g, '{copied ? t("copiedFullLink") : t("copyLink")}'],
  [/\{shortCopied \? "已复制短链" : "短链接"\}/g, '{shortCopied ? t("copiedShortLink") : t("shortLink")}'],
  [/\{mintBusy \? "生成中…" : "生成短链"\}/g, '{mintBusy ? t("mintingShort") : t("generateShortLink")}'],
  [/\{remixBusy \? "复制中…" : "Remix"\}/g, '{remixBusy ? t("remixing") : "Remix"}'],
  [/短链：/g, '{t("shortLinkLabel")}'],
  [/href="\/create\?from=/g, 'href={withLocalePath(`/create?from='],
  [/href="\/create"/g, 'href={withLocalePath("/create", locale)}" TEMP'],
];

// Fix create links manually after - the regex above is fragile

fs.writeFileSync(filePath, page, "utf8");
console.log("partial migrate play game - run manual fixes");
