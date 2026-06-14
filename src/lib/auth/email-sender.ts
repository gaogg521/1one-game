/**
 * 注册/通知邮件发送：优先 Resend API，其次 SMTP（nodemailer）。
 * 配置来源：后台 DB（PlatformEmailConfig）> .env
 */
import nodemailer from "nodemailer";
import { getEffectiveEmailDelivery, loadEmailConfig } from "@/lib/email-config";

export type SendEmailResult = { ok: true } | { ok: false; error: string };

async function sendViaResend(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from: string;
  apiKey: string;
}): Promise<SendEmailResult> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      subject: params.subject,
      text: params.text,
      ...(params.html ? { html: params.html } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 200)}` };
  }
  return { ok: true };
}

async function sendViaSmtp(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from: string;
  host: string;
  port: number;
  secure: boolean;
  user?: string | null;
  pass?: string | null;
}): Promise<SendEmailResult> {
  const transport = nodemailer.createTransport({
    host: params.host,
    port: params.port,
    secure: params.secure,
    auth: params.user && params.pass ? { user: params.user, pass: params.pass } : undefined,
  });

  try {
    await transport.sendMail({
      from: params.from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      ...(params.html ? { html: params.html } : {}),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export { isEmailDeliveryConfigured } from "@/lib/email-config";

export async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<SendEmailResult> {
  await loadEmailConfig();
  const cfg = getEffectiveEmailDelivery();
  if (!cfg.configured || !cfg.from) {
    return { ok: false, error: "No email provider configured" };
  }

  if (cfg.provider === "resend" || (cfg.resendApiKey && cfg.provider !== "smtp")) {
    if (!cfg.resendApiKey) return { ok: false, error: "Resend not configured" };
    const res = await sendViaResend({
      ...params,
      from: cfg.from,
      apiKey: cfg.resendApiKey,
    });
    if (res.ok) return res;
    if (cfg.smtpHost) {
      return sendViaSmtp({
        ...params,
        from: cfg.from,
        host: cfg.smtpHost,
        port: cfg.smtpPort,
        secure: cfg.smtpSecure,
        user: cfg.smtpUser,
        pass: cfg.smtpPass,
      });
    }
    return res;
  }

  if (cfg.smtpHost) {
    return sendViaSmtp({
      ...params,
      from: cfg.from,
      host: cfg.smtpHost,
      port: cfg.smtpPort,
      secure: cfg.smtpSecure,
      user: cfg.smtpUser,
      pass: cfg.smtpPass,
    });
  }

  return { ok: false, error: "No email provider configured" };
}

export async function sendRegisterVerificationEmail(
  email: string,
  code: string,
): Promise<SendEmailResult> {
  const appName = process.env.APP_NAME?.trim() || "Operone";
  const subject = `${appName} 注册验证码`;
  const text = `您的注册验证码是 ${code}，10 分钟内有效。如非本人操作请忽略此邮件。`;
  const html = `<p>您的注册验证码是 <strong>${code}</strong>，10 分钟内有效。</p><p>如非本人操作请忽略此邮件。</p>`;
  return sendEmail({ to: email, subject, text, html });
}
