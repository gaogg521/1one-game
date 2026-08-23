import fs from "node:fs/promises";
import { repoPublicPath } from "@/lib/public-path";

function isSafeProjectId(projectId: string): boolean {
  return /^[A-Za-z0-9_-]{1,128}$/.test(projectId);
}

/** Removes only assets rooted at a validated project id. */
export async function deleteGameAssetFiles(projectId: string): Promise<void> {
  if (!isSafeProjectId(projectId)) return;
  await Promise.all([
    fs.rm(repoPublicPath("game-sprites", projectId), { recursive: true, force: true }),
    fs.rm(repoPublicPath("game-bg", `${projectId}.png`), { force: true }),
  ]);
}
