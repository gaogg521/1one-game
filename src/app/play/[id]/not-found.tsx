import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

export default async function PlayNotFound() {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <p className="text-sm font-medium uppercase tracking-[0.3em] text-[var(--gc-muted)]">404</p>
      <h1 className="text-2xl font-semibold text-[var(--gc-text)]">{t("errors.notFoundTitle")}</h1>
      <p className="max-w-md text-sm text-[var(--gc-muted)]">{t("errors.notFoundDesc")}</p>
      <Link
        href={withLocalePath("/create", locale)}
        className="gc-theme-cta rounded-full px-6 py-2.5 text-sm font-semibold"
      >
        {t("errors.goCreate")}
      </Link>
    </div>
  );
}
