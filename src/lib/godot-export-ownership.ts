import { prisma } from "@/lib/prisma";

/**
 * Godot builds write cache/assets under a legacy project id, so public reads
 * are not sufficient authorization. Exports must always be bound to the
 * project owner that initiated the work.
 */
export async function findOwnedGodotExportProject(ownerKey: string, projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, ownerKey: true },
  });
  return project?.ownerKey === ownerKey ? project : null;
}
