import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL ?? "file:./dev.db";
const prisma = new PrismaClient({ datasources: { db: { url } } });

try {
  const novels = await prisma.novel.findMany({ take: 3, select: { id: true, title: true } });
  const projects = await prisma.project.findMany({ take: 3, select: { id: true, title: true } });
  console.log("DATABASE_URL", url);
  console.log("novels sample", novels);
  console.log("projects sample", projects);
} catch (e) {
  console.error("QUERY FAILED", e.message);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
