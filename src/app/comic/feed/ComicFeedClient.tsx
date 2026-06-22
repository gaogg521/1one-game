"use client";

import { useTranslations } from "next-intl";
import { LiterarySwipeFeed } from "@/components/mobile/LiterarySwipeFeed";

export function ComicFeedClient() {
  const t = useTranslations("mobileFeed");

  return (
    <LiterarySwipeFeed
      kind="comic"
      activeTab="comic"
      fetchUrl="/api/comic?sort=likeCount&limit=30"
      readLabel={t("readComic")}
      emptyLabel={t("emptyComics")}
      placeholderIcon="🎨"
    />
  );
}
