import { buildCanonicalAstrocadeSpec } from "@/lib/astrocade-canonical-spec";
import { prisma } from "@/lib/prisma";
import { PRUNED_SAMPLE_IDS, SAMPLES } from "@/lib/samples";
import {
  SAMPLE_GALLERY_OWNER,
  parseSamplePlaysLabel,
  sampleProjectId,
  sampleShareCode,
} from "@/lib/sample-gallery";

export async function seedSampleGalleryProjects(): Promise<{ upserted: number; ids: string[] }> {
  const ids: string[] = [];

  for (const s of SAMPLES) {
    const id = sampleProjectId(s.id);
    ids.push(id);
    const spec = buildCanonicalAstrocadeSpec(s.prompt, "zh-Hans", { sampleId: s.id });
    spec.title = s.title;

    await prisma.project.upsert({
      where: { id },
      create: {
        id,
        ownerKey: SAMPLE_GALLERY_OWNER,
        visibility: "public",
        featured: s.shelf === "featured",
        shareCode: sampleShareCode(s.id),
        title: s.title,
        prompt: s.prompt,
        specJson: JSON.stringify(spec),
        status: "ready",
        coverPath: s.coverImageSrc.startsWith("/") ? s.coverImageSrc : null,
        playCount: parseSamplePlaysLabel(s.plays),
        likeCount: 0,
      },
      update: {
        visibility: "public",
        featured: s.shelf === "featured",
        title: s.title,
        prompt: s.prompt,
        specJson: JSON.stringify(spec),
        status: "ready",
        coverPath: s.coverImageSrc.startsWith("/") ? s.coverImageSrc : null,
        playCount: parseSamplePlaysLabel(s.plays),
      },
    });
  }

  for (const prunedId of PRUNED_SAMPLE_IDS) {
    await prisma.project.deleteMany({ where: { id: sampleProjectId(prunedId) } });
  }

  return { upserted: ids.length, ids };
}

export async function ensureSampleGalleryProjects(): Promise<{ ok: true; ids: string[] }> {
  const result = await seedSampleGalleryProjects();
  return { ok: true, ids: result.ids };
}
