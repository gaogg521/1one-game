import { NextResponse } from "next/server";
import { buildWechatJssdkConfig, isWechatJssdkConfigured } from "@/lib/wechat/jssdk";
import { localizedApiErrorText, localizedJsonError } from "@/lib/api/localized-error";

export async function GET(req: Request) {
  if (!isWechatJssdkConfigured()) {
    return NextResponse.json({ enabled: false });
  }
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url")?.trim();
  if (!url) return localizedJsonError(req, "missingUrl", 400);
  try {
    const config = await buildWechatJssdkConfig(url);
    if (!config) return NextResponse.json({ enabled: false });
    return NextResponse.json({ enabled: true, ...config });
  } catch (e) {
    return NextResponse.json(
      { enabled: false, error: e instanceof Error ? e.message : localizedApiErrorText(req, "wechatSignFailed") },
      { status: 500 },
    );
  }
}
