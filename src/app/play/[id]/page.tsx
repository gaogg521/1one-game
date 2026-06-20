import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PlayGameClient } from "@/app/play/[id]/PlayGameClient";
import { prisma } from "@/lib/prisma";

export async function generateMetadata(props: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await props.params;
  const t = await getTranslations("metadata");
  try {
    const row = await prisma.project.findUnique({
      where: { id },
      select: { title: true, prompt: true, coverPath: true },
    });
    if (!row) {
      return { title: t("workMissing") };
    }
    const description = row.prompt.length > 160 ? `${row.prompt.slice(0, 157)}…` : row.prompt;
    const images = row.coverPath ? [{ url: row.coverPath, width: 1024, height: 1024, alt: row.title }] : [];
    return {
      title: row.title,
      description,
      openGraph: {
        title: row.title,
        description,
        type: "website",
        ...(images.length ? { images } : {}),
      },
      twitter: {
        card: images.length ? "summary_large_image" : "summary",
        title: row.title,
        description,
        ...(images.length ? { images: [images[0].url] } : {}),
      },
    };
  } catch {
    return { title: t("playTitle") };
  }
}

export default async function PlayPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <PlayGameClient id={id} />;
}
