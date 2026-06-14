"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

type Props = {
  novel?: { id?: string; title: string } | null;
  locale: AppLocale;
  className?: string;
  /** 外层为整卡 Link 时，用按钮跳转避免嵌套 <a> */
  insideCardLink?: boolean;
};

export function ComicNovelSourceMeta({ novel, locale, className = "", insideCardLink }: Props) {
  const t = useTranslations("lists");
  const router = useRouter();

  if (!novel?.title) {
    return <p className={className}>{t("comicStandaloneBadge")}</p>;
  }

  const label = t("basedOnNovel", { title: novel.title });
  const linkedClass = `${className} text-left transition hover:text-[var(--gc-accent)] hover:underline`;

  if (novel.id && insideCardLink) {
    return (
      <button
        type="button"
        className={linkedClass}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          router.push(withLocalePath(`/novel/${novel.id}`, locale));
        }}
      >
        {label}
      </button>
    );
  }

  if (novel.id) {
    return (
      <Link href={withLocalePath(`/novel/${novel.id}`, locale)} className={linkedClass}>
        {label}
      </Link>
    );
  }

  return <p className={className}>{label}</p>;
}
