"use client";

import { useTranslations } from "next-intl";

type Revision = {
  id: string;
  sequence: number;
  status?: string;
  summary?: string | null;
  finalizedAt?: string | null;
};

type Publication = {
  action: string;
  visibility: string;
  decision?: string;
  createdAt?: string;
};

type CreatorCore = {
  revision?: Revision | null;
  project?: {
    acceptedRevisionId?: string | null;
    acceptedRevision?: Revision | null;
    publications?: Publication[];
  };
} | null | undefined;

/** Makes the author-visible distinction between draft, confirmed, and public versions explicit. */
export function CreatorVersionStatus({ core, className = "" }: { core: CreatorCore; className?: string }) {
  const t = useTranslations("creatorVersion");
  const current = core?.revision;
  if (!current) return null;

  const accepted = core?.project?.acceptedRevision;
  const currentIsAccepted = Boolean(accepted && accepted.id === current.id);
  const lastPublication = core?.project?.publications?.[0];

  return (
    <section className={`rounded-xl border border-sky-400/25 bg-sky-950/20 px-3 py-2 text-xs text-sky-100 ${className}`} data-testid="creator-version-status">
      <p className="font-medium">{t("title")}</p>
      {accepted ? (
        <p className="mt-1 text-sky-100/80">
          {currentIsAccepted
            ? t("currentConfirmed", { sequence: current.sequence })
            : t("draftAhead", { current: current.sequence, accepted: accepted.sequence })}
        </p>
      ) : (
        <p className="mt-1 text-amber-200">{t("notConfirmed", { sequence: current.sequence })}</p>
      )}
      {!currentIsAccepted && accepted ? (
        <p className="mt-1 text-sky-100/65">{t("publishNote")}</p>
      ) : null}
      {lastPublication ? (
        <p className="mt-1 text-sky-100/65">{t("lastPublication", { action: lastPublication.action, visibility: lastPublication.visibility })}</p>
      ) : null}
    </section>
  );
}
