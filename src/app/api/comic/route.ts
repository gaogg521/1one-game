import { NextResponse } from "next/server";
import { getOwnerKey } from "@/lib/owner";
import { queryComicList, type ComicListOrderBy } from "@/lib/comic-list-query";
import { isSuperAdmin } from "@/lib/super-admin";
import { localizedApiErrorPayload } from "@/lib/api/localized-error";

const VALID_SORTS = new Set(["likeCount", "createdAt", "featured"]);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sortParam = searchParams.get("sort") ?? "createdAt";
    const sort = VALID_SORTS.has(sortParam) ? sortParam : "createdAt";
    const limitRaw = parseInt(searchParams.get("limit") ?? "24", 10);
    const limit = Math.min(Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 24), 96);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const skip = (page - 1) * limit;
    const mine = searchParams.get("mine") === "1";
    const featuredOnly = searchParams.get("featured") === "1";
    const viewerKey = await getOwnerKey();
    const ownerKey = mine ? viewerKey : null;

    if (mine && !ownerKey) {
      return NextResponse.json({ comics: [], total: 0, page, limit });
    }

    const where =
      mine && ownerKey
        ? { ownerKey }
        : { visibility: "public" as const, ...(featuredOnly ? { featured: true } : {}) };
    const orderBy: ComicListOrderBy =
      sort === "featured"
        ? [{ featured: "desc" }, { likeCount: "desc" }]
        : sort === "likeCount"
          ? { likeCount: "desc" }
          : { createdAt: "desc" };

    const { comics, total } = await queryComicList({ where, orderBy, skip, take: limit });
    const superAdmin = isSuperAdmin(req, viewerKey);

    const comicsPublic = comics.map(({ ownerKey: rowOwner, ...rest }) => {
      const owned = Boolean(viewerKey && rowOwner === viewerKey);
      return {
        ...rest,
        isOwner: owned,
        canDelete: owned || superAdmin,
      };
    });

    return NextResponse.json({ comics: comicsPublic, total, page, limit });
  } catch (err) {
    console.error("[GET /api/comic]", err);
    return NextResponse.json(localizedApiErrorPayload(req, "comicListFailed"), { status: 500 });
  }
}
