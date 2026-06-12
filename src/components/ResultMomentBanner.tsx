import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { CreationMode } from "@/lib/product-ia";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getCreationModes } from "@/lib/product-ia";

type Props = {
  mode: CreationMode;
  title: string;
  subtitle?: string;
  /** 结果区下方的操作按钮（分享、点赞等） */
  actions?: React.ReactNode;
  /** 折叠到第二层的管理/解释区 */
  details?: React.ReactNode;
};

export function ResultMomentBanner({ mode, title, subtitle, actions, details }: Props) {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const meta = getCreationModes(locale)[mode];

  return (
    <section className="overflow-hidden rounded-2xl border border-[color:color-mix(in_srgb,var(--gc-accent)_28%,var(--gc-border))] bg-gradient-to-br from-[color:color-mix(in_srgb,var(--gc-accent)_10%,var(--gc-surface-glass))] to-[var(--gc-surface-glass)]">
      <div className="border-b border-[color:var(--gc-border)] px-5 py-4 sm:px-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:color-mix(in_srgb,var(--gc-accent)_85%,white)]">
          {t("resultBanner.ready", { label: meta.label, wow: meta.wow })}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--gc-text)] sm:text-3xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--gc-muted)]">{subtitle}</p>
        ) : null}
        {actions ? <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {details ? (
        <details className="group px-5 py-3 sm:px-6">
          <summary className="cursor-pointer list-none text-xs font-medium text-[var(--gc-muted)] marker:content-none hover:text-[var(--gc-text)]">
            <span className="inline-flex items-center gap-1">
              {t("resultBanner.moreActions")}
              <span className="text-[var(--gc-text-faint)] transition group-open:rotate-90">›</span>
            </span>
          </summary>
          <div className="mt-3 border-t border-[color:var(--gc-border)] pt-4">{details}</div>
        </details>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--gc-border)] bg-[color:color-mix(in_srgb,var(--gc-bg-elevated)_50%,transparent)] px-5 py-3 sm:px-6">
        <p className="text-[11px] text-[var(--gc-text-faint)]">{t("resultBanner.satisfied")}</p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={withLocalePath("/studio", locale)}
            className="rounded-full border border-[color:var(--gc-border)] px-3 py-1.5 text-[11px] font-medium text-[var(--gc-text-soft)] hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))]"
          >
            {t("resultBanner.myStudio")}
          </Link>
          <Link
            href={withLocalePath("/start", locale)}
            className="rounded-full border border-[color:color-mix(in_srgb,var(--gc-accent)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--gc-accent)_12%,transparent)] px-3 py-1.5 text-[11px] font-medium text-[color:color-mix(in_srgb,var(--gc-accent)_95%,white)]"
          >
            {t("resultBanner.createAnother")}
          </Link>
        </div>
      </div>
    </section>
  );
}
