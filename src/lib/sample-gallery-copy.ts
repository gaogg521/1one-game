import { parseGameSpec } from "@/lib/game-spec";
import { normalizeAstrocadePlaySpec } from "@/lib/astrocade-play-spec";
import { prisma } from "@/lib/prisma";
import { SAMPLE_GALLERY_OWNER, sampleProjectId, sampleShareCode } from "@/lib/sample-gallery";

function slugifySampleId(input: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
  return slug || `project-${Date.now()}`;
}

export type CopyProjectToSampleGalleryArgs = {
  sourceProjectId: string;
  sampleId?: string;
  featured?: boolean;
};

export async function copyProjectToSampleGallery(args: CopyProjectToSampleGalleryArgs) {
  const source = await prisma.project.findUnique({ where: { id: args.sourceProjectId } });
  if (!source) throw new Error(`source_project_not_found:${args.sourceProjectId}`);

  const sampleId = slugifySampleId(args.sampleId || source.title || source.id);
  const targetId = sampleProjectId(sampleId);
  const spec = normalizeAstrocadePlaySpec(parseGameSpec(JSON.parse(source.specJson)));
  const shareCode = sampleShareCode(sampleId);

  const project = await prisma.project.upsert({
    where: { id: targetId },
    create: {
      id: targetId,
      ownerKey: SAMPLE_GALLERY_OWNER,
      visibility: "public",
      featured: args.featured ?? true,
      shareCode,
      title: source.title,
      prompt: source.prompt,
      specJson: JSON.stringify(spec),
      status: "ready",
      coverPath: source.coverPath,
      playCount: Math.max(source.playCount ?? 0, 1),
      likeCount: source.likeCount ?? 0,
    },
    update: {
      ownerKey: SAMPLE_GALLERY_OWNER,
      visibility: "public",
      featured: args.featured ?? true,
      title: source.title,
      prompt: source.prompt,
      specJson: JSON.stringify(spec),
      status: "ready",
      coverPath: source.coverPath,
      playCount: Math.max(source.playCount ?? 0, 1),
      likeCount: source.likeCount ?? 0,
    },
  });

  return {
    id: project.id,
    sampleId,
    title: project.title,
    playPath: `/play/${project.id}`,
  };
}
