import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/admin";
import { sendEmail } from "@/lib/auth/email-sender";

export async function POST(req: Request) {
  const gate = await requireSuperAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  let body: { to?: string };
  try {
    body = (await req.json()) as { to?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const to = body.to?.trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ ok: false, message: "invalidEmail" }, { status: 400 });
  }

  const appName = process.env.APP_NAME?.trim() || "Operone";
  const result = await sendEmail({
    to,
    subject: `${appName} 邮件配置测试`,
    text: `这是一封来自 ${appName} 运营后台的 SMTP/Resend 连通性测试邮件。收到即表示配置生效。`,
    html: `<p>这是一封来自 <strong>${appName}</strong> 运营后台的 SMTP/Resend 连通性测试邮件。</p><p>收到即表示配置生效。</p>`,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
