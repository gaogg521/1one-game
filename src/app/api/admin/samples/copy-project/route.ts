import { NextResponse } from "next/server";
import { requireSuperAdmin, writeAdminAudit } from "@/lib/auth/admin";
import { localizedJsonError, apiErrorFromUnknown } from "@/lib/api/localized-error";
import { copyProjectToSampleGallery } from "@/lib/sample-gallery-copy";

export async function POST(req: Request) {
  const gate = await requireSuperAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  let body: {
    projectId?: unknown;
    sourceProjectId?: unknown;
    sampleId?: unknown;
    featured?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return localizedJsonError(req, "badJson", 400);
  }

  const sourceProjectId = String(body.sourceProjectId ?? body.projectId ?? "").trim();
  if (!sourceProjectId) return localizedJsonError(req, "adminMissingTypeId", 400);

  try {
    const result = await copyProjectToSampleGallery({
      sourceProjectId,
      sampleId: typeof body.sampleId === "string" ? body.sampleId : undefined,
      featured: typeof body.featured === "boolean" ? body.featured : true,
    });
    await writeAdminAudit({
      req,
      action: "sample_gallery_copy_project",
      targetType: "game",
      targetId: sourceProjectId,
      detail: result,
      actorUserId: gate.user?.id,
      actorOwnerKey: gate.ownerKey,
    });
    return NextResponse.json({ ok: true, sample: result });
  } catch (e) {
    return NextResponse.json({ error: apiErrorFromUnknown(req, e, "internal") }, { status: 500 });
  }
}
