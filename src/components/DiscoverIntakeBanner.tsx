import Link from "next/link";
import { useLocale } from "next-intl";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getDiscoverIntake } from "@/lib/product-ia";

export function DiscoverIntakeBanner() {
  const locale = useLocale() as AppLocale;
  const intake = getDiscoverIntake(locale);
  return (
    <section className="rounded-2xl border border-[color:color-mix(in_srgb,var(--gc-accent)_28%,var(--gc-border))] bg-[color:color-mix(in_srgb,var(--gc-accent)_8%,var(--gc-surface-glass))] px-5 py-4 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:px-6">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--gc-text)]">{intake.title}</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--gc-muted)]">{intake.body}</p>
      </div>
      <Link
        href={withLocalePath(intake.href, locale)}
        className="gc-theme-cta mt-4 inline-flex shrink-0 rounded-full px-5 py-2 text-xs font-semibold sm:mt-0"
      >
        {intake.cta}
      </Link>
    </section>
  );
}
