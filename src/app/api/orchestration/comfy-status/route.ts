import { NextResponse } from "next/server";
import { getComfyBaseUrl, probeComfyHealthDetailed } from "@/lib/orchestration/comfy-gateway";

/** GET：探测 Comfy 是否可达（不写队列、不落库）。 */
export async function GET() {
  const baseUrlConfigured = Boolean(getComfyBaseUrl());
  if (!baseUrlConfigured) {
    return NextResponse.json({
      baseUrlConfigured: false,
      reachable: false,
      probeMs: 0,
      timedOut: false,
    });
  }
  const d = await probeComfyHealthDetailed();
  return NextResponse.json({
    baseUrlConfigured,
    reachable: d.reachable,
    probeMs: d.probeMs,
    timedOut: d.timedOut,
  });
}
