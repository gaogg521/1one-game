import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { mockSpecFromPrompt } from "@/lib/mock-spec";
import { SAMPLE_GALLERY_OWNER, sampleProjectId } from "@/lib/sample-gallery";
import { copyProjectToSampleGalleryWithAssets } from "@/lib/sample-gallery-copy-assets";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

async function main() {
  const sourceId = `qa-copy-source-${Date.now()}`;
  const sampleId = `qa-copy-${Date.now()}`;
  const targetProjectId = sampleProjectId(sampleId);
  const prompt = "做一个色彩鲜明的 2048 数字合成小游戏，用于测试复制到样品馆";
  const spec = mockSpecFromPrompt(prompt, { title: "QA Copy 2048" });

  try {
    await prisma.project.create({
      data: {
        id: sourceId,
        ownerKey: "qa-copy-owner",
        visibility: "public",
        featured: false,
        title: "QA Copy Source",
        prompt,
        specJson: JSON.stringify(spec),
        status: "ready",
      },
    });

    const result = await copyProjectToSampleGalleryWithAssets({
      sourceProjectId: sourceId,
      sampleId,
      featured: true,
    });

    assert(result.id === targetProjectId, "copied project should use sample-* id");
    const copied = await prisma.project.findUnique({ where: { id: targetProjectId } });
    assert(copied, "copied sample project should exist");
    assert(copied!.ownerKey === SAMPLE_GALLERY_OWNER, "copied sample should use sample gallery owner");
    assert(copied!.visibility === "public", "copied sample should be public");
    assert(copied!.featured === true, "copied sample should preserve requested featured flag");
    assert(copied!.prompt === prompt, "copied sample should preserve prompt");

    const sprite = path.join(process.cwd(), "public", "game-sprites", targetProjectId, "player.png");
    const bg = path.join(process.cwd(), "public", "game-bg", `${targetProjectId}.png`);
    assert(fs.existsSync(sprite), "copied sample should have player sprite");
    assert(fs.existsSync(bg), "copied sample should have background");

    console.log("qa-sample-gallery-copy: ok");
  } finally {
    await prisma.project.deleteMany({ where: { id: { in: [sourceId, targetProjectId] } } });
    fs.rmSync(path.join(process.cwd(), "public", "game-sprites", targetProjectId), { recursive: true, force: true });
    fs.rmSync(path.join(process.cwd(), "public", "game-bg", `${targetProjectId}.png`), { force: true });
  }
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
