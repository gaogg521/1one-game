import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return {
    title: t("studioTitle"),
  };
}

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
