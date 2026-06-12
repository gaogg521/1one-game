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
      select: { title: true, prompt: true },
    });
    if (!row) {
      return { title: t("workMissing") };
    }
    const description = row.prompt.length > 160 ? `${row.prompt.slice(0, 157)}…` : row.prompt;
    return {
      title: row.title,
      description,
      openGraph: {
        title: row.title,
        description,
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
