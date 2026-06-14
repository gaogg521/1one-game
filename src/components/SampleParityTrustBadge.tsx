"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { SampleParityUserInfo } from "@/lib/sample-parity-user";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

type Props = {
  info: SampleParityUserInfo;
  /** 创作台预览：不链到样品馆，只说明同款 */
  compact?: boolean;
};

/** 让用户看见「技术 parity 已兑现」—— 不是后台 QA 分数 */
export function SampleParityTrustBadge({ info, compact = false }: Props) {
  const t = useTranslations("sampleParity");
  const locale = useLocale() as AppLocale;
  const sampleHref = withLocalePath(info.samplePlayPath, locale);

  return (
    <div
      className="rounded-xl border border-[color:color-mix(in_srgb,var(--gc-accent)_28%,var(--gc-border))] bg-[color:color-mix(in_srgb,var(--gc-accent)_8%,transparent)] px-4 py-3 text-sm text-[var(--gc-text-soft)]"
      data-testid="sample-parity-trust-badge"
    >
      <p className="font-medium text-[color:color-mix(in_srgb,var(--gc-accent)_92%,white)]">
        {info.promptAligned ? t("titleSamePrompt") : t("titleCloneEngine")}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--gc-muted)]">
        {info.promptAligned
          ? t("bodySamePrompt", { sample: info.sampleTitle, scene: info.sceneName })
          : t("bodyCloneEngine", { sample: info.sampleTitle, scene: info.sceneName })}
      </p>
      {!compact ? (
        <Link
          href={sampleHref}
          className="mt-2 inline-flex text-xs font-medium text-[color:color-mix(in_srgb,var(--gc-accent)_90%,white)] hover:underline"
        >
          {t("compareSample")}
        </Link>
      ) : null}
    </div>
  );
}
