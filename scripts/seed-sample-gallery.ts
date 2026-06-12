/**
 * Upsert public sample-gallery game projects (idempotent).
 * DATABASE_URL must match the running server.
 */
import { seedSampleGalleryProjects } from "@/lib/sample-gallery-seed";

async function main(): Promise<void> {
  const result = await seedSampleGalleryProjects();
  console.log("seed-sample-gallery: ok", result.ids.length, "projects");
}

main()
  .catch((e) => {
    console.error("[FAIL]", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$disconnect();
  });
