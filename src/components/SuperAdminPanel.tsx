"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  getSuperAdminKey,
  isDevSuperAdminClientEnabled,
  setSuperAdminKey,
} from "@/lib/super-admin-client";

/** 小说 / 漫画广场共用的超级管理员密钥面板 */
export function SuperAdminPanel({ scope }: { scope: "novel" | "comic" }) {
  const t = useTranslations("superAdmin");
  const devAutoAdmin = isDevSuperAdminClientEnabled();
  const [adminKeyDraft, setAdminKeyDraft] = useState("");
  const [adminEnabled, setAdminEnabled] = useState(false);

  useEffect(() => {
    setAdminEnabled(devAutoAdmin || !!getSuperAdminKey());
  }, [devAutoAdmin]);

  const scopeLabel = t(scope === "novel" ? "scopeNovel" : "scopeComic");

  if (devAutoAdmin) {
    return (
      <div className="mt-10 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm">
        <p className="font-medium text-emerald-200">{t("devAutoTitle")}</p>
        <p className="mt-1 text-xs leading-relaxed text-emerald-100/80">
          {t("devAutoBody", { scope: scopeLabel })}{" "}
          <code className="text-emerald-200/90">DEV_SUPER_ADMIN=1</code>
        </p>
      </div>
    );
  }

  return (
    <details className="mt-10 rounded-xl border border-dashed border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-4 py-3 text-sm">
      <summary className="cursor-pointer font-medium text-[var(--gc-muted)]">
        {t("summary")}
        {adminEnabled ? (
          <span className="ml-2 text-xs text-emerald-400">{t("enabledBadge", { scope: scopeLabel })}</span>
        ) : null}
      </summary>
      <p className="mt-2 text-xs leading-relaxed text-[var(--gc-text-faint)]">{t("helpText", { scope: scopeLabel })}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="password"
          value={adminKeyDraft}
          onChange={(e) => setAdminKeyDraft(e.target.value)}
          placeholder={t("keyPlaceholder")}
          className="min-w-[12rem] flex-1 rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)] px-3 py-2 text-xs text-[var(--gc-text)]"
        />
        <button
          type="button"
          className="rounded-lg border border-[color:var(--gc-border)] px-3 py-2 text-xs text-[var(--gc-text)]"
          onClick={() => {
            setSuperAdminKey(adminKeyDraft);
            window.location.reload();
          }}
        >
          {t("saveRefresh")}
        </button>
        {adminEnabled ? (
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-xs text-[var(--gc-muted)]"
            onClick={() => {
              setSuperAdminKey("");
              setAdminKeyDraft("");
              window.location.reload();
            }}
          >
            {t("exitAdmin")}
          </button>
        ) : null}
      </div>
    </details>
  );
}
