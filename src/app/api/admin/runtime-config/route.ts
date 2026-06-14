import { NextResponse } from "next/server";
import { canManageRuntimeConfig, requireSuperAdmin, writeAdminAudit } from "@/lib/auth/admin";
import { getRuntimeConfigPublicView, saveRuntimeConfig, type RuntimeConfigPatch } from "@/lib/runtime-config";

export async function GET(req: Request) {
  const gate = await requireSuperAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const config = await getRuntimeConfigPublicView();
  return NextResponse.json({
    ...config,
    canManage: canManageRuntimeConfig(gate.user, gate.viaLegacy),
  });
}

export async function PATCH(req: Request) {
  const gate = await requireSuperAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  let body: RuntimeConfigPatch;
  try {
    body = (await req.json()) as RuntimeConfigPatch;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const config = await saveRuntimeConfig(body, gate.user?.id ?? null);

  await writeAdminAudit({
    req,
    action: "runtime_config_update",
    targetType: "platform_runtime_config",
    targetId: "default",
    detail: {
      secretFields: body.secrets ? Object.keys(body.secrets) : [],
      modelFields: body.models ? Object.keys(body.models) : [],
      providerCount: body.providers?.length,
      routeCount: body.routes?.length,
    },
    actorUserId: gate.user?.id,
    actorOwnerKey: gate.ownerKey,
  });

  return NextResponse.json(config);
}
