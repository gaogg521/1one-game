"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { LiteraryProductionChain } from "@/components/literary/LiteraryProductionChain";
import { ComicStandaloneChain } from "@/components/literary/ComicStandaloneChain";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

export function HomeLiteraryPipelineSection() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("home");

  return (
    <div className="mt-14 grid gap-8 lg:mt-16 lg:grid-cols-2 lg:gap-10">
      <div className="flex flex-col gap-4">
        <LiteraryProductionChain activeStep="outline" promotional />
        <Link
          href={withLocalePath("/novel/create", locale)}
          className="self-start text-sm font-medium text-[color:color-mix(in_srgb,var(--gc-accent)_95%,white)] hover:underline"
        >
          {t("literaryNovelCta")}
        </Link>
      </div>
      <div className="flex flex-col gap-4">
        <ComicStandaloneChain activeStep="pitch" promotional />
        <Link
          href={withLocalePath("/comic/create", locale)}
          className="self-start text-sm font-medium text-[color:color-mix(in_srgb,var(--gc-accent)_95%,white)] hover:underline"
        >
          {t("literaryComicCta")}
        </Link>
      </div>
    </div>
  );
}
