import { NextResponse } from "next/server";
import { patchGameSpecWithLlm } from "@/lib/spec-patch";
import { localizedApiErrorPayload, localizedJsonError } from "@/lib/api/localized-error";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return localizedJsonError(req, "invalidBody", 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return localizedJsonError(req, "bodyMustBeObject", 400);
  }

  const b = body as Record<string, unknown>;
  const instruction = typeof b.prompt === "string" ? b.prompt : "";
  const currentPrompt = typeof b.currentPrompt === "string" ? b.currentPrompt.trim() : "";

  const result = await patchGameSpecWithLlm({
    instruction,
    currentSpec: b.currentSpec,
    currentPrompt,
  });

  if (!result.ok) {
    return NextResponse.json(localizedApiErrorPayload(req, result.errorKey), { status: result.status });
  }

  return NextResponse.json({
    spec: result.spec,
    prompt: result.mergedPrompt,
  });
}
