import { NextResponse } from "next/server";
import { z } from "zod";
import { readLimitedJson } from "@/lib/api/read-json-body";
import { localizedApiErrorPayload, godotFailurePayload } from "@/lib/api/localized-error";
import { newGenerateRequestId, ridHeaders } from "@/lib/api/request-id";
import { coerceGameSpec } from "@/lib/normalize-spec";
import { exportGameSpecToGodotWeb } from "@/lib/godot-export";
import { exportGodotByTarget, type GodotExportTarget } from "@/lib/godot-export-platform";
import { toPlainJson } from "@/lib/safe-json";
import { isGodotExportSupported } from "@/lib/godot-spec-bridge-codegen";
import {
  loadReferencePayloadsFromIngestCache,
  mergeReferencePayloads,
} from "@/lib/reference-ingest-server-cache";
import { generateGameSprites } from "@/lib/game-sprite-gen";
import { generateGameBackground } from "@/lib/game-background-gen";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const maxDuration = 300;

const ReferencePayloadSchema = z.object({
  ordinal: z.number().int().min(0).max(32),
  purpose: z.string().max(120),
  dataUrl: z.string().max(6_000_000),
});

const TargetSchema = z.enum(["web", "windows", "project", "android"]);

const ReferenceHandleSchema = z.object({
  refId: z.string().min(1).max(80),
  ordinal: z.number().int().min(0).max(32),
  purpose: z.string().max(120).optional(),
});

const BodySchema = z.object({
  spec: z.unknown(),
  projectId: z.string().min(1).max(64).optional(),
  referencePayloads: z.array(ReferencePayloadSchema).max(8).optional(),
  /** 摄取时写入服务端缓存的句柄（无 session 像素时 Godot 仍可用参考图） */
  referenceHandles: z.array(ReferenceHandleSchema).max(8).optional(),
  /** web=浏览器试玩；windows=PC exe zip；project=Godot 工程 zip；android=APK zip（需 SDK） */
  target: TargetSchema.optional().default("web"),
});

async function resolveReferencePayloadsForExport(
  fromClient: z.infer<typeof ReferencePayloadSchema>[] | undefined,
  handles: z.infer<typeof ReferenceHandleSchema>[] | undefined,
) {
  const cached = await loadReferencePayloadsFromIngestCache(handles);
  return mergeReferencePayloads(fromClient ?? [], cached);
}

export async function POST(req: Request) {
  const requestId = newGenerateRequestId();
  /** Godot 导出可带缩略参考图，放宽于默认 generate 512KB */
  const json = await readLimitedJson(req, requestId, { maxBytes: 12 * 1024 * 1024 });
  if (!json.ok) {
    return NextResponse.json(json.payload, { status: json.status, headers: ridHeaders(requestId) });
  }

  const parsed = BodySchema.safeParse(json.body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ...localizedApiErrorPayload(req, "invalidBody"),
        code: "bad_request",
        details: parsed.error.issues.map((i) => i.message).slice(0, 5),
        requestId,
      },
      { status: 400, headers: ridHeaders(requestId) },
    );
  }

  const coerced = coerceGameSpec(parsed.data.spec);
  if (!coerced.ok) {
    return NextResponse.json(
      {
        ...localizedApiErrorPayload(req, "godotSpecInvalid", { requestId }),
        details: coerced.issues.slice(0, 5),
      },
      { status: 400, headers: ridHeaders(requestId) },
    );
  }
  const spec = toPlainJson(coerced.spec);

  // 若带 projectId 且精灵尚未生成，后台静默触发（不阻塞导出）
  if (parsed.data.projectId) {
    const spriteDir = path.join(process.cwd(), "public", "game-sprites", parsed.data.projectId);
    const hasSprites = fs.existsSync(path.join(spriteDir, "player.png"));
    if (!hasSprites) {
      console.info(`[godot-export] 项目 ${parsed.data.projectId} 精灵未生成，后台触发…`);
      void Promise.all([
        generateGameSprites(parsed.data.projectId, coerced.spec),
        generateGameBackground(parsed.data.projectId, coerced.spec),
      ]).then(() => {
        console.info(`[godot-export] 项目 ${parsed.data.projectId} 精灵/背景生成完成`);
      }).catch((e) => {
        console.warn(`[godot-export] 项目 ${parsed.data.projectId} 精灵生成异常:`, e instanceof Error ? e.message : String(e));
      });
    }
  }

  if (!isGodotExportSupported(spec)) {
    return NextResponse.json(
      localizedApiErrorPayload(req, "godotTemplateUnsupported", {
        requestId,
        params: { templateId: spec.templateId },
      }),
      { status: 400, headers: ridHeaders(requestId) },
    );
  }

  const target = parsed.data.target as GodotExportTarget;

  try {
  const referencePayloads = await resolveReferencePayloadsForExport(
    parsed.data.referencePayloads,
    parsed.data.referenceHandles,
  );

  if (target === "web") {
    const result = await exportGameSpecToGodotWeb({
      spec,
      projectId: parsed.data.projectId,
      referencePayloads,
    });

    if (!result.ok) {
      const status = result.code === "unsupported" ? 400 : result.code === "godot_missing" ? 503 : 500;
      return NextResponse.json(godotFailurePayload(req, result, requestId), {
        status,
        headers: ridHeaders(requestId),
      });
    }

    return NextResponse.json(
      {
        target: "web",
        buildUrl: result.buildUrl,
        exportId: result.exportId,
        cached: result.cached,
        referenceSummary: result.referenceSummary,
        requestId,
      },
      { headers: ridHeaders(requestId) },
    );
  }

  const result = await exportGodotByTarget(target, {
    spec,
    projectId: parsed.data.projectId,
    referencePayloads,
  });

  if (!result.ok) {
    const status =
      result.code === "unsupported"
        ? 400
        : result.code === "godot_missing"
          ? 503
          : result.code === "platform_unavailable"
            ? 503
            : 500;
    return NextResponse.json(godotFailurePayload(req, result, requestId), {
      status,
      headers: ridHeaders(requestId),
    });
  }

  return NextResponse.json(
    {
      target,
      downloadUrl: result.downloadUrl,
      exportId: result.exportId,
      cached: result.cached,
      requestId,
    },
    { headers: ridHeaders(requestId) },
  );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const key = msg.includes("Maximum call stack") ? "godotDataTooLarge" : undefined;
    return NextResponse.json(
      key
        ? localizedApiErrorPayload(req, key, { requestId })
        : localizedApiErrorPayload(req, "godotBuildFailed", { requestId }),
      { status: 500, headers: ridHeaders(requestId) },
    );
  }
}
