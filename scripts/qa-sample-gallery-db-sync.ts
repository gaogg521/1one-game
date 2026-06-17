import { prisma } from "@/lib/prisma";
import { ensureSampleGalleryProjects } from "@/lib/sample-gallery-seed";
import { SAMPLES } from "@/lib/samples";
import { sampleProjectId } from "@/lib/sample-gallery";
import type { GameSpec } from "@/lib/game-spec";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

async function main() {
  await ensureSampleGalleryProjects();

  const ids = SAMPLES.map((s) => sampleProjectId(s.id));
  const rows = await prisma.project.findMany({
    where: { id: { in: ids } },
    select: { id: true, title: true, prompt: true, specJson: true, visibility: true },
  });
  assert(rows.length === SAMPLES.length, `DB should contain all samples: ${rows.length}/${SAMPLES.length}`);

  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const sample of SAMPLES) {
    const row = byId.get(sampleProjectId(sample.id));
    assert(row, `missing DB sample ${sample.id}`);
    assert(row!.visibility === "public", `${sample.id} should be public`);
    assert(row!.title === sample.title, `${sample.id} title should sync from code`);
    assert(row!.prompt === sample.prompt, `${sample.id} prompt should sync from code`);
  }

  const merge2048 = byId.get(sampleProjectId("number-merge-2048"));
  assert(merge2048, "number-merge-2048 should be in DB");
  const mergeSpec = JSON.parse(merge2048!.specJson) as GameSpec;
  assert(mergeSpec.puzzle?.mode === "merge2048", "2048 DB spec should use merge2048");

  const go = byId.get(sampleProjectId("zen-go-board"));
  assert(go, "zen-go-board should be in DB");
  const goSpec = JSON.parse(go!.specJson) as GameSpec;
  assert(goSpec.chess?.ruleset === "go", "Go DB spec should use go ruleset");

  const jungle = byId.get(sampleProjectId("jungle-animal-chess"));
  assert(jungle, "jungle-animal-chess should be in DB");
  const jungleSpec = JSON.parse(jungle!.specJson) as GameSpec;
  assert(jungleSpec.chess?.ruleset === "jungle", "Jungle DB spec should use jungle ruleset");

  console.log(`qa-sample-gallery-db-sync: ok (${rows.length}/${SAMPLES.length})`);
  try {
    const { writeQaSnapshot } = await import("../src/lib/qa-cache");
    writeQaSnapshot("sampleDb", {
      script: "qa:sample-gallery-db-sync",
      ok: true,
      passed: rows.length,
      total: SAMPLES.length,
      ts: new Date().toISOString(),
    });
  } catch {
    /* optional */
  }
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
