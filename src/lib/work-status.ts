import type { AppLocale } from "@/i18n/routing";
import enMessages from "@/messages/en.json";
import msMessages from "@/messages/ms.json";
import thMessages from "@/messages/th.json";
import zhHansMessages from "@/messages/zh-Hans.json";
import zhHantMessages from "@/messages/zh-Hant.json";
import type { WorkVisibility } from "@/lib/auth/work-visibility";

export type WorkLifecycleStatus =
  | "draft"
  | "generating"
  | "pending_review"
  | "published"
  | "hidden";

export type WorkStatusBadge = {
  status: WorkLifecycleStatus;
  label: string;
  className: string;
};

const localeMessages = {
  "zh-Hans": zhHansMessages,
  "zh-Hant": zhHantMessages,
  en: enMessages,
  ms: msMessages,
  th: thMessages,
} as const;

const BADGE_CLASSNAMES: Record<WorkLifecycleStatus, string> = {
  draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  generating: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  pending_review: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  published: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  hidden: "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400",
};

function labelForStatus(locale: AppLocale, status: WorkLifecycleStatus) {
  const m = localeMessages[locale].workStatus;
  switch (status) {
    case "draft":
      return m.draft;
    case "generating":
      return m.generating;
    case "pending_review":
      return m.pendingReview;
    case "hidden":
      return m.hidden;
    default:
      return m.published;
  }
}

export function deriveWorkLifecycleStatus(opts: {
  dbStatus?: string | null;
  visibility?: string | null;
}): WorkLifecycleStatus {
  const dbStatus = opts.dbStatus?.trim();
  if (dbStatus === "draft_generating") return "generating";
  if (dbStatus === "draft") return "draft";

  const vis = (opts.visibility ?? "public") as WorkVisibility;
  if (vis === "pending_review") return "pending_review";
  if (vis === "hidden") return "hidden";
  return "published";
}

export function workStatusBadge(opts: {
  dbStatus?: string | null;
  visibility?: string | null;
  locale?: AppLocale;
}): WorkStatusBadge {
  const status = deriveWorkLifecycleStatus(opts);
  const locale = opts.locale ?? "zh-Hans";
  return { status, label: labelForStatus(locale, status), className: BADGE_CLASSNAMES[status] };
}

/** 发布完成页文案：按可见性区分 */
export function publishVisibilityMessage(visibility?: string | null, locale: AppLocale = "zh-Hans"): string {
  const m = localeMessages[locale].workStatus;
  const vis = visibility ?? "public";
  if (vis === "pending_review") {
    return m.savedPendingReview;
  }
  if (vis === "hidden") {
    return m.savedHidden;
  }
  return m.savedPublished;
}
