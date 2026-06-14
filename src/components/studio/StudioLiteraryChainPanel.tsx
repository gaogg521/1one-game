"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { LiteraryProductionChain, type LiteraryChainStepId } from "@/components/literary/LiteraryProductionChain";
import {
  ComicStandaloneChain,
  type ComicStandaloneStepId,
} from "@/components/literary/ComicStandaloneChain";
import type { AppLocale } from "@/i18n/routing";
import { mergeLocaleHeaders } from "@/lib/i18n/client-headers";
import { parseNovelChapters } from "@/lib/novel-chapters";
import {
  buildComicChainHrefs,
  buildNovelChainHrefs,
  inferComicChainStep,
  inferNovelChainStep,
} from "@/lib/literary-production-chain";
import {
  buildStandaloneComicChainHrefs,
  inferStandaloneComicChainStep,
} from "@/lib/comic-standalone-chain";

type WorkType = "project" | "novel" | "comic";

export type StudioChainWork = {
  type: WorkType;
  id: string;
  title: string;
  status: string;
  linkedNovelId?: string | null;
};

type LiteraryChainState = {
  kind: "literary";
  activeStep: LiteraryChainStepId;
  stepHrefs: Partial<Record<LiteraryChainStepId, string>>;
};

type StandaloneChainState = {
  kind: "standalone";
  activeStep: ComicStandaloneStepId;
  stepHrefs: Partial<Record<ComicStandaloneStepId, string>>;
};

type ChainState = LiteraryChainState | StandaloneChainState;

const DEFAULT_CHAIN: LiteraryChainState = {
  kind: "literary",
  activeStep: "outline",
  stepHrefs: {
    outline: "/novel/create",
    chapters: "/novel/create",
    characters: "/novel/create",
    storyboard: "/comic/create",
    comic: "/comic/create",
  },
};

type Props = {
  work: StudioChainWork | null;
  locale: AppLocale;
  className?: string;
};

export function StudioLiteraryChainPanel({ work, locale, className = "" }: Props) {
  const t = useTranslations("studio");
  const [chain, setChain] = useState<ChainState>(DEFAULT_CHAIN);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!work || work.type === "project") {
      setChain(DEFAULT_CHAIN);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        if (work.type === "novel") {
          const res = await fetch(`/api/novel/${encodeURIComponent(work.id)}`, {
            headers: mergeLocaleHeaders(locale),
          });
          const data = (await res.json()) as {
            novel?: {
              id: string;
              content: string;
              status?: string;
              canContinue?: boolean;
              comics?: { id: string; status?: string }[];
              draftStoryboardComics?: { id: string }[];
            };
          };
          if (cancelled || !data.novel) return;
          const chapters = parseNovelChapters(data.novel.content, locale);
          const latestComicId = data.novel.comics?.[data.novel.comics.length - 1]?.id ?? null;
          setChain({
            kind: "literary",
            activeStep: inferNovelChainStep(data.novel, chapters.length),
            stepHrefs: buildNovelChainHrefs(work.id, { latestComicId }),
          });
          return;
        }

        const res = await fetch(`/api/comic/${encodeURIComponent(work.id)}`, {
          headers: mergeLocaleHeaders(locale),
        });
        const data = (await res.json()) as {
          comic?: {
            id: string;
            novelId?: string | null;
            novel?: { id: string } | null;
            status?: string;
            panelsWithImage?: number;
            panelsTotal?: number;
          };
        };
        if (cancelled || !data.comic) return;
        const novelId = data.comic.novelId ?? data.comic.novel?.id ?? work.linkedNovelId ?? null;
        if (!novelId) {
          setChain({
            kind: "standalone",
            activeStep: inferStandaloneComicChainStep(data.comic),
            stepHrefs: buildStandaloneComicChainHrefs(work.id),
          });
          return;
        }
        setChain({
          kind: "literary",
          activeStep: inferComicChainStep(data.comic),
          stepHrefs: buildComicChainHrefs(work.id, novelId),
        });
      } catch {
        if (!cancelled) setChain(DEFAULT_CHAIN);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [work, locale]);

  return (
    <div className={className} data-testid="studio-literary-chain-panel">
      {work && work.type !== "project" ? (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-[var(--gc-text-soft)]">
            {t("chainFocusHint", { title: work.title })}
            {loading ? " …" : null}
          </p>
        </div>
      ) : null}
      {chain.kind === "standalone" ? (
        <ComicStandaloneChain
          activeStep={chain.activeStep}
          stepHrefs={chain.stepHrefs}
          compact
          linkPendingSteps
        />
      ) : (
        <LiteraryProductionChain activeStep={chain.activeStep} stepHrefs={chain.stepHrefs} compact />
      )}
    </div>
  );
}
