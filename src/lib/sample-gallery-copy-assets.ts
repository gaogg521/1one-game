import { prisma } from "@/lib/prisma";
import { parseGameSpec } from "@/lib/game-spec";
import { writeSampleProceduralAssets } from "@/lib/procedural-game-assets";
import { copyProjectToSampleGallery, type CopyProjectToSampleGalleryArgs } from "@/lib/sample-gallery-copy";

/** CLI/QA 专用：复制样品并写入本地 public 资产；不要从 App Route 导入，避免构建追踪 public 动态路径。 */
export async function copyProjectToSampleGalleryWithAssets(args: CopyProjectToSampleGalleryArgs) {
  const result = await copyProjectToSampleGallery(args);
  const row = await prisma.project.findUnique({ where: { id: result.id }, select: { specJson: true } });
  if (row?.specJson) {
    await writeSampleProceduralAssets(result.id, parseGameSpec(JSON.parse(row.specJson)), { rich: true });
  }
  return result;
}
