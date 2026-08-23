import type { Comic } from "@prisma/client";
import { parseComicDocument } from "@/lib/comic-panel-render";
import {
  createCreativeArtifact,
  createCreativeRevision,
  ensureLegacyCreativeProject,
  finalizeCreativeRevision,
} from "@/lib/creator-core/repository";

export type ComicCoreMirror = { creativeProjectId: string; creativeRevisionId: string };

/** Keeps every editable storyboard, style lock and rendered panel in one immutable Core revision. */
export async function mirrorComicToCreatorCore(input: {
  comic: Pick<Comic, "id" | "ownerKey" | "title" | "prompt" | "imageUrls" | "status" | "novelId">;
  cause?: "generate" | "refine" | "import";
}): Promise<ComicCoreMirror> {
  const project = await ensureLegacyCreativeProject({
    ownerKey: input.comic.ownerKey,
    kind: "comic",
    title: input.comic.title,
    legacyType: "comic",
    legacyId: input.comic.id,
  });
  const doc = parseComicDocument(input.comic.imageUrls);
  const revision = await createCreativeRevision(project.id, {
    cause: input.cause ?? "generate",
    intent: { prompt: input.comic.prompt, legacyComicId: input.comic.id, novelId: input.comic.novelId, status: input.comic.status },
    summary: `${doc.pages.length} pages / ${doc.pages.reduce((count, page) => count + page.panels.length, 0)} panels`,
  });
  const revisionInput = { creativeProjectId: project.id, creativeRevisionId: revision.id };
  await createCreativeArtifact({ ...revisionInput, artifact: { kind: "comic_document", mediaType: "json", content: doc } });
  await createCreativeArtifact({
    ...revisionInput,
    artifact: {
      kind: "style_lock",
      mediaType: "json",
      content: {
        stylePreset: doc.stylePreset,
        layoutId: doc.layoutId,
        director: doc.director,
        characterRoster: doc.characterRoster,
        characterSheetUrls: doc.characterSheetUrls,
      },
    },
  });
  for (const page of doc.pages) {
    await createCreativeArtifact({
      ...revisionInput,
      artifact: { kind: "storyboard_page", mediaType: "json", content: page, metadata: { page: page.page } },
    });
  }
  await finalizeCreativeRevision(revision.id);
  return { creativeProjectId: project.id, creativeRevisionId: revision.id };
}
