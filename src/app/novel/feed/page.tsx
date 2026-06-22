import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NovelFeedClient } from "./NovelFeedClient";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("mobileFeed");
  return {
    title: t("novelFeedTitle"),
    description: t("novelFeedDesc"),
  };
}

export default function NovelFeedPage() {
  return <NovelFeedClient />;
}
