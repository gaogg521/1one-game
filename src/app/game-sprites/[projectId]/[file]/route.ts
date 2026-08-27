import { runtimePublicAssetResponse } from "@/lib/runtime-public-asset";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ projectId: string; file: string }> }) {
  const { projectId, file } = await context.params;
  return runtimePublicAssetResponse({ directory: "game-sprites", parts: [projectId, file] });
}

export const HEAD = GET;
