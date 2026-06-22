"use client";

import { useTranslations } from "next-intl";
import { LiterarySwipeFeed } from "@/components/mobile/LiterarySwipeFeed";

export function NovelFeedClient() {
  const t = useTranslations("mobileFeed");

  return (
    <LiterarySwipeFeed
      kind="novel"
      activeTab="novel"
      fetchUrl="/api/novel?sort=playCount&limit=30"
      readLabel={t("readNovel")}
      emptyLabel={t("emptyNovels")}
      placeholderIcon="📖"
    />
  );
}
