import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function main() {
  const novels = await prisma.novel.findMany({
    select: { id: true, title: true, coverPath: true },
    orderBy: { createdAt: "desc" },
  });

  let missing = 0;
  for (const n of novels) {
    const cp = n.coverPath?.trim() || null;
    let fileExists = false;
    if (cp?.startsWith("/covers/")) {
      fileExists = fs.existsSync(path.join(process.cwd(), "public", cp.replace(/^\//, "")));
    }
    if (cp && !fileExists) missing++;
    console.log(JSON.stringify({ id: n.id, title: n.title?.slice(0, 24), coverPath: cp, fileExists }));
  }
  console.log(`\nTotal: ${novels.length}, missing files: ${missing}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
