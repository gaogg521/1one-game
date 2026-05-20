import { prisma } from "@/lib/prisma";
import { isPrismaUniqueViolation } from "@/lib/prisma-errors";
import { newShareCode } from "@/lib/share-code";

type CreateArgs = {
  ownerKey: string;
  title: string;
  prompt: string;
  specJson: string;
  status?: string;
  creativeBriefJson?: string | null;
};

/** 创建作品并分配唯一 shareCode；极低概率碰撞时自动重试。 */
export async function createProjectRecord(args: CreateArgs) {
  const status = args.status ?? "ready";
  for (let attempt = 0; attempt < 14; attempt += 1) {
    try {
      return await prisma.project.create({
        data: {
          ownerKey: args.ownerKey,
          title: args.title,
          prompt: args.prompt,
          specJson: args.specJson,
          creativeBriefJson: args.creativeBriefJson ?? null,
          status,
          shareCode: newShareCode(),
        },
      });
    } catch (e) {
      if (isPrismaUniqueViolation(e)) continue;
      throw e;
    }
  }
  throw new Error("无法分配短链，请重试");
}
