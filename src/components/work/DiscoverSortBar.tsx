"use client";

import { useTranslations } from "next-intl";

export type NovelDiscoverSort = "playCount" | "likeCount" | "createdAt";
export type ComicDiscoverSort = "likeCount" | "createdAt";

type Props =
  | {
      kind: "novel";
      value: NovelDiscoverSort;
      onChange: (sort: NovelDiscoverSort) => void;
    }
  | {
      kind: "comic";
      value: ComicDiscoverSort;
      onChange: (sort: ComicDiscoverSort) => void;
    };

export function DiscoverSortBar(props: Props) {
  const t = useTranslations("lists");

  const options =
    props.kind === "novel"
      ? ([
          { key: "playCount" as const, label: t("hot") },
          { key: "likeCount" as const, label: t("mostLiked") },
          { key: "createdAt" as const, label: t("latest") },
        ] as const)
      : ([
          { key: "likeCount" as const, label: t("mostLiked") },
          { key: "createdAt" as const, label: t("latest") },
        ] as const);

  return (
    <div
      className="flex flex-wrap items-center gap-3"
      data-testid={`discover-sort-${props.kind}`}
    >
      <div className="flex gap-1 rounded-full border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-0.5">
        {options.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => props.onChange(opt.key as never)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              props.value === opt.key
                ? "bg-[color:color-mix(in_srgb,var(--gc-accent)_18%,transparent)] text-[var(--gc-text)]"
                : "text-[var(--gc-muted)] hover:text-[var(--gc-text)]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
