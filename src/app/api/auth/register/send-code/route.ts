import { NextResponse } from "next/server";
import { sendRegisterVerificationCode } from "@/lib/auth/email-verification";
import { localizedJsonError } from "@/lib/api/localized-error";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return localizedJsonError(req, "badJson", 400);
  }

  const email =
    typeof body === "object" && body !== null && "email" in body
      ? String((body as { email?: unknown }).email ?? "")
      : "";

  const result = await sendRegisterVerificationCode(email);
  if (!result.ok) {
    const key =
      result.error === "invalidEmail"
        ? "registerInvalidEmail"
        : result.error === "emailTaken"
          ? "registerEmailTaken"
          : result.error === "sendFailed"
            ? "registerSendFailed"
            : "registerCodeCooldown";
    return localizedJsonError(req, key, 400);
  }

  return NextResponse.json({
    ok: true,
    ...(result.devCode ? { devCode: result.devCode } : {}),
  });
}
