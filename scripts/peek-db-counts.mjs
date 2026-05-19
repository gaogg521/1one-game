import { PrismaClient } from "@prisma/client";

async function counts(url) {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const [projects, novels, comics] = await Promise.all([
      prisma.project.count(),
      prisma.novel.count(),
      prisma.comic.count(),
    ]);
    console.log(url, { projects, novels, comics });
  } finally {
    await prisma.$disconnect();
  }
}

const urls = ["file:./dev.db", "file:./prisma/dev.db", "file:./prisma/ci.sqlite", "file:./ci.sqlite"];
for (const u of urls) {
  try {
    await counts(u);
  } catch (e) {
    console.log(u, "ERR", e.message?.slice(0, 80));
  }
}
