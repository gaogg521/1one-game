"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type Revision = {
  id: string;
  sequence: number;
  cause?: string;
  status?: string;
  summary?: string | null;
  finalizedAt?: string | null;
  canRepublish?: boolean;
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
    recentRevisions?: Revision[];
    publications?: Publication[];
  };
} | null | undefined;

/** Makes the author-visible distinction between draft, confirmed, and public versions explicit. */
export function CreatorVersionStatus({
  core,
  work,
  className = "",
}: {
  core: CreatorCore;
  work?: { type: "game" | "novel" | "comic"; id: string };
  className?: string;
}) {
  const t = useTranslations("creatorVersion");
  const [republishingId, setRepublishingId] = useState<string | null>(null);
  const [republishError, setRepublishError] = useState(false);
  const current = core?.revision;
  if (!current) return null;

  const accepted = core?.project?.acceptedRevision;
  const currentIsAccepted = Boolean(accepted && accepted.id === current.id);
  const lastPublication = core?.project?.publications?.[0];
  const recent = core?.project?.recentRevisions ?? [];

  async function republish(revisionId: string) {
    if (!work || republishingId) return;
    setRepublishingId(revisionId);
    setRepublishError(false);
    try {
      const response = await fetch(`/api/works/${work.type}/${encodeURIComponent(work.id)}/publication`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish", revisionId }),
      });
      if (!response.ok) throw new Error("republish_failed");
      window.location.reload();
    } catch {
      setRepublishError(true);
      setRepublishingId(null);
    }
  }

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
      {recent.length > 1 ? (
        <div className="mt-2 border-t border-sky-300/15 pt-2">
          <p className="font-medium text-sky-100/85">{t("historyTitle")}</p>
          <ol className="mt-1 space-y-1 text-sky-100/65">
            {recent.map((revision) => (
              <li key={revision.id} className="flex flex-wrap gap-x-1">
                <span>{t("revision", { sequence: revision.sequence })}</span>
                {revision.id === current.id ? <span className="text-sky-200">· {t("currentMarker")}</span> : null}
                {revision.id === accepted?.id ? <span className="text-emerald-200">· {t("confirmedMarker")}</span> : null}
                {revision.summary ? <span className="truncate">· {revision.summary}</span> : null}
                {work && revision.canRepublish && revision.id !== accepted?.id ? (
                  <button
                    type="button"
                    disabled={Boolean(republishingId)}
                    onClick={() => void republish(revision.id)}
                    className="ml-1 text-emerald-200 underline decoration-emerald-300/40 underline-offset-2 disabled:opacity-50"
                  >
                    {republishingId === revision.id ? t("republishing") : t("republishVersion")}
                  </button>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {republishError ? <p role="status" className="mt-1 text-rose-200">{t("republishFailed")}</p> : null}
    </section>
  );
}
