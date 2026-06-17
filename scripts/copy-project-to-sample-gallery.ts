import { prisma } from "@/lib/prisma";
import { copyProjectToSampleGalleryWithAssets } from "@/lib/sample-gallery-copy-assets";

async function main() {
  const sourceProjectId = process.argv[2] ?? process.env.SOURCE_PROJECT_ID;
  const sampleId = process.argv[3] ?? process.env.SAMPLE_ID;
  if (!sourceProjectId) {
    throw new Error("Usage: npm run sample:copy-project -- <projectId> [sampleId]");
  }
  const result = await copyProjectToSampleGalleryWithAssets({
    sourceProjectId,
    sampleId,
    featured: process.env.SAMPLE_FEATURED !== "0",
  });
  console.log("copy-project-to-sample-gallery: ok", result);
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
