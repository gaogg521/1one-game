import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return {
    title: t("createTitle"),
  };
}

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
