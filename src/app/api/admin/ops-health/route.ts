import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { buildAdminOpsHealthReport } from "@/lib/admin-ops-health";
import { apiErrorFromUnknown } from "@/lib/api/localized-error";

export async function GET(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const report = await buildAdminOpsHealthReport();
    return NextResponse.json(report);
  } catch (e) {
    return NextResponse.json({ error: apiErrorFromUnknown(req, e, "internal") }, { status: 500 });
  }
}
