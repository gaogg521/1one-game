import { NextResponse } from "next/server";
import { requireAdmin, requireSuperAdmin, writeAdminAudit } from "@/lib/auth/admin";
import { buildAdminSampleGalleryReport } from "@/lib/admin-sample-gallery";
import {
  patchSampleGalleryProjects,
  removeFromSampleGallery,
  type SampleGalleryPatch,
} from "@/lib/admin/sample-gallery-ops";
import { localizedJsonError, apiErrorFromUnknown } from "@/lib/api/localized-error";
import { ensureSampleGalleryProjects } from "@/lib/sample-gallery-seed";

function collectProjectIds(body: { projectId?: unknown; projectIds?: unknown }): string[] {
  if (Array.isArray(body.projectIds)) {
    return body.projectIds.map((id) => String(id).trim()).filter(Boolean);
  }
  const one = String(body.projectId ?? "").trim();
  return one ? [one] : [];
}

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

  let body: { projectId?: unknown; projectIds?: unknown; featured?: unknown; visibility?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return localizedJsonError(req, "badJson", 400);
  }

  const data: SampleGalleryPatch = {};
  if (typeof body.featured === "boolean") data.featured = body.featured;
  if (body.visibility === "public" || body.visibility === "hidden") data.visibility = body.visibility;
  if (!Object.keys(data).length) return localizedJsonError(req, "adminNoValidFields", 400);

  const ids = collectProjectIds(body);
  if (!ids.length) return localizedJsonError(req, "adminMissingTypeId", 400);

  try {
    const { updated, missing } = await patchSampleGalleryProjects(ids, data);
    if (!updated.length) {
      return localizedJsonError(req, "adminUnknownWorkType", 400, { params: { type: "sample" } });
    }
    const action = updated.length > 1 ? "work_moderate_batch" : "work_moderate";
    for (const projectId of updated) {
      await writeAdminAudit({
        req,
        action,
        targetType: "game",
        targetId: projectId,
        detail: data,
        actorUserId: gate.user?.id,
        actorOwnerKey: gate.ownerKey,
      });
    }
    return NextResponse.json({ ok: true, count: updated.length, missing: missing.length });
  } catch (e) {
    return NextResponse.json({ error: apiErrorFromUnknown(req, e, "internal") }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  let body: { projectId?: unknown; projectIds?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return localizedJsonError(req, "badJson", 400);
  }

  const ids = collectProjectIds(body);
  if (!ids.length) return localizedJsonError(req, "adminMissingTypeId", 400);

  try {
    const result = await removeFromSampleGallery(ids);
    const handled = result.unlisted.length + result.deleted.length;
    if (!handled) {
      return localizedJsonError(req, "adminUnknownWorkType", 400, { params: { type: "sample" } });
    }
    for (const projectId of result.unlisted) {
      await writeAdminAudit({
        req,
        action: "sample_gallery_unlist",
        targetType: "game",
        targetId: projectId,
        detail: { visibility: "hidden", featured: false },
        actorUserId: gate.user?.id,
        actorOwnerKey: gate.ownerKey,
      });
    }
    for (const projectId of result.deleted) {
      await writeAdminAudit({
        req,
        action: "sample_gallery_remove",
        targetType: "game",
        targetId: projectId,
        detail: { deleted: true },
        actorUserId: gate.user?.id,
        actorOwnerKey: gate.ownerKey,
      });
    }
    return NextResponse.json({
      ok: true,
      unlisted: result.unlisted.length,
      deleted: result.deleted.length,
      missing: result.missing.length,
    });
  } catch (e) {
    return NextResponse.json({ error: apiErrorFromUnknown(req, e, "internal") }, { status: 500 });
  }
}
