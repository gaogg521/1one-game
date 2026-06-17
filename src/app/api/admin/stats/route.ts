import { NextResponse } from "next/server";
import { requireAdmin, canManageRuntimeConfig, canPromoteSuperAdmin } from "@/lib/auth/admin";
import { SAMPLE_GALLERY_OWNER } from "@/lib/sample-gallery";
import { SAMPLES } from "@/lib/samples";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const [
    users,
    projects,
    novels,
    comics,
    shares24h,
    pendingG,
    pendingN,
    pendingC,
    hiddenG,
    hiddenN,
    hiddenC,
    sampleGalleryDb,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.project.count(),
    prisma.novel.count(),
    prisma.comic.count(),
    prisma.shareEvent.count({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
    prisma.project.count({ where: { visibility: "pending_review" } }),
    prisma.novel.count({ where: { visibility: "pending_review" } }),
    prisma.comic.count({ where: { visibility: "pending_review" } }),
    prisma.project.count({ where: { visibility: "hidden" } }),
    prisma.novel.count({ where: { visibility: "hidden" } }),
    prisma.comic.count({ where: { visibility: "hidden" } }),
    prisma.project.count({
      where: { ownerKey: SAMPLE_GALLERY_OWNER, visibility: "public", status: "ready" },
    }),
  ]);
  const pendingReview = pendingG + pendingN + pendingC;
  const hidden = hiddenG + hiddenN + hiddenC;

  return NextResponse.json({
    users,
    works: { game: projects, novel: novels, comic: comics },
    shares24h,
    moderation: { pendingReview, hidden },
    sampleGallery: { catalog: SAMPLES.length, synced: sampleGalleryDb },
    viaLegacySuperAdmin: gate.viaLegacy,
    canManageRuntimeConfig: canManageRuntimeConfig(gate.user, gate.viaLegacy),
    canPromoteSuperAdmin: canPromoteSuperAdmin(gate.user),
    actorRole: gate.user?.role ?? (gate.viaLegacy ? "super_admin" : null),
  });
}
