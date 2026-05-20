import { NextResponse } from "next/server";
import { z } from "zod";
import { readLimitedJson } from "@/lib/api/read-json-body";
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
        error: "请求体无效",
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
      { error: coerced.issues.join("; ") || "GameSpec 无效", requestId },
      { status: 400, headers: ridHeaders(requestId) },
    );
  }
  const spec = toPlainJson(coerced.spec);

  if (!isGodotExportSupported(spec)) {
    return NextResponse.json(
      {
        error: `模板 ${spec.templateId} 暂不支持 Godot Web 导出`,
        code: "unsupported",
        requestId,
      },
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
      return NextResponse.json(
        { error: result.error, code: result.code, requestId },
        { status, headers: ridHeaders(requestId) },
      );
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
    return NextResponse.json(
      { error: result.error, code: result.code, requestId },
      { status, headers: ridHeaders(requestId) },
    );
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
    const friendly = msg.includes("Maximum call stack")
      ? "游戏数据过大或结构异常，请去掉部分参考图后重试"
      : msg.slice(0, 500);
    return NextResponse.json(
      { error: friendly, code: "export_failed", requestId },
      { status: 500, headers: ridHeaders(requestId) },
    );
  }
}
