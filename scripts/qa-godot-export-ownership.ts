import { mockSpecFromPrompt } from "../src/lib/mock-spec";
import { findOwnedGodotExportProject } from "../src/lib/godot-export-ownership";
import { prisma } from "../src/lib/prisma";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  const id = `qa-godot-owner-${Date.now()}`;
  const ownerKey = `qa-godot-owner-${Date.now()}`;
  try {
    await prisma.project.create({
      data: {
        id,
        ownerKey,
        visibility: "private",
        featured: false,
        title: "Godot ownership QA",
        prompt: "owner-bound Godot export",
        specJson: JSON.stringify(mockSpecFromPrompt("躲避陨石")),
        status: "ready",
      },
    });
    const allowed = await findOwnedGodotExportProject(ownerKey, id);
    assert(allowed?.id === id, "owner must be allowed to export their saved project");
    const denied = await findOwnedGodotExportProject("different-owner", id);
    assert(denied === null, "another owner must not export a project they do not own");
    const missing = await findOwnedGodotExportProject(ownerKey, `${id}-missing`);
    assert(missing === null, "missing project must not be exportable");
    console.log("[OK] qa-godot-export-ownership");
  } finally {
    await prisma.project.deleteMany({ where: { id } });
    await prisma.$disconnect();
  }
}

void main();
