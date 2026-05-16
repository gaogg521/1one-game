import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
try {
  const cols = await prisma.$queryRaw`PRAGMA table_info(Comic)`;
  console.log("Comic columns:", cols);
  const comics = await prisma.comic.findMany({ take: 1 });
  console.log("findMany ok, count sample:", comics.length);
} catch (e) {
  console.error("Error:", e.message);
}
await prisma.$disconnect();
