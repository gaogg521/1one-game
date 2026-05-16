import { config } from "dotenv";
import { resolve } from "path";
import { createRequire } from "module";

config({ path: resolve(process.cwd(), ".env") });
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const novelId = process.argv[2] || "cmp7w7381000auz81yisafq0h";
const row = await prisma.novel.findUnique({
  where: { id: novelId },
  include: { comics: { select: { id: true, title: true, status: true, ownerKey: true } } },
});
console.log(JSON.stringify(row, null, 2));
await prisma.$disconnect();
