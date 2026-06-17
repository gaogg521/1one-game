import { NextResponse } from "next/server";
import { requireAdmin, requireSuperAdmin, writeAdminAudit } from "@/lib/auth/admin";
import { buildAdminSampleGalleryReport } from "@/lib/admin-sample-gallery";
import { localizedJsonError, apiErrorFromUnknown } from "@/lib/api/localized-error";
import { ensureSampleGalleryProjects } from "@/lib/sample-gallery-seed";

export async function GET(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const report = await buildAdminSampleGalleryReport();
    return NextResponse.json(report);
  } catch (e) {
    return NextResponse.json({ error: apiErrorFromUnknown(req, e, "internal") }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const gate = await requireSuperAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const result = await ensureSampleGalleryProjects();
    const report = await buildAdminSampleGalleryReport();
    await writeAdminAudit({
      req,
      action: "sample_gallery_sync",
      targetType: "sample_gallery",
      targetId: "catalog",
      detail: { upserted: result.ids.length, syncedCount: report.syncedCount },
      actorUserId: gate.user?.id,
      actorOwnerKey: gate.ownerKey,
    });
    return NextResponse.json({ ...result, report });
  } catch (e) {
    return NextResponse.json({ error: apiErrorFromUnknown(req, e, "internal") }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  let body: { projectId?: unknown; projectIds?: unknown; featured?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return localizedJsonError(req, "badJson", 400);
  }

  if (typeof body.featured !== "boolean") return localizedJsonError(req, "adminNoValidFields", 400);

  const ids = Array.isArray(body.projectIds)
    ? body.projectIds.map((id) => String(id).trim()).filter(Boolean)
    : [String(body.projectId ?? "").trim()].filter(Boolean);
  if (!ids.length) return localizedJsonError(req, "adminMissingTypeId", 400);

  try {
    const { prisma } = await import("@/lib/prisma");
    const { SAMPLE_GALLERY_OWNER } = await import("@/lib/sample-gallery");

    for (const projectId of ids) {
      const row = await prisma.project.findFirst({
        where: { id: projectId, ownerKey: SAMPLE_GALLERY_OWNER },
      });
      if (!row) return localizedJsonError(req, "adminUnknownWorkType", 400, { params: { type: "sample" } });

      await prisma.project.update({
        where: { id: projectId },
        data: { featured: body.featured },
      });
      await writeAdminAudit({
        req,
        action: ids.length > 1 ? "work_moderate_batch" : "work_moderate",
        targetType: "game",
        targetId: projectId,
        detail: { featured: body.featured },
        actorUserId: gate.user?.id,
        actorOwnerKey: gate.ownerKey,
      });
    }
    return NextResponse.json({ ok: true, count: ids.length });
  } catch (e) {
    return NextResponse.json({ error: apiErrorFromUnknown(req, e, "internal") }, { status: 500 });
  }
}
