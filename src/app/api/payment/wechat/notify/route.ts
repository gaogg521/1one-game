import { NextResponse } from "next/server";
import { handleWechatPayNotify } from "@/lib/commerce/payment";

export async function POST(req: Request) {
  const result = await handleWechatPayNotify(req);
  return NextResponse.json(result);
}
