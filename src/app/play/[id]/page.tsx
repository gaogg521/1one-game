import type { Metadata } from "next";
import { PlayGameClient } from "@/app/play/[id]/PlayGameClient";
import { prisma } from "@/lib/prisma";

export async function generateMetadata(props: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await props.params;
  try {
    const row = await prisma.project.findUnique({
      where: { id },
      select: { title: true, prompt: true },
    });
    if (!row) {
      return { title: "作品不存在" };
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
    return { title: "试玩" };
  }
}

export default async function PlayPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <PlayGameClient id={id} />;
}
