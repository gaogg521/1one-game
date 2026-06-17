import { NextResponse } from "next/server";
import { parseGameSpec } from "@/lib/game-spec";
import { SAMPLE_GALLERY_OWNER } from "@/lib/sample-gallery";
import { ensureSampleGalleryProjects } from "@/lib/sample-gallery-seed";
import { prisma } from "@/lib/prisma";
import type { Sample } from "@/lib/samples";

function playsLabel(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(Math.max(1, count));
}

function sampleIdFromProjectId(id: string): string {
  return id.startsWith("sample-") ? id.slice("sample-".length) : id;
}

export async function GET() {
  await ensureSampleGalleryProjects();
  const rows = await prisma.project.findMany({
    where: { ownerKey: SAMPLE_GALLERY_OWNER, visibility: "public" },
    orderBy: [{ featured: "desc" }, { playCount: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      prompt: true,
      specJson: true,
      coverPath: true,
      featured: true,
      playCount: true,
      createdAt: true,
    },
  });

  const samples: Sample[] = rows.map((row) => {
    let templateId = "game";
    let subtitle = "样品馆 · 可复制借鉴";
    let background = "#111827";
    let accent = "#38bdf8";
    try {
      const spec = parseGameSpec(JSON.parse(row.specJson));
      templateId = spec.templateId;
      subtitle = spec.labels.subtitle || subtitle;
      background = spec.theme.backgroundColor;
      accent = spec.theme.collectibleColor || spec.theme.playerColor;
    } catch {
      /* corrupt samples still render as cards; play API will surface the real error */
    }
    return {
      id: sampleIdFromProjectId(row.id),
      title: row.title,
      subtitle,
      prompt: row.prompt,
      tags: [templateId, "样品", "可借鉴"],
      coverImageSrc: row.coverPath || "/samples/td-carrot.svg",
      coverAlt: `${row.title} sample cover`,
      coverGradient: `linear-gradient(145deg, ${background} 0%, ${accent} 58%, #f8fafc 100%)`,
      accentGlow: `${accent}66`,
      emoji: "🎮",
      plays: playsLabel(row.playCount),
      creator: "sample-gallery",
      shelf: row.featured ? "featured" : "trending",
      badge: row.createdAt.getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000 ? "new" : undefined,
      photoCover: Boolean(row.coverPath),
    };
  });

  return NextResponse.json({ samples });
}
