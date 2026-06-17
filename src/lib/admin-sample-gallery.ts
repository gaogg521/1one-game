import { prisma } from "@/lib/prisma";
import { SAMPLE_GALLERY_OWNER, sampleProjectId } from "@/lib/sample-gallery";
import { SAMPLES } from "@/lib/samples";

export type AdminSampleRow = {
  sampleId: string;
  projectId: string;
  title: string;
  catalogTitle: string;
  subtitle: string;
  coverImageSrc: string;
  coverPath: string | null;
  hasCover: boolean;
  inCatalog: boolean;
  inDb: boolean;
  synced: boolean;
  featured: boolean;
  shelf: "featured" | "trending";
  playCount: number;
  status: string | null;
  visibility: string | null;
  playPath: string;
  photoCover: boolean;
};

export type AdminSampleGalleryReport = {
  catalogCount: number;
  dbCount: number;
  syncedCount: number;
  missingInDb: string[];
  orphanInDb: string[];
  items: AdminSampleRow[];
};

export async function buildAdminSampleGalleryReport(): Promise<AdminSampleGalleryReport> {
  const dbRows = await prisma.project.findMany({
    where: { ownerKey: SAMPLE_GALLERY_OWNER },
    select: {
      id: true,
      title: true,
      coverPath: true,
      featured: true,
      playCount: true,
      status: true,
      visibility: true,
    },
  });
  const dbMap = new Map(dbRows.map((r) => [r.id, r]));

  const items: AdminSampleRow[] = [];
  const missingInDb: string[] = [];

  for (const s of SAMPLES) {
    const projectId = sampleProjectId(s.id);
    const db = dbMap.get(projectId);
    if (!db) missingInDb.push(s.id);

    const featured = db?.featured ?? s.shelf === "featured";
    items.push({
      sampleId: s.id,
      projectId,
      title: db?.title ?? s.title,
      catalogTitle: s.title,
      subtitle: s.subtitle,
      coverImageSrc: s.coverImageSrc,
      coverPath: db?.coverPath ?? null,
      hasCover: Boolean(db?.coverPath ?? (s.photoCover && s.coverImageSrc.startsWith("/"))),
      inCatalog: true,
      inDb: Boolean(db),
      synced: Boolean(db && db.status === "ready" && db.visibility === "public"),
      featured,
      shelf: featured ? "featured" : "trending",
      playCount: db?.playCount ?? 0,
      status: db?.status ?? null,
      visibility: db?.visibility ?? null,
      playPath: `/play/${projectId}`,
      photoCover: s.photoCover ?? false,
    });
  }

  const catalogIds = new Set(SAMPLES.map((s) => sampleProjectId(s.id)));
  const orphanInDb = dbRows.filter((r) => !catalogIds.has(r.id)).map((r) => r.id);

  return {
    catalogCount: SAMPLES.length,
    dbCount: dbRows.length,
    syncedCount: items.filter((i) => i.synced).length,
    missingInDb,
    orphanInDb,
    items,
  };
}
