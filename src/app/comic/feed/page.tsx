import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ComicFeedClient } from "./ComicFeedClient";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("mobileFeed");
  return {
    title: t("comicFeedTitle"),
    description: t("comicFeedDesc"),
  };
}

export default function ComicFeedPage() {
  return <ComicFeedClient />;
}
