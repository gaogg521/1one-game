import { NextResponse } from "next/server";
import { requireSuperAdmin, writeAdminAudit } from "@/lib/auth/admin";
import { getEmailConfigPublicView, saveEmailConfig, type EmailConfigPatch } from "@/lib/email-config";

export async function GET(req: Request) {
  const gate = await requireSuperAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const config = await getEmailConfigPublicView();
  return NextResponse.json(config);
}

export async function PATCH(req: Request) {
  const gate = await requireSuperAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  let body: EmailConfigPatch;
  try {
    body = (await req.json()) as EmailConfigPatch;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const config = await saveEmailConfig(body, gate.user?.id ?? null);

  await writeAdminAudit({
    req,
    action: "email_config_update",
    targetType: "platform_email_config",
    targetId: "default",
    detail: {
      provider: body.provider,
      from: body.from,
      smtpHost: body.smtpHost,
      fields: Object.keys(body).filter((k) => body[k as keyof EmailConfigPatch] !== undefined),
    },
    actorUserId: gate.user?.id,
    actorOwnerKey: gate.ownerKey,
  });

  return NextResponse.json(config);
}
