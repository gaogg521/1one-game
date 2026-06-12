import { NextResponse } from "next/server";
import { ensureSampleGalleryProjects } from "@/lib/sample-gallery-seed";
import { apiErrorFromUnknown } from "@/lib/api/localized-error";

export async function POST(req: Request) {
  try {
    const result = await ensureSampleGalleryProjects();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: apiErrorFromUnknown(req, e, "internal") }, { status: 500 });
  }
}
