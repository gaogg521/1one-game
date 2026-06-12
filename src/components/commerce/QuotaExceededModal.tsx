"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import type { QuotaExceededPayload } from "@/lib/commerce/quota-error";

type Props = {
  open: boolean;
  payload: QuotaExceededPayload | null;
  onClose: () => void;
};

export function QuotaExceededModal({ open, payload, onClose }: Props) {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const [copied, setCopied] = useState(false);

  const copyInvite = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session");
      const data = (await res.json()) as { user?: { referralCode?: string } };
      const code = data.user?.referralCode;
      if (!code) return;
      const url = `${window.location.origin}${withLocalePath("/start", locale)}?ref=${code}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [locale]);

  if (!open || !payload) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quota-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <h2 id="quota-modal-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {t("quota.title")}
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {payload.error ?? t("quota.defaultError")}
        </p>
        {typeof payload.needed === "number" && typeof payload.available === "number" ? (
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
            {t("quota.neededAvailable", { needed: payload.needed, available: payload.available })}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link
            href={withLocalePath("/billing", locale)}
            className="inline-flex flex-1 items-center justify-center rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700"
            onClick={onClose}
          >
            {t("quota.upgrade")}
          </Link>
          <button
            type="button"
            onClick={() => void copyInvite()}
            className="inline-flex flex-1 items-center justify-center rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {copied ? t("quota.copiedInvite") : t("quota.copyInvite")}
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full text-center text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          {t("quota.later")}
        </button>
      </div>
    </div>
  );
}

/** 创作页统一额度弹窗状态 */
export function useQuotaExceededModal() {
  const [payload, setPayload] = useState<QuotaExceededPayload | null>(null);
  const show = useCallback((p: QuotaExceededPayload) => setPayload(p), []);
  const close = useCallback(() => setPayload(null), []);
  const modal = (
    <QuotaExceededModal open={Boolean(payload)} payload={payload} onClose={close} />
  );
  return { showQuotaExceeded: show, closeQuotaExceeded: close, QuotaModal: modal };
}
