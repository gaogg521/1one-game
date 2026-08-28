import { NextResponse } from "next/server";
import { canInspectAnyWork } from "@/lib/auth/admin";
import { generationErrorCodes } from "@/lib/api/json-error-response";
import { localizedApiErrorPayload, localizedJsonError } from "@/lib/api/localized-error";
import { getOwnerKey } from "@/lib/owner";
import { persistNovelCoverBuffer } from "@/lib/novel-cover-persist";
import { loadSharp } from "@/lib/sharp-loader";

export const COVER_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export async function canMutateWorkCover(req: Request, resourceOwnerKey: string): Promise<boolean> {
  const ownerKey = await getOwnerKey();
  if (ownerKey && ownerKey === resourceOwnerKey) return true;
  return canInspectAnyWork(req, ownerKey);
}

export async function jpegBufferFromUpload(file: File): Promise<Buffer> {
  if (file.size < 512) {
    throw new CoverUploadError("coverFileTooSmall");
  }
  if (file.size > COVER_UPLOAD_MAX_BYTES) {
    throw new CoverUploadError("coverTooLarge");
  }
  const type = (file.type || "").toLowerCase();
  if (type && !ALLOWED_TYPES.has(type) && !type.startsWith("image/")) {
    throw new CoverUploadError("coverUnsupportedType");
  }
  const raw = Buffer.from(await file.arrayBuffer());
  if (raw.length < 512) {
    throw new CoverUploadError("coverFileTooSmall");
  }
  try {
    const sharp = await loadSharp();
    const jpeg = await sharp(raw)
      .rotate()
      .resize(900, 1200, { fit: "cover", position: "centre" })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
    if (jpeg.length < 512) throw new CoverUploadError("coverFileTooSmall");
    return jpeg;
  } catch (e) {
    if (e instanceof CoverUploadError) throw e;
    throw new CoverUploadError("coverImageProcessFailed");
  }
}

export class CoverUploadError extends Error {
  constructor(readonly errorKey: string) {
    super(errorKey);
    this.name = "CoverUploadError";
  }
}

export async function persistUploadedCoverJpeg(workId: string, jpeg: Buffer): Promise<string | null> {
  return persistNovelCoverBuffer(workId, jpeg);
}

export async function handleCoverUploadPut(opts: {
  req: Request;
  workId: string;
  ownerKey: string;
  persistPath: (coverPath: string) => Promise<void>;
  requestId: string;
  wrapBody: (coverPath: string) => Record<string, unknown>;
}): Promise<NextResponse> {
  const codes = generationErrorCodes();
  const allowed = await canMutateWorkCover(opts.req, opts.ownerKey);
  if (!allowed) {
    return NextResponse.json(
      localizedApiErrorPayload(opts.req, "unauthorized", { code: codes.BAD_REQUEST, requestId: opts.requestId }),
      { status: 403 },
    );
  }

  let file: File | null = null;
  try {
    const form = await opts.req.formData();
    const raw = form.get("file");
    file = raw instanceof File ? raw : null;
  } catch {
    return localizedJsonError(opts.req, "badJson", 400, { requestId: opts.requestId });
  }
  if (!file) {
    return localizedJsonError(opts.req, "coverFileTooSmall", 400, { requestId: opts.requestId });
  }

  try {
    const jpeg = await jpegBufferFromUpload(file);
    const coverPath = await persistUploadedCoverJpeg(opts.workId, jpeg);
    if (!coverPath) {
      return localizedJsonError(opts.req, "coverSaveFailed", 500, { requestId: opts.requestId });
    }
    await opts.persistPath(coverPath);
    return NextResponse.json({ ok: true, coverPath, ...opts.wrapBody(coverPath) });
  } catch (e) {
    const key = e instanceof CoverUploadError ? e.errorKey : "coverSaveFailed";
    return localizedJsonError(opts.req, key, 400, { requestId: opts.requestId });
  }
}
