import { deleteAdminWork } from "@/lib/admin/delete-work";
import { prisma } from "@/lib/prisma";
import { SAMPLE_GALLERY_OWNER, sampleProjectId } from "@/lib/sample-gallery";
import { SAMPLES } from "@/lib/samples";

export function catalogSampleProjectIds(): Set<string> {
  return new Set(SAMPLES.map((s) => sampleProjectId(s.id)));
}

export type SampleGalleryPatch = {
  featured?: boolean;
  visibility?: "public" | "hidden";
};

export async function patchSampleGalleryProjects(
  ids: string[],
  data: SampleGalleryPatch,
): Promise<{ updated: string[]; missing: string[] }> {
  const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (!uniqueIds.length) return { updated: [], missing: [] };

  const rows = await prisma.project.findMany({
    where: { id: { in: uniqueIds }, ownerKey: SAMPLE_GALLERY_OWNER },
    select: { id: true },
  });
  const found = new Set(rows.map((row) => row.id));
  const missing = uniqueIds.filter((id) => !found.has(id));
  const updated = uniqueIds.filter((id) => found.has(id));
  if (!updated.length) return { updated, missing };

  const payload: { featured?: boolean; visibility?: string } = {};
  if (typeof data.featured === "boolean") payload.featured = data.featured;
  if (data.visibility === "public" || data.visibility === "hidden") payload.visibility = data.visibility;
  if (!Object.keys(payload).length) return { updated: [], missing };

  await prisma.project.updateMany({
    where: { id: { in: updated }, ownerKey: SAMPLE_GALLERY_OWNER },
    data: payload,
  });
  return { updated, missing };
}

export type RemoveSampleGalleryResult = {
  unlisted: string[];
  deleted: string[];
  missing: string[];
};

/** Catalog samples are hidden (seed would recreate a delete). Copied orphans are deleted. */
export async function removeFromSampleGallery(ids: string[]): Promise<RemoveSampleGalleryResult> {
  const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  const catalog = catalogSampleProjectIds();
  const result: RemoveSampleGalleryResult = { unlisted: [], deleted: [], missing: [] };

  for (const id of uniqueIds) {
    const row = await prisma.project.findFirst({
      where: { id, ownerKey: SAMPLE_GALLERY_OWNER },
      select: { id: true },
    });
    if (!row) {
      result.missing.push(id);
      continue;
    }
    if (catalog.has(id)) {
      await prisma.project.update({
        where: { id },
        data: { visibility: "hidden", featured: false },
      });
      result.unlisted.push(id);
      continue;
    }
    const ok = await deleteAdminWork("game", id);
    if (ok) result.deleted.push(id);
    else result.missing.push(id);
  }

  return result;
}
