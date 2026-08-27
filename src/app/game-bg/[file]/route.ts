import { runtimePublicAssetResponse } from "@/lib/runtime-public-asset";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ file: string }> }) {
  const { file } = await context.params;
  return runtimePublicAssetResponse({ directory: "game-bg", parts: [file] });
}

export const HEAD = GET;
