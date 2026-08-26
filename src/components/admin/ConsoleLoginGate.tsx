import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ConsolePreferencesToolbar } from "@/components/admin/ConsolePreferencesToolbar";
import { isConsoleSsoEnabled } from "@/lib/auth/console-sso";

export async function ConsoleLoginGate({ consolePath }: { consolePath: string }) {
  const t = await getTranslations("adminConsole");
  const ssoEnabled = isConsoleSsoEnabled();
  const ssoLoginHref = `/api/admin/console/sso/login?next=${encodeURIComponent(consolePath)}`;

  return (
    <div className="admin-console-root relative flex min-h-screen flex-col items-center justify-center bg-[var(--gc-bg)] px-6 text-center text-[var(--gc-text)]">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ConsolePreferencesToolbar />
      </div>
      <p className="gc-admin-type-meta">{t("eyebrow")}</p>
      <h1 className="gc-admin-type-page mt-4">{t("loginGateTitle")}</h1>
      <p className="gc-admin-type-body mt-3 max-w-md">{t("loginGateDesc")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {ssoEnabled ? (
          <Link
            href={ssoLoginHref}
            className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            {t("loginGateSsoAction")}
          </Link>
        ) : null}
        <Link
          href={`/login?next=${encodeURIComponent(consolePath)}`}
          className="rounded-full bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-sky-500"
        >
          {t("loginGateAction")}
        </Link>
        <Link href="/" className="rounded-full border border-white/15 px-6 py-2.5 text-sm text-white/70 hover:text-white">
          {t("backToProduct")}
        </Link>
      </div>
      <p className="gc-admin-type-label mt-8 max-w-lg">
        {ssoEnabled ? t("loginGateSsoHint") : t("loginGateLegacyHint")}
      </p>
    </div>
  );
}
